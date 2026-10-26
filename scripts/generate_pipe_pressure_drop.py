#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 UK Research and Innovation (UKRI)
"""Generate a synthetic, physically-informed pipe pressure-drop dataset.

This produces the bundled Explore-mode demonstration dataset
``examples/pipe_pressure_drop_sample.csv``. It is a **training demonstration
dataset only** — it is synthetic, not experimental, and must not be treated as
validated, safety-grade, or design-quality engineering data.

Governing physics (Darcy–Weisbach)
----------------------------------
The pressure drop of fully-developed, single-phase, incompressible flow in a
straight circular pipe is modelled with the Darcy–Weisbach equation:

    Δp = f · (L / D) · (ρ · v² / 2)                                   [Pa]

where
    Δp = pressure drop                         [Pa]  (reported in kPa)
    f  = Darcy friction factor                 [-]
    L  = pipe length                           [m]
    D  = internal pipe diameter                [m]
    ρ  = fluid density                         [kg/m³]
    v  = mean flow velocity                    [m/s]

The friction factor depends on the Reynolds number and the relative roughness:

    Re    = ρ · v · D / μ                       [-]      (μ = dynamic viscosity)
    ε/D   = relative roughness                  [-]      (ε held constant here)

    * Laminar flow (Re < 2300):  f = 64 / Re                (Hagen–Poiseuille)
    * Turbulent flow (Re ≥ 2300): explicit Haaland approximation

        1 / sqrt(f) = -1.8 · log10[ (ε/D / 3.7)^1.11 + 6.9 / Re ]

Assumptions and simplifications
-------------------------------
* Fully-developed, steady, single-phase, incompressible, Newtonian flow.
* Straight, constant-diameter, circular pipe; no fittings, bends, or entrance
  losses; no elevation change (friction losses only).
* Absolute wall roughness is held constant at ε = 0.045 mm (typical commercial
  steel); relative roughness therefore varies only through D and is NOT an input
  feature. Roughness is documented, not modelled as a variable.
* The laminar/turbulent transition is modelled as a hard switch at Re = 2300.
  Real transitional flow (roughly 2300 < Re < 4000) is not modelled in detail;
  this simplification introduces a small, deliberate kink that a flexible model
  can capture but a single linear fit cannot — useful for teaching.
* Modest multiplicative noise (see below) represents combined measurement and
  modelling scatter; it keeps every value strictly positive.

Noise model
-----------
Each pressure drop is multiplied by ``exp(N(0, sigma))`` (a lognormal factor,
default sigma = 0.05, i.e. ~5% relative scatter). Multiplicative noise is
realistic for a positive quantity and cannot produce negative pressure drops.

Determinism
-----------
Sampling uses ``numpy.random.default_rng(seed)`` with a fixed seed (default 42),
so the dataset is reproducible: rerunning with the same seed, row count, and
numpy version produces byte-identical output.

Usage
-----
    python3 scripts/generate_pipe_pressure_drop.py                 # default output
    python3 scripts/generate_pipe_pressure_drop.py --rows 500 --seed 42
    python3 scripts/generate_pipe_pressure_drop.py --out /tmp/pd.csv

Licence
-------
Part of Engineering ML Studio; licensed under Apache-2.0
(see ../LICENSE). Copyright in this new contribution is held by UKRI.
"""

from __future__ import annotations

import argparse
import csv
import math
import os

import numpy as np

# --- Fixed physical constant (documented, not a variable feature) -------------
ROUGHNESS_M = 0.045e-3  # absolute wall roughness ε (m): ~commercial steel

# --- Sampling ranges (realistic, water-like liquids) --------------------------
# Kept deliberately modest so pressure drops stay in an easy-to-read range and
# training is instant in the browser.
RANGES = {
    "pipe_length_m":            (2.0, 30.0),       # uniform
    "pipe_diameter_m":          (0.02, 0.20),      # log-uniform (spans scales)
    "flow_velocity_m_s":        (0.5, 4.0),        # uniform
    "fluid_density_kg_m3":      (850.0, 1050.0),   # uniform
    "dynamic_viscosity_pa_s":   (3.0e-4, 2.0e-3),  # log-uniform
}

# Column order of the written CSV. Units are embedded in the names so the target
# unit and every input unit are self-documenting.
COLUMNS = [
    "pipe_length_m",
    "pipe_diameter_m",
    "flow_velocity_m_s",
    "fluid_density_kg_m3",
    "dynamic_viscosity_pa_s",
    "pressure_drop_kpa",  # target
]


def reynolds_number(density, velocity, diameter, viscosity):
    """Reynolds number Re = ρ v D / μ  [-]."""
    return density * velocity * diameter / viscosity


