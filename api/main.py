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
