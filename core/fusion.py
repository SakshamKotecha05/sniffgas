"""Compound fusion — model of record (plan Task 7, §3 CompoundScorer, D6).

Logistic regression with explicit interaction terms and sign-constrained
(nonnegative) coefficients on all monotone features → monotone in every input
by construction. Platt-calibrated. Right-sized for ~74 positives / 7 features.
LightGBM is stretch/ablation only (Q8) and is deliberately NOT here.

Training corpus: Task 3's scenario YAMLs (sim/scenarios/*.yaml) do not exist
yet, so `train_demo_scorer` seeds samples from the four frozen scenario
archetypes (compound / gas_only / context_only / quiet) labeled by the Task 6
conjunction rule: positive iff gas anomaly AND hazardous context co-occur.
When Task 3 lands, swap `_seed_corpus` to consume the YAMLs — the archetype
shapes below mirror them (hero: permit_active + worker_pos(4) + shift_change
landing during the green 280 ppm climb).
"""
import numpy as np
from scipy.optimize import minimize

from core.contracts import Contributor

# Frozen feature order — must match PlantGraph.features() keys (§3, Task 5).
FEATURES = [
    "anomaly",
    "gas_residual_slope",
    "hot_work_active",
    "maintenance_in_zone",
    "shift_changeover",
    "worker_count_in_zone",
    "ignition_within_2_hops",
]

# Declared interaction structure — the compound thesis in model form.
INTERACTIONS = [
    ("anomaly", "hot_work_active"),
    ("anomaly", "worker_count_in_zone"),
    ("gas_residual_slope", "shift_changeover"),
]

_L2 = 1e-2  # small ridge — 10 coefs on ~250 rows


def _design_row(f: dict[str, float]) -> np.ndarray:
    x = [float(f.get(k, 0.0)) for k in FEATURES]
    x += [float(f.get(a, 0.0)) * float(f.get(b, 0.0)) for a, b in INTERACTIONS]
    return np.array(x)


def _sigmoid(z: np.ndarray | float) -> np.ndarray | float:
    return 1.0 / (1.0 + np.exp(-np.clip(z, -30, 30)))


class CompoundScorer:
    """§3 CompoundScorer: fit(features, labels) → predict(feature dict) → (compound, contributors)."""

    def __init__(self) -> None:
        self._w: np.ndarray | None = None   # nonneg coefs, len(FEATURES)+len(INTERACTIONS)
        self._b: float = 0.0                # unconstrained intercept
        self._a: float = 1.0                # Platt slope (constrained > 0)
        self._c: float = 0.0                # Platt offset

    # -- training -----------------------------------------------------------
    def fit(self, rows: list[dict[str, float]], y: list[int]) -> None:
        X = np.stack([_design_row(r) for r in rows])
        yv = np.asarray(y, dtype=float)
        n, d = X.shape

        def loss(theta: np.ndarray) -> float:
            w, b = theta[:d], theta[d]
            p = _sigmoid(X @ w + b)
            ll = -np.mean(yv * np.log(p + 1e-12) + (1 - yv) * np.log(1 - p + 1e-12))
            return ll + _L2 * float(w @ w)

        bounds = [(0.0, None)] * d + [(None, None)]   # sign constraint → monotone
        res = minimize(loss, np.zeros(d + 1), method="L-BFGS-B", bounds=bounds)
        self._w, self._b = res.x[:d], float(res.x[d])
        self._fit_platt(X @ self._w + self._b, yv)

    def _fit_platt(self, z: np.ndarray, y: np.ndarray) -> None:
        """Platt (1999) sigmoid on the margin; slope bounded > 0 to preserve monotonicity."""
        t = (y * (y.sum() + 1) / (y.sum() + 2)) + ((1 - y) / ((1 - y).sum() + 2))

        def loss(theta: np.ndarray) -> float:
            p = _sigmoid(theta[0] * z + theta[1])
            return -np.mean(t * np.log(p + 1e-12) + (1 - t) * np.log(1 - p + 1e-12))

        res = minimize(loss, np.array([1.0, 0.0]), method="L-BFGS-B",
                       bounds=[(1e-6, None), (None, None)])
        self._a, self._c = float(res.x[0]), float(res.x[1])

    # -- inference ----------------------------------------------------------
    def predict(self, features: dict[str, float]) -> tuple[float, list[Contributor]]:
        if self._w is None:
            raise RuntimeError("CompoundScorer.predict called before fit()")
        x = _design_row(features)
        compound = float(_sigmoid(self._a * (x @ self._w + self._b) + self._c))
        return compound, self._contributors(features, x)

    def _contributors(self, features: dict[str, float], x: np.ndarray) -> list[Contributor]:
        """Per-feature signed log-odds contribution (× Platt slope). Interaction
        contributions are split half/half onto their constituent features so
        `Contributor.feature` stays within the frozen features() keys (§3)."""
        contrib = {k: self._a * self._w[i] * x[i] for i, k in enumerate(FEATURES)}
        for j, (fa, fb) in enumerate(INTERACTIONS):
            c = self._a * self._w[len(FEATURES) + j] * x[len(FEATURES) + j]
            contrib[fa] += c / 2
            contrib[fb] += c / 2
        out = [Contributor(feature=k, value=float(features.get(k, 0.0)), weight=float(v))
               for k, v in contrib.items()]
        return sorted(out, key=lambda c: c.weight, reverse=True)


# -- seeded demo corpus (stand-in for Task 3 YAML replays; see module docstring) --
def _seed_corpus(rng: np.random.Generator,
                 n_pos: int = 74, n_neg_each: int = 60) -> tuple[list[dict], list[int]]:
    rows, y = [], []

    def sample(anom_hi: bool, ctx_hi: bool) -> dict[str, float]:
        anom = rng.uniform(0.30, 0.95) if anom_hi else rng.uniform(0.0, 0.15)
        slope = rng.uniform(0.15, 0.80) if anom_hi else rng.uniform(0.0, 0.08)
        if ctx_hi:
            ctx = {"hot_work_active": 1.0,
                   "maintenance_in_zone": float(rng.random() < 0.5),
                   "shift_changeover": float(rng.random() < 0.7),
                   "worker_count_in_zone": float(rng.integers(2, 7)),
                   "ignition_within_2_hops": 1.0}
        else:
            ctx = {"hot_work_active": 0.0, "maintenance_in_zone": float(rng.random() < 0.1),
                   "shift_changeover": 0.0, "worker_count_in_zone": float(rng.integers(0, 2)),
                   "ignition_within_2_hops": 0.0}
        return {"anomaly": anom, "gas_residual_slope": slope, **ctx}

    for _ in range(n_pos):                     # compound.yaml — conjunction → 1
        rows.append(sample(True, True)); y.append(1)
    for _ in range(n_neg_each):                # gas_only.yaml — leak, empty zone → 0
        rows.append(sample(True, False)); y.append(0)
    for _ in range(n_neg_each):                # context_only.yaml — busy zone, no gas → 0
        rows.append(sample(False, True)); y.append(0)
    for _ in range(n_neg_each):                # quiet.yaml — nothing → 0
        rows.append(sample(False, False)); y.append(0)
    return rows, y


def train_demo_scorer(seed: int = 42) -> CompoundScorer:
    rows, y = _seed_corpus(np.random.default_rng(seed))
    s = CompoundScorer()
    s.fit(rows, y)
    return s
