"""API gateway (Task 10): WS /live pushing RiskScore/Alert JSON verbatim,
GET /reports/{id}, static-serves web/dist as Vercel fallback."""
import asyncio
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


def push_with_alerts(score) -> None:
    """push_risk_score + fire one evacuation Alert per crossing into red."""
    from core.contracts import Alert  # deferred like start_feed: keeps imports light

    push_risk_score(score)
    prev, _last_level[score.zone] = _last_level.get(score.zone, "green"), score.level
    if score.level != "red" or prev == "red":
        return
    rid = f"rpt-{score.zone}-{score.ts:%H%M%S}"
    top = sorted(score.contributors, key=lambda c: abs(c.weight), reverse=True)[:5]
    # ponytail: canned report from the score itself; swap for agent/report.py's
    # two-call cited generation when the demo box has GROQ_API_KEY wired here.
    REPORTS[rid] = {
        "structured": {"zone": score.zone, "ts": score.ts.isoformat(),
                       "compound": score.compound, "severity": "high"},
        "narrative": (
            f"Evacuation ordered for zone {score.zone} at {score.ts:%H:%M:%S}: "
            f"compound risk {score.compound:.2f} crossed the red threshold. "
            "Top contributors: "
            + "; ".join(f"{c.feature}={c.value:.2f} (w {c.weight:+.2f})" for c in top)
        ),
        "subgraph": score.subgraph,
    }
    push_risk_score(Alert(ts=score.ts, zone=score.zone, kind="evacuation",
                          compound=score.compound, report_id=rid))


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
    import threading

    import uvicorn

    from api.feed import start_feed  # deferred: keeps TestClient imports sklearn-free

    threading.Thread(target=start_feed, args=(push_with_alerts,), daemon=True).start()
    uvicorn.run(app, host="0.0.0.0", port=8000)
