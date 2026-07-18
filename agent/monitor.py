"""Escalation gate (Q11 — gutted): pure comparison, no per-tick LLM call."""
from core.contracts import RiskScore


def should_escalate(tick: RiskScore) -> bool:
    return tick.level == "red"
