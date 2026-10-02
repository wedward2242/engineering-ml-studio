#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 UK Research and Innovation (UKRI)
"""Generate a synthetic, physically-informed fin heat-dissipation dataset.

This produces the bundled Explore-mode demonstration dataset
``examples/fin_heat_dissipation_sample.csv``. It is a training demonstration
dataset only — it is synthetic, not experimental, and must not be treated as
validated, safety-grade, or design-quality engineering data.

Governing physics (Newton's law of cooling)
-------------------------------------------
The convective heat-transfer rate is modelled using:

    Q = h · A · ΔT                                      [W]

where
    Q  = heat-transfer rate                         [W]
    h  = convective heat-transfer coefficient      [W/m²K]
    A  = heat-transfer surface area                 [m²]
    ΔT = temperature difference                     [K]

Assumptions and simplifications
-------------------------------
* Steady-state convective heat transfer.
* The heat-transfer coefficient is treated as an input.
* The surface temperature and surrounding-fluid temperature are represented
  by their temperature difference ΔT.
* Radiation, conduction losses through supports, and other secondary effects
  are not modelled.
* The dataset is synthetic and intended for machine-learning demonstration
  and training only.

Noise model
-----------
Each heat-transfer value is multiplied by ``exp(N(0, sigma))``. This provides
small positive measurement/modelling scatter while ensuring that the generated
heat-transfer rate remains positive.

Determinism
-----------
Sampling uses ``numpy.random.default_rng(seed)`` with a fixed seed (default 42),
so the dataset is reproducible.

Usage
-----
    python3 scripts/generate_fin_heat_dissipation.py
    python3 scripts/generate_fin_heat_dissipation.py --rows 500 --seed 42
    python3 scripts/generate_fin_heat_dissipation.py --out /tmp/fin.csv

Licence
-------
Part of Engineering ML Studio; released under the project's existing MIT terms
(see ../LICENSES.txt). Copyright in this new contribution is held by UKRI.
"""

from __future__ import annotations

import argparse
import csv
import math
import os

import numpy as np

# --- Sampling ranges (realistic convective heat-transfer values) --------------
# Kept deliberately modest so heat dissipation stays in an easy-to-read range
# and training is instant in the browser.
RANGES = {
    "h_w_m2k":    (5.0, 500.0),   # W/m²K: convective heat-transfer coefficient
    "area_m2":    (0.001, 0.5),   # m²: heat-transfer surface area
    "delta_t_k":  (5.0, 100.0),   # K: temperature difference
}

# Column order of the written CSV. Units are embedded in the names so the target
# unit and every input unit are self-documenting.
COLUMNS = [
    "h_w_m2k",
    "area_m2",
    "delta_t_k",
    "heat_dissipation_w",  # target
]










def _sample_uniform(rng, low, high, n):
    return rng.uniform(low, high, n)


def _sample_log_uniform(rng, low, high, n):
    return np.exp(rng.uniform(math.log(low), math.log(high), n))


def generate(rows: int = 500, seed: int = 42, sigma: float = 0.05):
    """Return (header, list-of-rows, diagnostics) for the synthetic dataset."""
    rng = np.random.default_rng(seed)

    h = _sample_uniform(rng, *RANGES["h_w_m2k"], rows)
    area = _sample_uniform(rng, *RANGES["area_m2"], rows)
    delta_t = _sample_uniform(rng, *RANGES["delta_t_k"], rows)

    # Multiplicative lognormal noise factor (strictly positive).
    noise = np.exp(rng.normal(0.0, sigma, rows))

    out_rows = []
    heat_values = []

    for i in range(rows):
        # Newton's law of cooling:
        # Q = h * A * delta_T
        heat_dissipation = h[i] * area[i] * delta_t[i] * noise[i]

        heat_values.append(heat_dissipation)

        out_rows.append([
            round(float(h[i]), 4),
            round(float(area[i]), 6),
            round(float(delta_t[i]), 4),
            round(float(heat_dissipation), 4),
        ])

    diagnostics = {
        "rows": rows,
        "seed": seed,
        "sigma": sigma,
        "heat_dissipation_min_w": min(heat_values),
        "heat_dissipation_max_w": max(heat_values),
    }

    return COLUMNS, out_rows, diagnostics


def validate(header, rows):
    """Fail loudly if the dataset is not sensible."""

    assert header == COLUMNS, "unexpected column order"

    assert rows, "no rows generated"

    heat_index = COLUMNS.index("heat_dissipation_w")

    for r in rows:
        assert len(r) == len(COLUMNS), "ragged row"

        assert r[heat_index] > 0.0, "non-positive heat dissipation"

        # Every value must be strictly positive and finite.
        for v in r:
            assert math.isfinite(v), "non-finite value"

        assert all(v > 0.0 for v in r), "non-positive input"

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
        os.path.join(here, "..", "examples", "fin_heat_dissipation_sample.csv")
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
    print(
        f"  heat_dissipation_w: "
        f"{diag['heat_dissipation_min_w']:.3f} .. "
        f"{diag['heat_dissipation_max_w']:.3f} W"
    )


if __name__ == "__main__":
    main()