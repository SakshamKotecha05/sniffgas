"""API gateway (Task 10): WS /live pushing RiskScore/Alert JSON verbatim,
GET /reports/{id}, static-serves web/dist as Vercel fallback."""
import asyncio
import copy
import json
import os
import threading
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI()

# ponytail: in-memory report store; swap for Redis if the gateway ever restarts mid-demo
REPORTS: dict[str, dict] = {}

# (event loop, queue) per connected client — loop captured so sync producers
# (replay thread, escalation loop) can push thread-safely.
_clients: list[tuple[asyncio.AbstractEventLoop, asyncio.Queue]] = []


def push_risk_score(model: BaseModel) -> None:
    """Broadcast a RiskScore/Alert to every /live client. Thread-safe."""
    data = model.model_dump_json()
    for loop, q in list(_clients):
        loop.call_soon_threadsafe(q.put_nowait, data)


_last_level: dict[str, str] = {}  # zone -> last seen level, for red-crossing detection

_CORPUS = Path(__file__).parent.parent / "agent" / "corpus" / "clauses.json"
_REHEARSAL_REPORTS = Path(__file__).parent.parent / "agent" / "corpus" / "rehearsal_reports.json"


def rehearsal_report_for(zone: str) -> dict | None:
    """Return the cited rehearsal report for a configured demo zone, if any."""
    try:
        report = json.loads(_REHEARSAL_REPORTS.read_text()).get(zone)
    except (OSError, json.JSONDecodeError):
        return None
    return copy.deepcopy(report) if isinstance(report, dict) else None


def _upgrade_report(rid, score, *, gen=None) -> None:
    """Best-effort: replace the canned report with agent/report.py's two-call cited
    one. Any failure (no key, timeout, unverifiable citation) leaves the canned
    report in place (plan.md §8 fallback). Runs off-thread so a slow Groq call never
    blocks the evacuation alert. `gen(ctx, clauses, fallback)` is injectable for tests."""
    if gen is None:
        if not os.environ.get("GROQ_API_KEY"):
            return
        from groq import Groq

        from agent.report import generate_report
        client = Groq()
        gen = lambda ctx, clauses, fb: generate_report(client, ctx, clauses, fallback=fb)
    try:
        clauses = json.loads(_CORPUS.read_text())
        ctx = {"zone": score.zone, "ts": score.ts.isoformat(), "compound": score.compound,
               "level": score.level, "state": score.state, "ppm": score.ppm,
               "contributors": [c.model_dump() for c in score.contributors]}
        live = gen(ctx, clauses, None)
        if live:  # None on any failure -> canned report stays put
            REPORTS[rid] = {**live, "subgraph": score.subgraph}
    except Exception:  # ponytail: live-path failure keeps the canned report (Q12)
        pass


def push_with_alerts(score) -> None:
    """push_risk_score + fire one evacuation Alert per crossing into red."""
    from core.contracts import Alert  # deferred like start_feed: keeps imports light

    push_risk_score(score)
    prev, _last_level[score.zone] = _last_level.get(score.zone, "green"), score.level
    if score.level != "red" or prev == "red":
        return
    rid = f"rpt-{score.zone}-{score.ts:%H%M%S}"
    top = sorted(score.contributors, key=lambda c: abs(c.weight), reverse=True)[:5]
    # Canned report + alert fire immediately (instant, always available); the live
    # cited report then upgrades REPORTS[rid] off-thread, falling back to this canned
    # copy on any failure. So GET /reports/{id} always resolves, live or not.
    fallback = {
        "structured": {"zone": score.zone, "ts": score.ts.isoformat(),
                       "compound": score.compound, "severity": "high"},
        "narrative": (
            f"Evacuation response recommendation for zone {score.zone} at {score.ts:%H:%M:%S}: "
            f"compound risk {score.compound:.2f} crossed the red threshold. "
            "Top contributors: "
            + "; ".join(f"{c.feature}={c.value:.2f} (w {c.weight:+.2f})" for c in top)
        ),
        "subgraph": score.subgraph,
    }
    rehearsal = rehearsal_report_for(score.zone)
    REPORTS[rid] = {**(rehearsal or fallback), "subgraph": score.subgraph}
    push_risk_score(Alert(ts=score.ts, zone=score.zone, kind="evacuation",
                          compound=score.compound, report_id=rid))
    # plan.md §6 Task 9/Q12: recorded demo runs use a rehearsal-cached report;
    # unknown zones retain the best-effort live upgrade with the safe fallback.
    if rehearsal is None:
        threading.Thread(target=_upgrade_report, args=(rid, score), daemon=True).start()


@app.websocket("/live")
async def live(ws: WebSocket) -> None:
    await ws.accept()
    pair = (asyncio.get_running_loop(), asyncio.Queue())
    _clients.append(pair)
    try:
        while True:
            await ws.send_text(await pair[1].get())
    except WebSocketDisconnect:
        pass
    finally:
        _clients.remove(pair)


@app.get("/reports/{report_id}")
def get_report(report_id: str) -> dict:
    if report_id not in REPORTS:
        raise HTTPException(404, f"no report {report_id}")
    return REPORTS[report_id]


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}


_dist = Path(__file__).parent.parent / "web" / "dist"
if _dist.is_dir():  # Vercel fallback: serve the built dashboard if present
    app.mount("/", StaticFiles(directory=_dist, html=True), name="web")


if __name__ == "__main__":  # `python -m api.main` — demo runner: gateway + fusion feed
    import uvicorn

    from api.feed import start_feed  # deferred: keeps TestClient imports sklearn-free

    threading.Thread(target=start_feed, args=(push_with_alerts,), daemon=True).start()
    uvicorn.run(app, host="0.0.0.0", port=8000)
