import numpy as np, pandas as pd
from data.prepare import downsample_1hz

def test_downsample_preserves_setpoint_transition():
    t = np.arange(0, 2.0, 0.01)                      # 200 samples @ 100 Hz
    sp = np.where(t < 1.0, 0.0, 100.0)               # step at t=1 s
    df = pd.DataFrame({"t_s": t, "setpoint_gas1": sp, "s01": np.random.rand(200)})
    out = downsample_1hz(df)
    assert len(out) == 2
    assert out.setpoint_gas1.iloc[0] < out.setpoint_gas1.iloc[1]   # step survives binning
