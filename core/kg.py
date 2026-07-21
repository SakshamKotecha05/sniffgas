"""Knowledge graph feature engine (plan Task 5, §3).

NetworkX in-process — a feature engine, not the on-stage wow (plan Q: Neo4j → NetworkX).
Nodes: zones, sensors, ignition sources, permits, worker groups.
Edges: containment + proximity. Coordinates are floor-plan pixel space (shared with WEB, D2).

Satisfies §3 `PlantGraph`:
    __init__(layout: dict)
    apply_event(ev: ContextEvent) -> None
    features(zone: str, ts: datetime, anomaly: float) -> dict[str, float]
    subgraph(zone: str) -> dict          # {"nodes": [...], "edges": [...]} for drill-down

features() keys (FROZEN with contracts): anomaly, gas_residual_slope, hot_work_active,
maintenance_in_zone, shift_changeover, worker_count_in_zone, ignition_within_2_hops.
"""
from datetime import datetime, timedelta

import networkx as nx

from core.contracts import ContextEvent

# How long after a shift_change event the changeover window stays hot.
SHIFT_CHANGEOVER_WINDOW_S = 15 * 60

# Demo plant layout — coordinates in floor-plan pixel space (shared with WEB on D2).
DEMO_LAYOUT: dict = {
    "nodes": [
        # zones
        {"id": "Z1", "type": "zone", "label": "Coke Oven Battery", "x": 220, "y": 160},
        {"id": "Z2", "type": "zone", "label": "Blast Furnace", "x": 520, "y": 160},
        {"id": "Z3", "type": "zone", "label": "Casting Bay", "x": 820, "y": 200},
        # sensors (one gauge tick per zone; s-channels feed the anomaly model)
        {"id": "sen-Z1", "type": "sensor", "label": "CO sensor Z1", "x": 250, "y": 110},
        {"id": "sen-Z2", "type": "sensor", "label": "CO sensor Z2", "x": 550, "y": 110},
        {"id": "sen-Z3", "type": "sensor", "label": "CO sensor Z3", "x": 850, "y": 150},
        # static ignition sources
        {"id": "ign-welding-bay", "type": "ignition", "label": "Welding bay", "x": 380, "y": 300},
        {"id": "ign-furnace-mouth", "type": "ignition", "label": "Furnace mouth", "x": 640, "y": 320},
        # worker groups
        {"id": "crew-A", "type": "worker_group", "label": "Crew A", "x": 180, "y": 240},
        {"id": "crew-B", "type": "worker_group", "label": "Crew B", "x": 760, "y": 260},
    ],
    "edges": [
        # containment
        ["Z1", "sen-Z1"], ["Z2", "sen-Z2"], ["Z3", "sen-Z3"],
        ["Z1", "crew-A"], ["Z3", "crew-B"],
        # proximity
        ["Z1", "Z2"], ["Z2", "Z3"],
        ["Z1", "ign-welding-bay"], ["Z2", "ign-welding-bay"],
        ["Z2", "ign-furnace-mouth"], ["Z3", "ign-furnace-mouth"],
    ],
}


class PlantGraph:
    def __init__(self, layout: dict):
        self._g = nx.Graph()
        for node in layout["nodes"]:
            attrs = {k: v for k, v in node.items() if k != "id"}
            self._g.add_node(node["id"], **attrs)
        for a, b in layout["edges"]:
            self._g.add_edge(a, b)
        # Mutable per-zone state driven by ContextEvents.
        self._hot_work: dict[str, bool] = {}
        self._maintenance: dict[str, bool] = {}
        self._worker_count: dict[str, float] = {}
        self._last_shift_change: dict[str, datetime] = {}
        self._gas_slope: dict[str, float] = {}

    # -- state mutation -----------------------------------------------------
    def apply_event(self, ev: ContextEvent) -> None:
        if ev.kind == "permit_active":
            if ev.payload.get("permit_type") == "hot_work":
                self._hot_work[ev.zone] = True
                self._set_permit_node(ev.zone, active=True)
        elif ev.kind == "permit_closed":
            if ev.payload.get("permit_type", "hot_work") == "hot_work":
                self._hot_work[ev.zone] = False
                self._set_permit_node(ev.zone, active=False)
        elif ev.kind == "maintenance_start":
            self._maintenance[ev.zone] = True
        elif ev.kind == "maintenance_end":
            self._maintenance[ev.zone] = False
        elif ev.kind == "shift_change":
            self._last_shift_change[ev.zone] = ev.ts
        elif ev.kind == "worker_pos":
            self._worker_count[ev.zone] = float(ev.payload.get("worker_count", 0))

    def set_gas_slope(self, zone: str, value: float) -> None:
        """Fed from core.anomaly.baseline.gas_residual_slope on each window."""
        self._gas_slope[zone] = float(value)

    def _set_permit_node(self, zone: str, active: bool) -> None:
        node_id = f"permit-hot-work-{zone}"
        if active:
            zx = self._g.nodes[zone].get("x", 0)
            zy = self._g.nodes[zone].get("y", 0)
            self._g.add_node(node_id, type="permit", label=f"Hot-work permit {zone}",
                             x=zx + 30, y=zy + 40)
            self._g.add_edge(zone, node_id)
        elif self._g.has_node(node_id):
            self._g.remove_node(node_id)

    # -- feature extraction -------------------------------------------------
    def features(self, zone: str, ts: datetime, anomaly: float) -> dict[str, float]:
        return {
            "anomaly": float(anomaly),
            "gas_residual_slope": self._gas_slope.get(zone, 0.0),
            "hot_work_active": 1.0 if self._hot_work.get(zone) else 0.0,
            "maintenance_in_zone": 1.0 if self._maintenance.get(zone) else 0.0,
            "shift_changeover": self._shift_changeover(zone, ts),
            "worker_count_in_zone": self._worker_count.get(zone, 0.0),
            "ignition_within_2_hops": self._ignition_within(zone, hops=2),
        }

    def _shift_changeover(self, zone: str, ts: datetime) -> float:
        last = self._last_shift_change.get(zone)
        if last is None:
            return 0.0
        return 1.0 if ts - last <= timedelta(seconds=SHIFT_CHANGEOVER_WINDOW_S) else 0.0

    def _ignition_within(self, zone: str, hops: int) -> float:
        if zone not in self._g:
            return 0.0
        reachable = nx.single_source_shortest_path_length(self._g, zone, cutoff=hops)
        for node_id in reachable:
            if self._g.nodes[node_id].get("type") in ("ignition", "permit"):
                return 1.0
        return 0.0

    # -- drill-down ---------------------------------------------------------
    def subgraph(self, zone: str) -> dict:
        """2-hop neighborhood around `zone` for the "why red" drill-down."""
        if zone not in self._g:
            return {"nodes": [], "edges": []}
        keep = nx.single_source_shortest_path_length(self._g, zone, cutoff=2)
        sg = self._g.subgraph(keep)
        nodes = [{"id": n, **sg.nodes[n]} for n in sg.nodes]
        edges = [{"source": a, "target": b} for a, b in sg.edges]
        return {"nodes": nodes, "edges": edges}
