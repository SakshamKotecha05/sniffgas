# tests/test_feed.py — pure parts of the fusion feed (no Redis, no sklearn fit)
from datetime import datetime, timezone

from core.contracts import ContextEvent, RiskScore, SensorTick
from core.fusion import train_demo_scorer
from core.kg import DEMO_LAYOUT, PlantGraph

from api.feed import AMBER_T, RED_T, level_for, score_tick

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
