"""Task 7 failing tests — monotonicity + confounder behavior (plan.md, verbatim)."""
from core.fusion import CompoundScorer, train_demo_scorer

BASE = {"anomaly": 0.0, "gas_residual_slope": 0.0, "hot_work_active": 0.0,
        "maintenance_in_zone": 0.0, "shift_changeover": 0.0,
        "worker_count_in_zone": 0.0, "ignition_within_2_hops": 0.0}


def test_compound_trips_only_on_conjunction():
    s = train_demo_scorer(seed=42)                       # trains on the seeded scenario corpus
    gas_only  = s.predict({**BASE, "anomaly": 0.45, "gas_residual_slope": 0.4})[0]
    ctx_only  = s.predict({**BASE, "hot_work_active": 1, "worker_count_in_zone": 4,
                           "shift_changeover": 1, "ignition_within_2_hops": 1})[0]
    compound  = s.predict({**BASE, "anomaly": 0.45, "gas_residual_slope": 0.4,
                           "hot_work_active": 1, "worker_count_in_zone": 4,
                           "shift_changeover": 1, "ignition_within_2_hops": 1})[0]
    assert compound > 0.75 and gas_only < 0.5 and ctx_only < 0.5


def test_monotone_in_anomaly():
    s = train_demo_scorer(seed=42)
    lo = s.predict({**BASE, "hot_work_active": 1, "anomaly": 0.2})[0]
    hi = s.predict({**BASE, "hot_work_active": 1, "anomaly": 0.6})[0]
    assert hi >= lo
