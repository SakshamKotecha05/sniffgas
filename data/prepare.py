"""UCI #322 gas-sensor-array prep: 100 Hz raw -> 1 Hz parquet (data/prepare.py, plan.md Task 2)."""
import sys
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).parent
UCI_ZIP_URL = "https://archive.ics.uci.edu/static/public/322/gas+sensor+array+under+dynamic+gas+mixtures.zip"
RAW_FILES = {
    "co": ("ethylene_CO.txt", "setpoint_gas1"),        # gas1 = CO
    "methane": ("ethylene_methane.txt", "setpoint_gas1"),  # gas1 = methane
}
SENSOR_COLS = [f"s{i:02d}" for i in range(1, 17)]


def download_uci322(zip_path: Path = DATA_DIR / "uci322.zip") -> Path:
    if not zip_path.exists():
        urllib.request.urlretrieve(UCI_ZIP_URL, zip_path)
    for name, _ in RAW_FILES.values():
        if not (DATA_DIR / name).exists():
            with zipfile.ZipFile(zip_path) as zf:
                zf.extract(name, DATA_DIR)
    return zip_path


def parse_mixture_file(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, sep=r"\s+", skiprows=1, header=None, engine="c")
    df.columns = ["t_s", "setpoint_gas1", "setpoint_gas2"] + SENSOR_COLS
    return df


def downsample_1hz(df: pd.DataFrame) -> pd.DataFrame:
    bin_idx = df.t_s.values.astype(np.int64)
    return df.groupby(bin_idx).mean()


def find_quiet_segments(df: pd.DataFrame, min_len_s: int = 30) -> pd.DataFrame:
    """Q3 ethylene filter: windows where setpoint_gas2 (ethylene) is flat/zero,
    so ethylene never fires the anomaly with no CO/methane present."""
    flat = df.setpoint_gas2.diff().fillna(0).eq(0)
    group = (~flat).cumsum()
    segments = []
    for _, seg in df.groupby(group):
        if len(seg) < min_len_s or seg.setpoint_gas2.iloc[0] != 0:
            continue
        segments.append({
            "start_s": seg.t_s.iloc[0],
            "end_s": seg.t_s.iloc[-1],
            "run_type": "quiet" if seg.setpoint_gas1.max() == 0 else "gas_only",
            "max_setpoint_gas1": seg.setpoint_gas1.max(),
        })
    return pd.DataFrame(segments)


def prepare(name: str) -> None:
    raw_name, _ = RAW_FILES[name]
    df = parse_mixture_file(DATA_DIR / raw_name)
    out = downsample_1hz(df)
    out.to_parquet(DATA_DIR / f"{name}_1hz.parquet")
    find_quiet_segments(out).to_parquet(DATA_DIR / f"{name}_segments.parquet")


if __name__ == "__main__":
    download_uci322()
    targets = sys.argv[1:] or list(RAW_FILES)
    for target in targets:
        prepare(target)
