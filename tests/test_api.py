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
