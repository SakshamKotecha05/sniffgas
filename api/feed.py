"""Fusion feed (pipeline glue): Redis sensor/context streams -> RiskScore -> push.

Runs as a daemon thread inside the gateway process (`python -m api.main`)
because push_risk_score broadcasts to in-process /live WS clients.
api/ may import core/, never the reverse (ADR 0001 layering).
"""
from __future__ import annotations

import os
import time
from collections import defaultdict, deque
from datetime import datetime
from pathlib import Path
from typing import Callable

import pandas as pd

from core.anomaly.baseline import WINDOW_S, IForestScorer, gas_residual_slope
from core.contracts import (STREAM_CONTEXT, STREAM_SENSOR, ContextEvent,
                            RiskScore, SensorTick, loads)
from core.fusion import CompoundScorer
from core.kg import DEMO_LAYOUT, PlantGraph

# Live display thresholds, deliberately separate from the replay-evaluation
# operating points recorded in ADR 0004. They drive the live NORMAL/WATCH/ALARM
# presentation and the red-level escalation gate; they are not copied from the
# fixed-recall comparison thresholds.
AMBER_T, RED_T = 0.40, 0.75

_MIN_WINDOW = 5  # ticks per zone before an anomaly score is trusted


def level_for(compound: float) -> str:
    return "red" if compound >= RED_T else "amber" if compound >= AMBER_T else "green"


def score_tick(tick: SensorTick, anomaly: float,
               g: PlantGraph, scorer: CompoundScorer) -> RiskScore:
    """Pure fusion step: one tick + current KG state -> RiskScore."""
    feats = g.features(tick.zone, tick.ts, anomaly)
    compound, state, _ungated, contributors = scorer.predict_state(feats)
    level = level_for(compound)
    if state == "WATCH" and level == "green":
        level = "amber"  # pre-incident advisory: context assembled, gas not yet confirming
    return RiskScore(ts=tick.ts, zone=tick.zone, anomaly=anomaly,
                     compound=compound, level=level, state=state, ppm=tick.ppm,
                     contributors=contributors, subgraph=g.subgraph(tick.zone))


def fit_live_models(parquet: str | Path = "data/co_1hz.parquet") -> tuple[IForestScorer, CompoundScorer]:
    """Fit the same temporal-split models that produced the accepted eval artifact."""
    from core.eval.run_eval import fit_evaluation_models

    return fit_evaluation_models(pd.read_parquet(parquet))


def reset_graph_if_replay_restarted(graph: PlantGraph, previous_ts: datetime | None,
                                    next_ts: datetime) -> PlantGraph:
    """Start a fresh dynamic graph when a looping replay returns to its window head.

    `sim.replay` gives every pass a new wall-clock base but reuses the trace's
    source-time window, so the first tick of the next pass regresses in source
    time. The static plant layout survives; prior permits, workers, shifts, and
    gas slope must not.
    """
    if previous_ts is not None and next_ts < previous_ts:
        return PlantGraph(DEMO_LAYOUT)
    return graph


def run_feed(r, push: Callable[[RiskScore], None], *,
             iforest: IForestScorer, scorer: CompoundScorer,
             g: PlantGraph | None = None) -> None:
    """Blocking consume loop. Reads only entries newer than startup ("$"),
    so start the gateway before `python -m sim.replay`."""
    g = g or PlantGraph(DEMO_LAYOUT)
    windows: dict[str, deque] = defaultdict(lambda: deque(maxlen=WINDOW_S))
    last = {STREAM_SENSOR: "$", STREAM_CONTEXT: "$"}
    last_tick_ts: dict[str, datetime] = {}

    while True:
        for stream, entries in r.xread(last, block=1000) or []:
            name = stream.decode() if isinstance(stream, bytes) else stream
            for entry_id, fields in entries:
                last[name] = entry_id
                raw = fields.get(b"data") or fields.get("data")
                if name == STREAM_CONTEXT:
                    g.apply_event(loads(ContextEvent, raw))
                    continue
                tick = loads(SensorTick, raw)
                previous_ts = last_tick_ts.get(tick.zone)
                fresh_graph = reset_graph_if_replay_restarted(g, previous_ts, tick.ts)
                if fresh_graph is not g:
                    g = fresh_graph
                    windows.clear()
                    last_tick_ts.clear()
                last_tick_ts[tick.zone] = tick.ts
                win = windows[tick.zone]
                win.append(tick.channels)
                if len(win) < _MIN_WINDOW:
                    continue
                wdf = pd.DataFrame(list(win))
                g.set_gas_slope(tick.zone, gas_residual_slope(wdf))
                push(score_tick(tick, iforest.score_window(wdf), g, scorer))


def start_feed(push: Callable[[RiskScore], None]) -> None:
    """Daemon-thread entry point: connect, fit, consume; retry on Redis loss."""
    import redis
    r = redis.Redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379"))
    iforest, scorer = fit_live_models()  # fit once (~seconds); survives reconnects
    while True:
        try:
            run_feed(r, push, iforest=iforest, scorer=scorer)
        except redis.exceptions.ConnectionError:
            time.sleep(1)  # ponytail: blind retry is enough for a demo box
