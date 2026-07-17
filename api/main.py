"""FastAPI gateway stub — fleshed out in Task 10 (WS push, /reports/{id}, static fallback)."""
from fastapi import FastAPI

app = FastAPI()


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}
