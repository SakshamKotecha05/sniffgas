from fastapi.testclient import TestClient

from api.main import app, push_risk_score, REPORTS, _upgrade_report
from tests.helpers import make_risk_score


def test_ws_pushes_risk_score():
    client = TestClient(app)
    with client.websocket_connect("/live") as ws:
        push_risk_score(make_risk_score(compound=0.9, level="red"))
        msg = ws.receive_json()
        assert msg["level"] == "red" and msg["zone"] == "Z1"


def test_get_report():
    REPORTS["rpt-001"] = {"structured": {"severity": "high"}, "narrative": "..."}
    client = TestClient(app)
    assert client.get("/reports/rpt-001").json()["structured"]["severity"] == "high"
    assert client.get("/reports/rpt-999").status_code == 404


def test_upgrade_report_swaps_canned_for_live_and_keeps_subgraph():
    """Live cited report replaces the canned one when the agent succeeds; the
    subgraph (drill-down payload) is preserved so GET /reports stays whole."""
    score = make_risk_score(compound=0.9, level="red")
    REPORTS["rpt-x"] = {"narrative": "canned", "subgraph": score.subgraph}
    _upgrade_report("rpt-x", score, gen=lambda ctx, clauses, fallback: {
        "narrative": f"live report for {ctx['zone']}", "structured": {"zone": ctx["zone"]}})
    assert REPORTS["rpt-x"]["narrative"] == "live report for Z1"
    assert REPORTS["rpt-x"]["subgraph"] == score.subgraph


def test_upgrade_report_is_noop_without_api_key(monkeypatch):
    """No key -> no live attempt; the canned report is left untouched (safe demo default)."""
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    score = make_risk_score(compound=0.9, level="red")
    REPORTS["rpt-y"] = {"narrative": "canned"}
    _upgrade_report("rpt-y", score)
    assert REPORTS["rpt-y"]["narrative"] == "canned"


def test_rehearsal_report_for_z1_is_cited_and_ready_without_the_provider():
    """The repeatable demo must not spend model quota to show its headline report."""
    from api.main import rehearsal_report_for

    report = rehearsal_report_for("Z1")

    assert report is not None
    assert report["structured"]["zone"] == "Z1"
    assert report["structured"]["clause_ids"]
    assert "[fa-41b]" in report["narrative"]


def test_rehearsal_reports_resolve_only_local_corpus_ids():
    import json
    from pathlib import Path

    from agent.report import CITE_RE, StructuredReport

    root = Path(__file__).parents[1]
    reports = json.loads((root / "agent/corpus/rehearsal_reports.json").read_text())
    clauses = json.loads((root / "agent/corpus/clauses.json").read_text())
    known = {clause["id"] for clause in clauses}

    assert reports
    for report in reports.values():
        StructuredReport.model_validate(report["structured"])
        cited = set(CITE_RE.findall(report["narrative"]))
        cited |= set(report["structured"]["clause_ids"])
        assert cited
        assert cited <= known


def test_z1_alert_uses_rehearsal_report_without_starting_live_upgrade(monkeypatch):
    import api.main as main

    class MustNotStart:
        def __init__(self, *_args, **_kwargs):
            raise AssertionError("cached Z1 report must not start a provider thread")

    main.REPORTS.clear()
    main._last_level.clear()
    monkeypatch.setattr(main.threading, "Thread", MustNotStart)

    score = make_risk_score(compound=0.91, level="red")
    main.push_with_alerts(score)

    assert len(main.REPORTS) == 1
    report = next(iter(main.REPORTS.values()))
    assert report["structured"]["clause_ids"]
    assert "[fa-41b]" in report["narrative"]
    assert report["subgraph"] == score.subgraph


def test_unknown_zone_alert_keeps_best_effort_upgrade(monkeypatch):
    import api.main as main

    started = []

    class DeferredThread:
        def __init__(self, *, target, args, daemon):
            self.target = target
            self.args = args
            self.daemon = daemon

        def start(self):
            started.append((self.target, self.args, self.daemon))

    main.REPORTS.clear()
    main._last_level.clear()
    monkeypatch.setattr(main.threading, "Thread", DeferredThread)

    score = make_risk_score(zone="Z2", compound=0.91, level="red")
    main.push_with_alerts(score)

    report = next(iter(main.REPORTS.values()))
    assert report["structured"]["severity"] == "high"
    assert "evacuation response recommendation" in report["narrative"].lower()
    assert report["subgraph"] == score.subgraph
    assert started == [(main._upgrade_report, (next(iter(main.REPORTS)), score), True)]


def test_red_crossing_fires_alert_once():
    from api.main import push_with_alerts, _last_level
    _last_level.clear()
    client = TestClient(app)
    with client.websocket_connect("/live") as ws:
        push_with_alerts(make_risk_score(compound=0.2, level="green"))
        ws.receive_json()  # green score, no alert
        push_with_alerts(make_risk_score(compound=0.9, level="red"))
        ws.receive_json()  # the red score itself
        alert = ws.receive_json()
        assert alert["kind"] == "evacuation" and alert["zone"] == "Z1"
        assert alert["report_id"] in REPORTS
        assert "Z1" in REPORTS[alert["report_id"]]["narrative"]
        # staying red must not re-fire
        push_with_alerts(make_risk_score(compound=0.92, level="red"))
        assert ws.receive_json()["level"] == "red"  # only the score arrives
        push_with_alerts(make_risk_score(compound=0.1, level="green"))
        assert ws.receive_json()["level"] == "green"
