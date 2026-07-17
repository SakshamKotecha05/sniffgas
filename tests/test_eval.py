# tests/test_eval.py
import numpy as np
from core.eval.run_eval import operating_point_at_matched_precision

def test_matched_precision_picks_equal_precision_thresholds():
    y      = np.array([0, 0, 1, 1, 1, 0, 1, 0])
    s_base = np.array([.1, .2, .4, .35, .6, .3, .55, .25])
    s_comp = np.array([.1, .15, .8, .75, .9, .2, .85, .3])
    tb, tc, prec = operating_point_at_matched_precision(y, s_base, s_comp)
    from sklearn.metrics import precision_score
    pb = precision_score(y, s_base >= tb); pc = precision_score(y, s_comp >= tc)
    assert abs(pb - pc) < 0.05
