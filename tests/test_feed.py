# tests/test_feed.py — pure parts of the fusion feed (no Redis, no sklearn fit)
from datetime import datetime, timedelta, timezone

from core.contracts import ContextEvent, RiskScore, SensorTick
from core.fusion import train_demo_scorer
from core.kg import DEMO_LAYOUT, PlantGraph

from api.feed import AMBER_T, RED_T, level_for, reset_graph_if_replay_restarted, score_tick

NOW = datetime.now(timezone.utc)


def _tick(zone="Z1"):
    return SensorTick(ts=NOW, zone=zone, ppm=0.0, channels={"s01": 10.0})


def test_level_thresholds():
    assert level_for(AMBER_T - 0.01) == "green"
    assert level_for(AMBER_T) == "amber"
    assert level_for(RED_T) == "red"


def test_score_tick_returns_valid_riskscore_and_context_raises_risk():
    g, scorer = PlantGraph(DEMO_LAYOUT), train_demo_scorer()
    quiet = score_tick(_tick(), anomaly=0.05, g=g, scorer=scorer)
    assert isinstance(quiet, RiskScore) and quiet.zone == "Z1"

    g.apply_event(ContextEvent(ts=NOW, zone="Z1", kind="permit_active",
                               payload={"permit_type": "hot_work"}))
    g.apply_event(ContextEvent(ts=NOW, zone="Z1", kind="worker_pos",
                               payload={"worker_count": 4, "x": 12.5, "y": 8.2}))
    hot = score_tick(_tick(), anomaly=0.9, g=g, scorer=scorer)
    assert hot.compound > quiet.compound
    assert hot.subgraph["nodes"]  # drill-down populated
    assert any(c.feature == "hot_work_active" for c in hot.contributors)


def test_score_tick_carries_setpoint_ppm_for_the_dial():
    """ADR 0003: the CO dial reads RiskScore.ppm, so score_tick forwards the
    tick's CO setpoint verbatim — no model in the path (ADR 0002)."""
    g, scorer = PlantGraph(DEMO_LAYOUT), train_demo_scorer()
    hot = SensorTick(ts=NOW, zone="Z1", ppm=412.0, channels={"s01": 10.0})
    assert score_tick(hot, anomaly=0.5, g=g, scorer=scorer).ppm == 412.0


def test_watch_state_surfaces_as_amber_before_gas_confirms():
    """Killer-moment beat: context assembles while gas is quiet -> WATCH/amber
    (advisory), then gas slope opens the gate -> ALARM. Gate keeps the *alarm*
    suppressed pre-confirmation (§5 guardrail 5); WATCH re-surfaces it honestly."""
    g, scorer = PlantGraph(DEMO_LAYOUT), train_demo_scorer()
    g.apply_event(ContextEvent(ts=NOW, zone="Z1", kind="permit_active",
                               payload={"permit_type": "hot_work"}))
    g.apply_event(ContextEvent(ts=NOW, zone="Z1", kind="worker_pos",
                               payload={"worker_count": 4, "x": 12.5, "y": 8.2}))

    watch = score_tick(_tick(), anomaly=0.9, g=g, scorer=scorer)  # slope 0 -> gate shut
    assert watch.state == "WATCH"
    assert watch.level == "amber"          # advisory tier reaches the UI
    assert watch.compound < AMBER_T        # ...but the gated score stays suppressed

    g.set_gas_slope("Z1", 0.4)             # gas confirms -> gate opens
    alarm = score_tick(_tick(), anomaly=0.9, g=g, scorer=scorer)
    assert alarm.state == "ALARM"
    assert alarm.compound > watch.compound
    assert alarm.level in ("amber", "red")  # display thresholds remain distinct from eval controls


def test_replay_timestamp_regression_resets_dynamic_context():
    """A looping demo scenario must not carry a prior cycle's permit or gas state
    into the next cycle, whose source timestamps restart at the window head."""
    graph = PlantGraph(DEMO_LAYOUT)
    graph.apply_event(ContextEvent(ts=NOW, zone="Z1", kind="permit_active",
                                   payload={"permit_type": "hot_work"}))
    graph.apply_event(ContextEvent(ts=NOW, zone="Z1", kind="worker_pos",
                                   payload={"worker_count": 4, "x": 12.5, "y": 8.2}))

    clean = reset_graph_if_replay_restarted(graph, NOW, NOW - timedelta(seconds=280))

    assert clean is not graph
    assert clean.features("Z1", NOW, anomaly=0.0)["hot_work_active"] == 0.0
    assert clean.features("Z1", NOW, anomaly=0.0)["worker_count_in_zone"] == 0.0
    assert not any(node["type"] == "permit" for node in clean.subgraph("Z1")["nodes"])
