from pathlib import Path

import yaml


def test_compose_forwards_optional_groq_key_to_app():
    compose = yaml.safe_load((Path(__file__).parents[1] / "docker-compose.yml").read_text())

    assert "GROQ_API_KEY=${GROQ_API_KEY:-}" in compose["services"]["app"]["environment"]


def test_compose_keeps_the_demo_to_app_and_redis_services():
    compose = yaml.safe_load((Path(__file__).parents[1] / "docker-compose.yml").read_text())

    assert set(compose["services"]) == {"app", "redis"}
    assert "python -m sim.replay --scenario sim/scenarios/compound.yaml" in (
        compose["services"]["app"]["command"]
    )


def test_demo_keeps_redis_on_the_internal_compose_network():
    compose = yaml.safe_load((Path(__file__).parents[1] / "docker-compose.yml").read_text())

    assert "ports" not in compose["services"]["redis"]


def test_docker_build_context_excludes_env_files():
    patterns = set((Path(__file__).parents[1] / ".dockerignore").read_text().splitlines())

    assert ".env" in patterns
    assert ".env.*" in patterns


def test_readme_evaluation_curve_is_not_excluded_from_submission():
    ignored = set((Path(__file__).parents[1] / ".gitignore").read_text().splitlines())

    assert "eval_pr_curves.png" not in ignored
