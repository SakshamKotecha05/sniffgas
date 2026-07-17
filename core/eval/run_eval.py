"""Eval harness (plan Task 8, §5). Consumes scenarios (Task 3), labels (Task 6),
both scorers (Tasks 4, 7). Produces eval_report.md with the §5 artifact tables.

CLI: python -m core.eval.run_eval --replays 50 --out eval_report.md
"""
import numpy as np


def operating_point_at_matched_precision(y, s_base, s_comp):
    """Pick (threshold_base, threshold_comp) with equal precision (§5 guardrail 3).

    Grid over each scorer's own score values; choose the pair minimizing the
    precision gap, tie-broken by highest compound recall (that's where the
    FN-reduction headline is measured).
    """
    y = np.asarray(y)

    def _points(s):
        pts = []
        for t in np.unique(s):
            pred = s >= t
            if pred.sum() == 0:
                continue
            tp = int((pred & (y == 1)).sum())
            pts.append((t, tp / pred.sum(), tp / max((y == 1).sum(), 1)))
        return pts  # (threshold, precision, recall)

    best = None
    for tb, pb, _ in _points(np.asarray(s_base)):
        for tc, pc, rc in _points(np.asarray(s_comp)):
            key = (abs(pb - pc), -rc)
            if best is None or key < best[0]:
                best = (key, tb, tc, pb)
    _, tb, tc, prec = best
    return tb, tc, prec


# --------------------------------------------------------------------------
# Harness: scenarios (Task 3) + labels (Task 6) + scorers (Tasks 4, 7) -> report
# --------------------------------------------------------------------------
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
import yaml

from core.anomaly.baseline import IForestScorer, gas_residual_slope
from core.contracts import ContextEvent
from core.eval.labels import alarm_crossings, compound_incident, leak_onsets
from core.fusion import CompoundScorer
from core.kg import DEMO_LAYOUT, PlantGraph

EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)  # t_s-anchored (ADR 0003)
STRIDE_S, WINDOW_S = 10, 60
TRAIN_END_S = 15_000.0  # temporal split (§5 guardrail 2): train = early hours

# Training replays live in the EARLY hours; the scenario YAMLs (test) use the
# late hero window. compound_train scripts the same context recipe onto an
# early escalating run so fusion never sees the test window.
TRAIN_SPECS = [
    {"name": "compound_train", "window": (1000, 1300),
     "events": [{"at_s": 1055, "kind": "permit_active", "zone": "Z1",
                 "payload": {"permit_type": "hot_work"}},
                {"at_s": 1090, "kind": "worker_pos", "zone": "Z1",
                 "payload": {"worker_count": 4, "x": 12.5, "y": 8.2}},
                {"at_s": 1120, "kind": "shift_change", "zone": "Z1",
                 "payload": {"staffing_delta": -2}}]},
    {"name": "gas_only_train", "window": (2301, 2600), "events": []},
    {"name": "context_only_train", "window": (302, 499),
     "events": [{"at_s": 330, "kind": "permit_active", "zone": "Z1",
                 "payload": {"permit_type": "hot_work"}},
                {"at_s": 360, "kind": "worker_pos", "zone": "Z1",
                 "payload": {"worker_count": 5, "x": 10.0, "y": 6.5}}]},
    {"name": "quiet_train", "window": (601, 699), "events": []},
]
SCENARIO_DIR = Path("sim/scenarios")


def _episode(df, trace, window, events, rng, iforest, scorer):
    """One seeded replay -> per-stride rows + episode-level scores/label/latency."""
    start, end = window
    jit = float(rng.uniform(-30, 30))
    sl = trace[(trace.t_s >= start + jit) & (trace.t_s <= end + jit)]
    chan = [c for c in sl.columns if c.startswith("s") and c != "setpoint_gas1"]
    events = [dict(e, at_s=e["at_s"] + jit + float(rng.uniform(-20, 20)))
              for e in events]
    ctx = [ContextEvent(ts=EPOCH + timedelta(seconds=e["at_s"]), zone=e["zone"],
                        kind=e["kind"], payload=e["payload"]) for e in events]
    g = PlantGraph(DEMO_LAYOUT)
    rows, s_base, s_comp, lat_ms, detect_t = [], 0.0, 0.0, [], None
    t0 = float(sl.t_s.iloc[0])
    pending = sorted(ctx, key=lambda e: e.ts)
    for t in np.arange(t0 + WINDOW_S, float(sl.t_s.iloc[-1]), STRIDE_S):
        w = sl[(sl.t_s > t - WINDOW_S) & (sl.t_s <= t)][chan]
        if len(w) < 2:
            continue
        ts = EPOCH + timedelta(seconds=float(t))
        while pending and pending[0].ts <= ts:
            g.apply_event(pending.pop(0))
        tic = time.perf_counter()
        anom = iforest.score_window(w)
        g.set_gas_slope("Z1", gas_residual_slope(w))
        feats = g.features("Z1", ts, anom)
        comp, _ = scorer.predict(feats) if scorer else (0.0, [])
        lat_ms.append((time.perf_counter() - tic) * 1e3)
        rows.append(feats)
        s_base = max(s_base, anom)
        if comp > s_comp:
            s_comp = comp
        if scorer and detect_t is None and comp >= 0.5:
            detect_t = float(t)
    y = int(any(compound_incident(o, ctx) for o in leak_onsets(sl)))
    crossings = alarm_crossings(sl)
    return {"rows": rows, "y": y, "s_base": s_base, "s_comp": s_comp,
            "lat_ms": lat_ms, "detect_t": detect_t,
            "crossing_t": crossings[0] if crossings else None, "slice": sl,
            "ctx": ctx}


