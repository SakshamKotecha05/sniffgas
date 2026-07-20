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


def test_risk_score_ppm_optional_defaults_none_and_roundtrips():
    """ADR 0003: ppm rides on RiskScore so the CO dial and level come from one
    message. Additive + defaulted, like the `state` field — old payloads stay valid."""
    bare = RiskScore(ts=datetime.now(timezone.utc), zone="Z1", anomaly=0.1, compound=0.2,
                     level="green", contributors=[], subgraph={})
    assert bare.ppm is None  # defaulted: consumers that ignore it are unaffected
    hot = RiskScore(ts=datetime.now(timezone.utc), zone="Z1", anomaly=0.9, compound=0.9,
                    level="red", contributors=[], subgraph={}, ppm=412.0)
    assert loads(RiskScore, dumps(hot)).ppm == 412.0
