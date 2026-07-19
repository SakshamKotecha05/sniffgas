"""IsolationForest anomaly baseline — the anomaly score of record (plan Task 4, KS-1).

Satisfies AnomalyScorer (plan §3):
    fit(train: pd.DataFrame) -> None          # 1 Hz sensor frame, temporal split
    score_window(window: pd.DataFrame) -> float  # calibrated [0, 1]
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

WINDOW_S = 60  # rolling-feature window, seconds (rows are 1 Hz)


def _features(df: pd.DataFrame, window: int = WINDOW_S) -> pd.DataFrame:
    """Per-sensor rolling mean, std, and Δ over `window` seconds."""
    w = min(window, max(2, len(df) // 2))  # stay usable on short frames
    feats = {}
    for col in df.columns:
        x = df[col].astype(float)
        feats[f"{col}_mean"] = x.rolling(w, min_periods=1).mean()
        feats[f"{col}_std"] = x.rolling(w, min_periods=1).std().fillna(0.0)
        feats[f"{col}_delta"] = (x - x.shift(w)).fillna(0.0)
    return pd.DataFrame(feats, index=df.index)


# Raw mean channel slope during the hero climb peaks around ~SLOPE_SCALE units/s;
# dividing then clipping puts the KG feature in the [0, 1] band the fusion layer
# was designed for (see core/fusion.py `_seed_corpus`, agent/escalate.py feeds 0.9).
SLOPE_SCALE = 5.0


def gas_residual_slope(window: pd.DataFrame) -> float:
    """Rising-gas evidence in [0, 1] — KG feature input (§3 `gas_residual_slope`).

    Mean per-second slope across sensor channels, rectified (falling gas is not
    leak evidence) and normalized by SLOPE_SCALE. Setpoint columns must be
    excluded by the caller (ADR 0001/0002 anti-circularity)."""
    slopes = [np.polyfit(np.arange(len(window)), window[c].astype(float), 1)[0]
              for c in window.columns]
    return float(np.clip(max(np.mean(slopes), 0.0) / SLOPE_SCALE, 0.0, 1.0))


class IForestScorer:
    def __init__(self, n_estimators: int = 200, random_state: int = 0):
        self._model = IsolationForest(n_estimators=n_estimators,
                                      random_state=random_state)
        self._lo: float | None = None
        self._hi: float | None = None

    def fit(self, train: pd.DataFrame) -> None:
        X = _features(train)
        self._model.fit(X)
        # Min-max calibration bounds from the (temporal-split) training scores.
        raw = -self._model.score_samples(X)  # higher = more anomalous
        self._lo, self._hi = float(raw.min()), float(raw.max())

    def score_window(self, window: pd.DataFrame) -> float:
        if self._lo is None:
            raise RuntimeError("IForestScorer.score_window called before fit()")
        raw = -self._model.score_samples(_features(window))
        span = (self._hi - self._lo) or 1.0
        calibrated = np.clip((raw - self._lo) / span, 0.0, 1.0)
        return float(calibrated.mean())
