# ETHackathon — Industrial Safety: Methane/CO Compound-Risk Monitoring

Compound-risk scoring over the UCI #322 gas sensor dataset: real gas dynamics
(untouched, ADR 0001) fused with plant-context events (permits, maintenance,
shift changes, worker position) via a `PlantGraph` KG feature engine and an
IForest anomaly baseline.

- Plan / source of truth: `plan.md` + `docs/adr/`
- Eval labels: `core/eval/labels.py` (pre-registered, §3/§5)

## Frozen artifacts

| Artifact | Frozen | sha256 |
|---|---|---|
| `core/eval/labels.py` (D3 label freeze, commit `6fbc6a6`) | 2026-07-09 | `2f35376b1406cb02923f8bd3e2280d57976304a410fcdbfc6f5fc957ef52bee7` |

Labels were frozen **before** any model tuning against them (anti-circularity
guardrail, ADR 0001). Verify with:

```sh
shasum -a 256 core/eval/labels.py
```
