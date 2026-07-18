"""Tiny factories reusing the frozen contracts."""
from datetime import datetime, timezone

from core.contracts import Contributor, RiskScore


def make_risk_score(**overrides) -> RiskScore:
    base = dict(
        ts=datetime.now(timezone.utc), zone="Z1", anomaly=0.5, compound=0.5,
        level="amber",
        contributors=[Contributor(feature="gas_residual_slope", value=0.9, weight=0.4)],
        subgraph={"nodes": [], "edges": []},
    )
    base.update(overrides)
    return RiskScore(**base)
