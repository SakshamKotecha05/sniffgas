# tests/test_labels.py
from datetime import datetime, timezone

import pandas as pd

from core.contracts import ContextEvent
from core.eval.labels import leak_onsets, alarm_crossings, compound_incident


def test_onset_from_setpoint_only():
    df = pd.DataFrame({"t_s": range(10), "setpoint_gas1": [0]*4 + [80]*6})
    (iv,) = leak_onsets(df)
    assert iv.left == 4


def test_alarm_crossing_at_stel_400_no_scaling():
    df = pd.DataFrame({"t_s": [0, 1, 2, 3], "setpoint_gas1": [200.0, 380.0, 400.0, 420.0]})
    assert alarm_crossings(df) == [2.0]


def _event_at(t_s, kind="permit_active"):
    return ContextEvent(ts=datetime.fromtimestamp(t_s, tz=timezone.utc), zone="Z1",
                        kind=kind, payload={"permit_type": "hot_work"})


def test_compound_incident_requires_conjunction():
    onset = pd.Interval(29249, 29450, closed="both")
    assert compound_incident(onset, [_event_at(29300)], window_s=600) is True
    assert compound_incident(onset, [_event_at(99999)], window_s=600) is False
    assert compound_incident(onset, [], window_s=600) is False
