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

def test_matched_precision_rejects_flag_everything_degeneracy():
    # A useless baseline must not drag both systems to the trivial "flag all
    # runs" operating point (precision == base rate) just to match precision.
    y      = np.array([1, 1, 0, 0, 0, 0, 0, 0])
    s_base = np.array([.4, .4, .4, .4, .2, .2, .2, .2])   # best real point: prec 0.5
    s_comp = np.array([.9, .9, .1, .1, .1, .1, .1, .1])   # separates perfectly
    tb, tc, prec = operating_point_at_matched_precision(y, s_base, s_comp)
    assert (s_base >= tb).sum() < len(y), "baseline threshold flags everything"
    assert (s_comp >= tc).sum() < len(y), "compound threshold flags everything"
    assert prec > y.mean()  # matched precision must beat the base rate
