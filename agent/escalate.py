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
