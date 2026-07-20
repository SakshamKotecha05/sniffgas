"""Frozen Day-1 event contracts. Changes need 4-person agreement before Jul 10, never after."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

STREAM_SENSOR = "sensor_tick"      # 1 Hz per sensor, replayed at N×
STREAM_CONTEXT = "context_event"
STREAM_RISK = "risk_score"         # fusion output, drives the UI
STREAM_ALERT = "alert"


class SensorTick(BaseModel):
    ts: datetime
    zone: str                      # "Z1" | "Z2" | "Z3" — one tick per zone, not per raw sensor
    ppm: float = Field(ge=0)       # the real CO setpoint (ground-truth gauge feed); the dial shows this
    channels: dict[str, float]     # s01..s16 raw MOX resistances — anomaly scorer input only, never shown
    # ppm is ground truth (steps between real setpoint levels); CSS eases the dial animation between
    # values, never the data. The 16 raw resistances feed the anomaly model; they are NOT 16 gauges.


class ContextEvent(BaseModel):
    ts: datetime
    zone: str
    kind: Literal["permit_active", "permit_closed", "maintenance_start",
                  "maintenance_end", "shift_change", "worker_pos"]
    payload: dict                  # permit_active: {"permit_type": "hot_work"} ·
                                   # worker_pos: {"worker_count": 4, "x": 12.5, "y": 8.2} ·
                                   # shift_change: {"staffing_delta": -2}


class Contributor(BaseModel):
    feature: str                   # one of the frozen features() keys (§3)
    value: float
    weight: float                  # signed contribution to compound


class RiskScore(BaseModel):
    ts: datetime
    zone: str
    anomaly: float = Field(ge=0, le=1)
    compound: float = Field(ge=0, le=1)
    level: Literal["green", "amber", "red"]   # thresholds live in core/eval/labels.py (frozen Jul 9, in the hash), NOT here — derived on the validation split at the matched-precision operating point
    state: Literal["NORMAL", "WATCH", "ALARM"] = "NORMAL"  # ISA-18.2-style two-tier (fusion.predict_state); WATCH = context assembled, gas not yet confirming — additive default, no consumer breaks
    ppm: float | None = Field(default=None, ge=0)  # ADR 0003: the zone's CO setpoint at score time (ADR 0002), rides here so the dial + level come from one message — additive default, no consumer breaks
    contributors: list[Contributor]
    subgraph: dict                 # {"nodes": [...], "edges": [...]} — "why red" drill-down


class Alert(BaseModel):
    ts: datetime
    zone: str
    kind: Literal["evacuation"]
    compound: float
    report_id: str                 # "rpt-014" → GET /reports/{id}


def dumps(model: BaseModel) -> bytes:
    return model.model_dump_json().encode()


def loads(cls: type[BaseModel], raw: bytes) -> BaseModel:
    return cls.model_validate_json(raw)
