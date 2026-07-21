from pathlib import Path

import pandas as pd
import pytest
import yaml

from core.eval.run_eval import _episode


DATA_PATH = Path("data/co_1hz.parquet")


class _ZeroJitter:
    def uniform(self, _low, _high):
        return 0.0


@pytest.mark.skipif(not DATA_PATH.exists(), reason="requires the prepared demo trace")
def test_live_model_reaches_red_for_the_compound_hero():
    from api.feed import fit_live_models, level_for

    trace = pd.read_parquet(DATA_PATH)
    scenario = yaml.safe_load(Path("sim/scenarios/compound.yaml").read_text())
    window = scenario["window"]
    iforest, scorer = fit_live_models(DATA_PATH)

    hero = _episode(
        None,
        trace,
        (window["start_s"], window["end_s"]),
        scenario["events"],
        _ZeroJitter(),
        iforest,
        scorer,
    )

    assert hero["detect_t"] is not None
    assert level_for(hero["s_comp"]) == "red"
