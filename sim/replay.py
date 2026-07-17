"""Replay a scenario DataFrame onto the sensor stream at N× speed."""
import time
from datetime import datetime, timezone

import pandas as pd
import redis
import yaml

from core.contracts import (STREAM_CONTEXT, STREAM_SENSOR, ContextEvent,
                            SensorTick, dumps)


def replay_sync(df: pd.DataFrame, r: "redis.Redis", zone: str, speed: float = 1.0) -> None:
    """Publish one SensorTick per row of `df` to STREAM_SENSOR, in row order.

    - `t_s` column gives the timeline in seconds; wall-clock pacing is
      (delta t_s) / speed. speed=0 means no sleeping (tests, fast-forward).
    - `setpoint_gas1` is the ground-truth CO ppm shown on the dial.
    - Every other `s*` column is a raw MOX channel (anomaly input only).
    """
    base = datetime.now(timezone.utc)
    prev_t = None
    for row in df.itertuples(index=False):
        row_d = row._asdict()
        t_s = float(row_d["t_s"])
        if speed and prev_t is not None:
            time.sleep(max(0.0, (t_s - prev_t) / speed))
        prev_t = t_s
        tick = SensorTick(
            ts=base + pd.Timedelta(seconds=t_s),
            zone=zone,
            ppm=float(row_d["setpoint_gas1"]),
            channels={k: float(v) for k, v in row_d.items()
                      if k.startswith("s") and k not in ("setpoint_gas1",)},
        )
        r.xadd(STREAM_SENSOR, {"data": dumps(tick)})


def run_scenario(path: str, r: "redis.Redis", zone: str = "Z1",
                 speed: float | None = None) -> None:
    """Load a scenario YAML (§6 Task 3 frozen shape), replay its trace window
    as SensorTicks and publish its context events on STREAM_CONTEXT, both in
    timestamp order. `speed` overrides the scenario's own speed if given."""
    scn = yaml.safe_load(open(path))
    speed = scn["speed"] if speed is None else speed
    df = pd.read_parquet(scn["trace"])
    w = scn["window"]
    df = df[(df["t_s"] >= w["start_s"]) & (df["t_s"] <= w["end_s"])]
    events = sorted(scn.get("events") or [], key=lambda e: e["at_s"])
    base = datetime.now(timezone.utc)
    prev_t = None
    for row in df.itertuples(index=False):
        row_d = row._asdict()
        t_s = float(row_d["t_s"])
        if speed and prev_t is not None:
            time.sleep(max(0.0, (t_s - prev_t) / speed))
        prev_t = t_s
        while events and events[0]["at_s"] <= t_s:
            e = events.pop(0)
            ev = ContextEvent(ts=base + pd.Timedelta(seconds=e["at_s"]),
                              zone=e.get("zone", zone), kind=e["kind"],
                              payload=e["payload"])
            r.xadd(STREAM_CONTEXT, {"data": dumps(ev)})
        tick = SensorTick(
            ts=base + pd.Timedelta(seconds=t_s),
            zone=zone,
            ppm=float(row_d["setpoint_gas1"]),
            channels={k: float(v) for k, v in row_d.items()
                      if k.startswith("s") and k not in ("setpoint_gas1",)},
        )
        r.xadd(STREAM_SENSOR, {"data": dumps(tick)})


if __name__ == "__main__":
    import argparse
    import random

    p = argparse.ArgumentParser(description="Replay a scenario onto Redis streams")
    p.add_argument("--scenario", required=True)
    p.add_argument("--speed", type=float, default=None)
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("--zone", default="Z1")
    args = p.parse_args()
    if args.seed is not None:
        random.seed(args.seed)
    run_scenario(args.scenario, redis.Redis(), zone=args.zone, speed=args.speed)
