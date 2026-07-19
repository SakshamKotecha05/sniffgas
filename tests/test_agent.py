# tests/test_agent.py — should_escalate is a pure comparison now (Q11); no mock needed
from datetime import datetime, timezone
from core.contracts import RiskScore
from agent.monitor import should_escalate

def _rs(level, compound):
    return RiskScore(ts=datetime.now(timezone.utc), zone="Z1", anomaly=0.4,
                     compound=compound, level=level, contributors=[], subgraph={})

def test_only_red_escalates():
    assert should_escalate(_rs("red", 0.88)) is True
    assert should_escalate(_rs("amber", 0.6)) is False
    assert should_escalate(_rs("green", 0.2)) is False


# --- report.py: two-call strategy, citations verified against corpus ---
import json

CLAUSES = [{"id": "fa-41b", "title": "Factories Act 1948 §41B", "text": "…",
            "source_url": "https://www.indiacode.nic.in/handle/123456789/1530",
            "retrieved": "2026-07-08", "checked_by": "FS"}]

STRUCTURED = {"zone": "Z1", "permit_ids": [], "clause_ids": ["fa-41b"],
              "actions": ["evacuate Z1"], "timeline": ["00:00 leak onset"]}


class _FakeGroq:
    """Mimics groq client chat.completions.create; pops canned replies."""
    def __init__(self, replies):
        self._replies = list(replies)
        self.calls = 0
        self.chat = self
        self.completions = self

    def create(self, **kwargs):
        self.calls += 1
        content = self._replies.pop(0)
        msg = type("M", (), {"content": content, "tool_calls": None})
        choice = type("C", (), {"message": msg})
        return type("R", (), {"choices": [choice]})


def test_report_cites_only_corpus_ids():
    from agent.report import generate_report
    client = _FakeGroq(["Methane breach in Z1 violates [fa-41b].",
                        json.dumps(STRUCTURED)])
    rpt = generate_report(client, {"zone": "Z1"}, CLAUSES)
    assert "[fa-41b]" in rpt["narrative"]
    assert rpt["structured"]["clause_ids"] == ["fa-41b"]
    assert client.calls == 2  # narrative + JSON-mode, no regeneration


# --- corpus: drafted clauses parse and match the schema report.py inlines ---
def test_corpus_schema():
    from pathlib import Path
    clauses = json.loads(
        (Path(__file__).parent.parent / "agent" / "corpus" / "clauses.json")
        .read_text())
    assert clauses, "corpus must not be empty"
    keys = {"id", "title", "text", "source_url", "retrieved", "checked_by"}
    assert all(set(c) == keys for c in clauses)
    ids = [c["id"] for c in clauses]
    assert len(ids) == len(set(ids)), "clause ids must be unique"
    assert "fa-41b" in ids  # id cited in report.py prompt example


# --- the payoff panel's ₹ figures must resolve against the same corpus (§8) ---
def test_payoff_panel_citations_resolve():
    import re
    from pathlib import Path
    root = Path(__file__).parent.parent
    clauses = json.loads((root / "agent" / "corpus" / "clauses.json").read_text())
    ids = {c["id"] for c in clauses}
    panel = (root / "web" / "src" / "PayoffPanel.tsx").read_text()
    cited = set(re.findall(r'cite:\s*"([^"]+)"', panel))
    assert cited, "ROI figures must carry clause ids"
    assert cited <= ids, f"unresolvable citations: {cited - ids}"


# --- escalate.py: SDK tool loop, ends when fire_alert+generate_report done ---
def _tool_reply(name):
    fn = type("F", (), {"name": name, "arguments": "{}"})
    tc = type("T", (), {"id": f"call-{name}", "type": "function", "function": fn})
    msg = type("M", (), {"content": None, "tool_calls": [tc]})
    choice = type("C", (), {"message": msg})
    return type("R", (), {"choices": [choice]})


class _FakeGroqTools:
    def __init__(self, replies):
        self._replies = list(replies)
        self.calls = 0
        self.chat = self
        self.completions = self

    def create(self, **kwargs):
        self.calls += 1
        return self._replies.pop(0)


def test_escalate_ends_when_alert_and_report_done():
    from agent.escalate import run_escalation
    client = _FakeGroqTools([_tool_reply("fire_alert"),
                             _tool_reply("generate_report")])
    called = []
    handlers = {n: (lambda n=n: called.append(n) or "ok") for n in
                ["query_kg", "get_sensor_window", "search_regulation",
                 "fire_alert", "generate_report"]}
    run_escalation(client, _rs("red", 0.88), handlers)
    assert called == ["fire_alert", "generate_report"]
    assert client.calls == 2