def run(replays: int = 50, out: str = "eval_report.md", seed: int = 42) -> str:
    trace = pd.read_parquet("data/co_1hz.parquet")
    chan = [c for c in trace.columns if c.startswith("s") and c != "setpoint_gas1"]
    iforest = IForestScorer()
    iforest.fit(trace[trace.t_s < TRAIN_END_S][chan].iloc[::10])

    rng = np.random.default_rng(seed)
    # ---- fusion training corpus from EARLY-hours replays (real scenario corpus)
    train_rows, train_y = [], []
    for _ in range(max(replays // 4, 4)):
        for spec in TRAIN_SPECS:
            ep = _episode(None, trace, spec["window"], spec["events"], rng,
                          iforest, scorer=None)
            train_rows += ep["rows"]
            train_y += [ep["y"]] * len(ep["rows"])
    scorer = CompoundScorer()
    scorer.fit(train_rows, train_y)

    # ---- test replays from the frozen scenario YAMLs (late hero window)
    eps = []
    for _ in range(replays):
        for p in sorted(SCENARIO_DIR.glob("*.yaml")):
            scn = yaml.safe_load(p.read_text())
            w = scn["window"]
            ep = _episode(None, trace, (w["start_s"], w["end_s"]),
                          scn.get("events") or [], rng, iforest, scorer)
            ep["name"] = p.stem
            eps.append(ep)

    y = np.array([e["y"] for e in eps])
    s_base = np.array([e["s_base"] for e in eps])
    s_comp = np.array([e["s_comp"] for e in eps])
    tb, tc, prec = operating_point_at_matched_precision(y, s_base, s_comp)

    def _cm(s, t):
        pred = s >= t
        return {"tp": int((pred & (y == 1)).sum()), "fp": int((pred & (y == 0)).sum()),
                "fn": int((~pred & (y == 1)).sum()), "tn": int((~pred & (y == 0)).sum())}
    cm_b, cm_c = _cm(s_base, tb), _cm(s_comp, tc)

    # ---- lead time (minutes) on crossing runs; never-red crossers = FN
    leads = [(e["crossing_t"] - e["detect_t"]) / 60 for e in eps
             if e["crossing_t"] is not None and e["detect_t"] is not None
             and e["detect_t"] <= e["crossing_t"]]
    lead_line = ("no crossing runs detected" if not leads else
                 f"median {np.median(leads):.1f} / p10 {np.percentile(leads, 10):.1f}"
                 f" / p90 {np.percentile(leads, 90):.1f} min over {len(leads)} replays")

    # ---- ablation PR chart
    from sklearn.metrics import precision_recall_curve
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(5, 4))
    for s, label in ((s_base, "fusion OFF (anomaly only)"), (s_comp, "fusion ON (compound)")):
        pr, rc, _ = precision_recall_curve(y, s)
        ax.plot(rc, pr, label=label)
    ax.set_xlabel("recall"); ax.set_ylabel("precision"); ax.legend()
    ax.set_title("Fusion ON/OFF ablation")
    fig.tight_layout(); fig.savefig("eval_pr_curves.png", dpi=120); plt.close(fig)

    lat = np.concatenate([e["lat_ms"] for e in eps])
    caught = cm_b["fn"] - cm_c["fn"]
    report = f"""# Eval report (auto-generated by core/eval/run_eval.py)

Replays: {replays} per scenario x 4 scenarios = {len(eps)} episodes · seed {seed}
Matched precision (guardrail 3): {prec:.2f} at thresholds base={tb:.3f} comp={tc:.3f}
Tuned baseline (guardrail 4): grid search over anomaly-score thresholds on the same replays.

## Confusion matrix, compound vs tuned single-sensor, at matched precision
| system | TP | FP | FN | TN |
|---|---|---|---|---|
| single-sensor (tuned) | {cm_b['tp']} | {cm_b['fp']} | {cm_b['fn']} | {cm_b['tn']} |
| compound (fusion ON) | {cm_c['tp']} | {cm_c['fp']} | {cm_c['fn']} | {cm_c['tn']} |

baseline missed {cm_b['fn']} of {int(y.sum())}; compound caught {caught} of those (FN reduction).

## Lead time before alarm-line crossing (STEL 400)
{lead_line}
(measured only on crossing runs; green-forever runs count as baseline FNs, not finite lead times)

## Fusion ON/OFF ablation
![PR curves](eval_pr_curves.png)

## Scoring latency (tick -> risk score; UI hop lands with Task 9)
p50 {np.percentile(lat, 50):.1f} ms / p95 {np.percentile(lat, 95):.1f} ms

## Confounder check (§5 guardrail 5, mean compound score)
{chr(10).join(f"- {n}: {np.mean([e['s_comp'] for e in eps if e['name'] == n]):.2f}"
              for n in sorted({e['name'] for e in eps}))}

lead-time variance comes from sampling the demo segment, jittering context-event
timing, and choice of escalating run across seeds — no noise is injected into the gas.
"""
    Path(out).write_text(report)
    return report


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--replays", type=int, default=50)
    ap.add_argument("--out", default="eval_report.md")
    ap.add_argument("--seed", type=int, default=42)
    a = ap.parse_args()
    print(run(a.replays, a.out, a.seed))
