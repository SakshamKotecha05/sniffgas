# tests/test_eval.py
import numpy as np
from core.eval import run_eval
from core.eval.run_eval import operating_point_at_matched_precision

def test_matched_precision_picks_equal_precision_thresholds():
    y      = np.array([0, 0, 1, 1, 1, 0, 1, 0])
    s_base = np.array([.1, .2, .4, .35, .6, .3, .55, .25])
    s_comp = np.array([.1, .15, .8, .75, .9, .2, .85, .3])
    tb, tc, prec = operating_point_at_matched_precision(y, s_base, s_comp)
    from sklearn.metrics import precision_score
    pb = precision_score(y, s_base >= tb); pc = precision_score(y, s_comp >= tc)
    assert pb == pc
    assert prec == pb

def test_matched_precision_rejects_flag_everything_degeneracy():
    # A useless baseline must not drag both systems to the trivial "flag all
    # runs" operating point (precision == base rate) just to match precision.
    y      = np.array([1, 1, 0, 0, 0, 0, 0, 0])
    s_base = np.array([.4, .4, .4, .4, .2, .2, .2, .2])   # best real point: prec 0.5
    s_comp = np.array([.9, .9, .1, .1, .1, .1, .1, .1])   # separates perfectly
    # The only common precision would come from flagging every run. That is not
    # a fair operating point, so the selector must decline to manufacture one.
    assert operating_point_at_matched_precision(y, s_base, s_comp) is None


def test_matched_precision_refuses_a_nearby_but_unequal_score_grid_pair():
    """A fairness guard must not relabel the nearest precision as equal."""
    y = np.array([1, 1, 0, 0, 0])
    # Nontrivial baseline precisions: 1, 1, 2/3.
    s_base = np.array([5, 4, 3, 2, 1])
    # Nontrivial compound precisions: 1/3, 1/4.
    s_comp = np.array([3, 1, 5, 4, 2])

    assert operating_point_at_matched_precision(y, s_base, s_comp) is None


def test_full_recall_threshold_is_the_highest_cutoff_that_keeps_every_incident():
    y = np.array([1, 1, 0, 0, 0])
    scores = np.array([0.80, 0.50, 0.70, 0.40, 0.10])
    selector = getattr(run_eval, "operating_point_at_full_recall", None)

    assert selector is not None
    threshold = selector(y, scores)
    assert threshold == 0.50
    assert (scores[y == 1] >= threshold).all()
    assert not (scores[y == 1] >= 0.51).all()
