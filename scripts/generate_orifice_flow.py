#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 UK Research and Innovation (UKRI)
"""Generate a synthetic, physically-informed orifice flow-rate dataset.

This produces the bundled Explore-mode demonstration dataset
``examples/orifice_flow_sample.csv``. It is a **training demonstration
dataset only** — it is synthetic, not experimental, and must not be treated as
validated, safety-grade, or design-quality engineering data.

Governing physics (orifice flow)
--------------------------------
The volumetric flow rate through a simplified circular orifice is modelled with:

    Q = C_d · A · sqrt(2 · Δp / ρ)                              [m³/s]

where
    Q   = volumetric flow rate                       [m³/s]
    C_d = discharge coefficient                      [-]
    A   = orifice area                               [m²]
    Δp  = pressure difference across the orifice    [Pa]
    ρ   = fluid density                              [kg/m³]

For a circular orifice, the opening area is:

    A = π · d² / 4

where
    d = orifice diameter                            [m]

The discharge coefficient represents the difference between ideal and
real orifice flow. In this synthetic dataset it is treated as an input
effective parameter rather than calculated from detailed orifice geometry,
installation conditions, Reynolds number, or other flow-meter effects.

The governing relationship is a simplified representation of orifice flow
consistent with standard engineering treatment of differential-pressure
flow measurement. ISO 5167-2:2022 provides the standardised treatment of
measurement using orifice plates in full circular conduits. The present
dataset intentionally does not attempt to reproduce the full ISO 5167
calculation procedure.

Assumptions and simplifications
-------------------------------
* Steady, single-phase, incompressible flow.
* The pressure difference is positive and represents the pressure drop
  across the orifice.
* The orifice is treated as a circular opening with area A = πd²/4.
* The discharge coefficient is represented by a sampled effective parameter
  rather than being calculated from detailed plate geometry and installation
  conditions.
* Fluid density is treated as an input feature and is assumed constant for
  each generated sample.
* Compressibility, cavitation, multiphase flow, detailed upstream/downstream
  geometry, pipe fittings, installation effects, and Reynolds-number-dependent
  discharge-coefficient behaviour are not modelled explicitly.
* The sampling ranges are synthetic teaching ranges and are not claimed to
  represent all real orifice-flow applications.
* Modest multiplicative noise (see below) represents combined measurement
  and modelling scatter; it keeps every flow-rate value strictly positive.

Coefficient/source note
-----------------------
The orifice-flow relationship is based on standard engineering treatment of
differential-pressure flow measurement. ISO 5167-2:2022 is the relevant
standard for measurement using orifice plates in full circular conduits.

The discharge-coefficient range used by this generator is a
project-defined effective range for this synthetic teaching dataset. It is
not presented as a universal literature constant or as a substitute for the
coefficient calculation required for a particular real orifice installation.

Noise model
-----------
Each flow-rate value is multiplied by ``exp(N(0, sigma))`` (a lognormal factor,
default sigma = 0.05, i.e. ~5% relative scatter). Multiplicative noise is
appropriate for a positive target quantity and cannot produce negative flow
rates.

Determinism
-----------
Sampling uses ``numpy.random.default_rng(seed)`` with a fixed seed (default 42),
so rerunning the generator with the same seed, row count, and parameters
produces the same generated dataset.

Usage
-----
    python3 scripts/generate_orifice_flow.py
    python3 scripts/generate_orifice_flow.py --rows 500 --seed 42
    python3 scripts/generate_orifice_flow.py --out /tmp/orifice.csv

Licence
-------
Part of Engineering ML Studio; released under the project's Apache-2.0 terms
(see the repository licence files). Copyright in this new contribution is held
by UKRI.
"""

from __future__ import annotations

import argparse
import csv
import math
import os

import numpy as np

# --- Sampling ranges ----------------------------------------------------------
# Synthetic teaching ranges for the orifice-flow demonstration.
RANGES = {
    "pressure_difference_pa": (1000.0, 100000.0),  # uniform
    "orifice_diameter_m":     (0.005, 0.050),       # uniform
    "fluid_density_kg_m3":    (850.0, 1050.0),      # uniform
    "discharge_coefficient":  (0.60, 0.65),          # uniform
}

