"""Cited incident report — two Groq calls kept separate (plan.md §6 Task 9).

Call 1: 70B narrative, corpus clauses inlined with stable ids, model cites
[fa-41b]-style ids. Every cited id is verified against the corpus; an unknown
id triggers ONE regeneration, then the cached fallback.
Call 2: 70B JSON-mode structured output, validated with pydantic.

D3 spike findings (FS): TODO — pin citation prompt + extraction regex from a
real Groq call against the drafted corpus; record model pricing/limits here.
"""
import json
import re

from pydantic import BaseModel

CITE_RE = re.compile(r"\[([a-z0-9-]+)\]")
MODEL = "llama-3.3-70b-versatile"  # pin against Groq console at D3 spike
TIMEOUT_S = 10  # hard timeout; on breach the caller serves the cached report


class StructuredReport(BaseModel):
    zone: str
    permit_ids: list[str]
    clause_ids: list[str]
    actions: list[str]
    timeline: list[str]


def _chat(client, messages, **kwargs):
    resp = client.chat.completions.create(
        model=MODEL, messages=messages, timeout=TIMEOUT_S, **kwargs)
    return resp.choices[0].message.content


def _narrative(client, ctx, clauses):
    inlined = "\n".join(f"[{c['id']}] {c['title']}: {c['text']}" for c in clauses)
    return _chat(client, [
        {"role": "system", "content":
            "You are an industrial-safety compliance reporter. Cite ONLY the "
            "clause ids supplied below, in square brackets like [fa-41b]. "
            "Never invent ids.\n\nClauses:\n" + inlined},
        {"role": "user", "content": f"Incident context: {json.dumps(ctx, default=str)}"},
    ])


def generate_report(client, ctx: dict, clauses: list[dict],
                    fallback: dict | None = None) -> dict:
    """Return {"narrative": str, "structured": dict}. On unverifiable citations
    (after one regeneration) or any Groq failure, return `fallback` (Q12)."""
    known = {c["id"] for c in clauses}
    try:
        narrative = _narrative(client, ctx, clauses)
        if not set(CITE_RE.findall(narrative)) <= known:
            narrative = _narrative(client, ctx, clauses)  # regenerate once
            if not set(CITE_RE.findall(narrative)) <= known:
                return fallback
        raw = _chat(client, [
            {"role": "system", "content":
                "Return ONLY a JSON object with keys zone, permit_ids, "
                "clause_ids, actions, timeline (all lists of strings except "
                "zone). clause_ids must come from: " + ", ".join(sorted(known))},
            {"role": "user", "content":
                f"Context: {json.dumps(ctx, default=str)}\nNarrative:\n{narrative}"},
        ], response_format={"type": "json_object"})
        structured = StructuredReport.model_validate_json(raw)
    except Exception:  # ponytail: any live-path failure -> cached demo report (Q12)
        return fallback
    return {"narrative": narrative, "structured": structured.model_dump()}