def friction_factor(re, rel_roughness):
    """Darcy friction factor: laminar 64/Re, else explicit Haaland approximation."""
    if re < 2300.0:
        return 64.0 / re
    # Haaland (1983), explicit — no iteration required.
    inv_sqrt_f = -1.8 * math.log10((rel_roughness / 3.7) ** 1.11 + 6.9 / re)
    return 1.0 / (inv_sqrt_f * inv_sqrt_f)


def pressure_drop_pa(length, diameter, velocity, density, viscosity):
    """Darcy–Weisbach pressure drop [Pa] for one sample (no noise)."""
    re = reynolds_number(density, velocity, diameter, viscosity)
    rel_rough = ROUGHNESS_M / diameter
    f = friction_factor(re, rel_rough)
    return f * (length / diameter) * (density * velocity * velocity / 2.0), re


def _sample_uniform(rng, low, high, n):
    return rng.uniform(low, high, n)


def _sample_log_uniform(rng, low, high, n):
    return np.exp(rng.uniform(math.log(low), math.log(high), n))


def generate(rows: int = 500, seed: int = 42, sigma: float = 0.05):
    """Return (header, list-of-rows, diagnostics) for the synthetic dataset."""
    rng = np.random.default_rng(seed)

    length = _sample_uniform(rng, *RANGES["pipe_length_m"], rows)
    diameter = _sample_log_uniform(rng, *RANGES["pipe_diameter_m"], rows)
    velocity = _sample_uniform(rng, *RANGES["flow_velocity_m_s"], rows)
    density = _sample_uniform(rng, *RANGES["fluid_density_kg_m3"], rows)
    viscosity = _sample_log_uniform(rng, *RANGES["dynamic_viscosity_pa_s"], rows)

    # Multiplicative lognormal noise factor (strictly positive).
    noise = np.exp(rng.normal(0.0, sigma, rows))

    out_rows = []
    re_values = []
    dp_values = []
    for i in range(rows):
        dp_pa, re = pressure_drop_pa(
            length[i], diameter[i], velocity[i], density[i], viscosity[i]
        )
        dp_kpa = dp_pa * noise[i] / 1000.0
        re_values.append(re)
        dp_values.append(dp_kpa)
        out_rows.append([
            round(float(length[i]), 4),
            round(float(diameter[i]), 5),
            round(float(velocity[i]), 4),
            round(float(density[i]), 2),
            float(f"{viscosity[i]:.6e}"),
            round(float(dp_kpa), 4),
        ])

    diagnostics = {
        "rows": rows,
        "seed": seed,
        "sigma": sigma,
        "dp_min_kpa": min(dp_values),
        "dp_max_kpa": max(dp_values),
        "re_min": min(re_values),
        "re_max": max(re_values),
        "laminar_fraction": sum(1 for r in re_values if r < 2300.0) / rows,
    }
    return COLUMNS, out_rows, diagnostics


def validate(header, rows):
    """Fail loudly if the dataset is not sensible."""
    assert header == COLUMNS, "unexpected column order"
    assert rows, "no rows generated"
    dp_index = COLUMNS.index("pressure_drop_kpa")
    for r in rows:
        assert len(r) == len(COLUMNS), "ragged row"
        assert r[dp_index] > 0.0, "non-positive pressure drop"
        # Every input must be strictly positive and finite.
        for v in r:
            assert math.isfinite(v), "non-finite value"
        assert all(v > 0.0 for v in r[:5]), "non-positive input"


def write_csv(path, header, rows):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    # newline="" for correct, platform-independent CSV line endings.
    with open(path, "w", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(header)
        writer.writerows(rows)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    default_out = os.path.normpath(
        os.path.join(here, "..", "examples", "pipe_pressure_drop_sample.csv")
    )
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--out", default=default_out, help="output CSV path")
    parser.add_argument("--rows", type=int, default=500, help="number of rows")
    parser.add_argument("--seed", type=int, default=42, help="random seed")
    parser.add_argument("--sigma", type=float, default=0.05, help="lognormal noise sigma")
    args = parser.parse_args()

    header, rows, diag = generate(rows=args.rows, seed=args.seed, sigma=args.sigma)
    validate(header, rows)
    write_csv(args.out, header, rows)

    print(f"Wrote {diag['rows']} rows to {args.out}")
    print(f"  seed={diag['seed']} sigma={diag['sigma']}")
    print(f"  pressure_drop_kpa: {diag['dp_min_kpa']:.3f} .. {diag['dp_max_kpa']:.3f} kPa")
    print(f"  Reynolds number:   {diag['re_min']:.0f} .. {diag['re_max']:.0f}")
    print(f"  laminar fraction:  {diag['laminar_fraction']:.1%}")


if __name__ == "__main__":
    main()
