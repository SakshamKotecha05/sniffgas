from datetime import datetime, timezone

from core.contracts import SensorTick, RiskScore, Contributor, dumps, loads


def test_sensor_tick_roundtrip():
    t = SensorTick(ts=datetime.now(timezone.utc), zone="Z1", ppm=250.0,
                   channels={f"s{i:02d}": float(i) for i in range(1, 17)})
    assert loads(SensorTick, dumps(t)) == t


def test_risk_score_rejects_out_of_range():
    import pytest
    with pytest.raises(ValueError):
        RiskScore(ts=datetime.now(timezone.utc), zone="Z1", anomaly=1.4, compound=0.2,
                  level="green", contributors=[], subgraph={})
