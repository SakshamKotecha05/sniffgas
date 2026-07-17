# tests/test_anomaly.py
import numpy as np, pandas as pd
from core.anomaly.baseline import IForestScorer

def _trace(step_at=None, n=600):
    x = np.random.default_rng(0).normal(10, 0.1, n)
    if step_at is not None:
        x[step_at:] += np.linspace(0, 5, n - step_at)      # drifting onset, sub-threshold
    return pd.DataFrame({"s01": x})

def test_onset_scores_higher_than_quiet():
    s = IForestScorer(); s.fit(_trace()[:400])
    quiet = s.score_window(_trace()[400:])
    onset = s.score_window(_trace(step_at=450)[400:])
    assert onset > quiet + 0.2
