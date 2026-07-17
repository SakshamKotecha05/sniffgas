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
