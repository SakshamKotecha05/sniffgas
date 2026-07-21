# tests/test_replay.py
import fakeredis, pandas as pd
from core.contracts import STREAM_SENSOR, SensorTick, loads
from sim.replay import replay_sync

def test_ticks_arrive_in_order():
    r = fakeredis.FakeRedis()
    df = pd.DataFrame({"t_s": [0.0, 1.0, 2.0], "setpoint_gas1": [0, 0, 0],
                       "s01": [10.0, 11.0, 12.0]})
    replay_sync(df, r, zone="Z1", speed=0)          # speed=0 → no sleeping, test runs instantly
    entries = r.xrange(STREAM_SENSOR)
    ppms = [loads(SensorTick, e[1][b"data"]).ppm for e in entries]
    assert ppms == sorted(ppms) and len(ppms) == 3


def test_replay_bounds_retained_sensor_history(monkeypatch):
    import sim.replay as replay

    monkeypatch.setattr(replay, "STREAM_MAXLEN", 2, raising=False)
    r = fakeredis.FakeRedis()
    df = pd.DataFrame({"t_s": [0.0, 1.0, 2.0], "setpoint_gas1": [0, 0, 0],
                       "s01": [10.0, 11.0, 12.0]})

    replay.replay_sync(df, r, zone="Z1", speed=0)

    assert r.xlen(STREAM_SENSOR) == 2


def test_scenario_replays_ticks_and_events(tmp_path):
    from core.contracts import STREAM_CONTEXT, ContextEvent
    from sim.replay import run_scenario
    trace = tmp_path / "trace.parquet"
    pd.DataFrame({"t_s": [100.0, 101.0, 102.0, 103.0],
                  "setpoint_gas1": [0.0, 10.0, 20.0, 30.0],
                  "s01": [10.0, 11.0, 12.0, 13.0]}).to_parquet(trace)
    scn = tmp_path / "scn.yaml"
    scn.write_text(f"""
seed: 42
trace: {trace}
window: {{start_s: 100, end_s: 102}}
speed: 0
events:
  - {{at_s: 101, kind: permit_active, zone: Z1, payload: {{permit_type: hot_work}}}}
""")
    r = fakeredis.FakeRedis()
    run_scenario(str(scn), r, zone="Z1")
    ticks = r.xrange(STREAM_SENSOR)
    assert len(ticks) == 3                      # window slices 100..102 inclusive
    events = [loads(ContextEvent, e[1][b"data"]) for e in r.xrange(STREAM_CONTEXT)]
    assert len(events) == 1 and events[0].kind == "permit_active"
    assert events[0].payload == {"permit_type": "hot_work"}
