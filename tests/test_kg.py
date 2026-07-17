# tests/test_kg.py
from datetime import datetime, timezone
from core.contracts import ContextEvent
from core.kg import PlantGraph, DEMO_LAYOUT

def test_hot_work_and_hops():
    g = PlantGraph(DEMO_LAYOUT)
    now = datetime.now(timezone.utc)
    g.apply_event(ContextEvent(ts=now, zone="Z1", kind="permit_active",
                               payload={"permit_type": "hot_work"}))
    f = g.features("Z1", now, anomaly=0.3)
    assert f["hot_work_active"] == 1.0
    assert f["ignition_within_2_hops"] == 1.0
    assert set(f) == {"anomaly", "gas_residual_slope", "hot_work_active", "maintenance_in_zone",
                      "shift_changeover", "worker_count_in_zone", "ignition_within_2_hops"}
