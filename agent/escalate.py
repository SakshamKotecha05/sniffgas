"""Escalation agent — plain SDK tool loop (plan.md §6 Task 9).

Tools: query_kg, get_sensor_window, search_regulation, fire_alert,
generate_report (all strict). Loop ends when fire_alert AND generate_report
have both been called, or 8 turns elapse.
"""
import json

from agent.report import MODEL, TIMEOUT_S

MAX_TURNS = 8
_REQUIRED = {"fire_alert", "generate_report"}

TOOLS = [
    {"type": "function", "function": {
        "name": name, "strict": True,
        "description": desc,
        "parameters": {"type": "object", "properties": {},
                       "additionalProperties": False},
    }}
    for name, desc in [
        ("query_kg", "Query the plant knowledge graph around the alerting zone."),
        ("get_sensor_window", "Fetch the recent sensor window for the alerting zone."),
        ("search_regulation", "Search the regulation corpus for applicable clauses."),
        ("fire_alert", "Publish the evacuation Alert to the alert stream."),
        ("generate_report", "Generate the cited incident report."),
    ]
]


def run_escalation(client, tick, handlers: dict) -> list[str]:
    """Drive the tool loop for one red tick. Returns tool names called."""
    messages = [
        {"role": "system", "content":
            "A methane risk tick has gone red. Investigate with query_kg / "
            "get_sensor_window / search_regulation as needed, then you MUST "
            "call fire_alert and generate_report."},
        {"role": "user", "content": tick.model_dump_json()},
    ]
    called: list[str] = []
    for _ in range(MAX_TURNS):
        msg = client.chat.completions.create(
            model=MODEL, messages=messages, tools=TOOLS,
            timeout=TIMEOUT_S).choices[0].message
        if not msg.tool_calls:
            messages.append({"role": "assistant", "content": msg.content})
            continue
        messages.append({"role": "assistant", "content": msg.content,
                         "tool_calls": [
                             {"id": tc.id, "type": "function",
                              "function": {"name": tc.function.name,
                                           "arguments": tc.function.arguments}}
                             for tc in msg.tool_calls]})
        for tc in msg.tool_calls:
            name = tc.function.name
            result = handlers[name](**(json.loads(tc.function.arguments or "{}") or {}))
            called.append(name)
            messages.append({"role": "tool", "tool_call_id": tc.id,
                             "content": json.dumps(result, default=str)})
        if _REQUIRED <= set(called):
            break
    return called


# --- live E2E spike: `python -m agent.escalate` (needs GROQ_API_KEY in .env) ---
def _load_env(path=".env"):
    import os
    from pathlib import Path
    for line in Path(path).read_text().splitlines():
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


def demo():
    # ponytail: canned query_kg/get_sensor_window handlers; wire real KG/replay
    # feeds when the API gateway (Task 10) owns the streams.
    from datetime import datetime, timezone

    from groq import Groq

    from agent.report import generate_report
    from core.contracts import Alert, Contributor, RiskScore

    _load_env()
    client = Groq()
    clauses = json.load(open("agent/corpus/clauses.json"))
    tick = RiskScore(
        ts=datetime.now(timezone.utc), zone="Z1", anomaly=0.91, compound=0.88,
        level="red",
        contributors=[Contributor(feature="ppm_slope", value=0.9, weight=0.6)],
        subgraph={"nodes": ["Z1", "permit-7"], "edges": [["Z1", "permit-7"]]})
    window = {"zone": "Z1", "window_s": 30, "ppm": [610, 640, 700]}
    out = {}
    handlers = {
        "query_kg": lambda: tick.subgraph,
        "get_sensor_window": lambda: window,
        "search_regulation": lambda: [
            {"id": c["id"], "title": c["title"]} for c in clauses],
        "fire_alert": lambda: out.setdefault("alert", Alert(
            ts=tick.ts, zone=tick.zone, kind="evacuation",
            compound=tick.compound, report_id="rpt-001")) and "alert published",
        "generate_report": lambda: out.setdefault("report", generate_report(
            client, {"tick": tick.model_dump(), "window": window}, clauses)),
    }
    import time
    t0 = time.time()
    called = run_escalation(client, tick, handlers)
    assert _REQUIRED <= set(called), f"loop ended without required tools: {called}"
    assert isinstance(out.get("alert"), Alert)
    assert out.get("report"), "generate_report fell back — no live report"
    print(f"tools called: {called}  ({time.time() - t0:.1f}s)")
    print(f"alert: {out['alert'].model_dump_json()}")
    print(f"structured: {json.dumps(out['report']['structured'])}")
    print(f"narrative:\n{out['report']['narrative']}")


if __name__ == "__main__":
    demo()
