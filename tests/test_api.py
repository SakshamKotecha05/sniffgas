from fastapi.testclient import TestClient

from api.main import app, push_risk_score, REPORTS
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