# Column order of the written CSV. Units are embedded in the names so the
# target unit and every input unit are self-documenting.
COLUMNS = [
    "pressure_difference_pa",
    "orifice_diameter_m",
    "fluid_density_kg_m3",
    "discharge_coefficient",
    "flow_rate_m3_s",  # target
]


def orifice_area(diameter):
    """Circular orifice area A = πd²/4 [m²]."""
    return math.pi * diameter * diameter / 4.0


def flow_rate_m3_s(pressure_difference, diameter, density, discharge_coefficient):
    """Simplified orifice volumetric flow rate [m³/s] before noise."""
    area = orifice_area(diameter)
    return discharge_coefficient * area * math.sqrt(
        2.0 * pressure_difference / density
    )


def _sample_uniform(rng, low, high, n):
    return rng.uniform(low, high, n)


def _sample_log_uniform(rng, low, high, n):
    return np.exp(rng.uniform(math.log(low), math.log(high), n))


def generate(rows: int = 500, seed: int = 42, sigma: float = 0.05):
    """Return (header, list-of-rows, diagnostics) for the synthetic dataset."""
    rng = np.random.default_rng(seed)

    pressure_difference = _sample_uniform(
        rng, *RANGES["pressure_difference_pa"], rows
    )
    diameter = _sample_uniform(
        rng, *RANGES["orifice_diameter_m"], rows
    )
    density = _sample_uniform(
        rng, *RANGES["fluid_density_kg_m3"], rows
    )
    discharge_coefficient = _sample_uniform(
        rng, *RANGES["discharge_coefficient"], rows
    )

    # Multiplicative lognormal noise factor (strictly positive).
    noise = np.exp(rng.normal(0.0, sigma, rows))

    out_rows = []
    flow_values = []

    for i in range(rows):
        flow_rate = flow_rate_m3_s(
            pressure_difference[i],
            diameter[i],
            density[i],
            discharge_coefficient[i],
        )

        flow_rate *= noise[i]

        flow_values.append(flow_rate)

        out_rows.append([
            round(float(pressure_difference[i]), 2),
            round(float(diameter[i]), 6),
            round(float(density[i]), 2),
            round(float(discharge_coefficient[i]), 4),
            round(float(flow_rate), 8),
        ])

    diagnostics = {
        "rows": rows,
        "seed": seed,
        "sigma": sigma,
        "flow_min_m3_s": min(flow_values),
        "flow_max_m3_s": max(flow_values),
    }

    return COLUMNS, out_rows, diagnostics


def validate(header, rows):
    """Fail loudly if the dataset is not sensible."""
    assert header == COLUMNS, "unexpected column order"
    assert rows, "no rows generated"

    flow_index = COLUMNS.index("flow_rate_m3_s")

    for r in rows:
        assert len(r) == len(COLUMNS), "ragged row"

        # Every value must be finite.
        for v in r:
            assert math.isfinite(v), "non-finite value"

        # Every input must be strictly positive.
        assert all(v > 0.0 for v in r[:4]), "non-positive input"

        # Flow rate must be strictly positive.
        assert r[flow_index] > 0.0, "non-positive flow rate"


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
        os.path.join(here, "..", "examples", "orifice_flow_sample.csv")
    )
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--out", default=default_out, help="output CSV path")
    parser.add_argument("--rows", type=int, default=500, help="number of rows")
    parser.add_argument("--seed", type=int, default=42, help="random seed")
    parser.add_argument(
        "--sigma",
        type=float,
        default=0.05,
        help="lognormal noise sigma",
    )
    args = parser.parse_args()

    header, rows, diag = generate(
        rows=args.rows,
        seed=args.seed,
        sigma=args.sigma,
    )
    validate(header, rows)
    write_csv(args.out, header, rows)

    print(f"Wrote {diag['rows']} rows to {args.out}")
    print(f"  seed={diag['seed']} sigma={diag['sigma']}")
    print(
        f"  flow_rate_m3_s: {diag['flow_min_m3_s']:.6f}"
        f" .. {diag['flow_max_m3_s']:.6f} m³/s"
    )


if __name__ == "__main__":
    main()
