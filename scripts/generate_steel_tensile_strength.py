#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 UK Research and Innovation (UKRI)
"""Generate a synthetic, physically-informed structural-steel tensile-strength dataset.

This produces the bundled Explore-mode demonstration dataset
``examples/steel_tensile_strength_sample.csv``. It is a **training demonstration
dataset only** — it is synthetic, not experimental, and must not be treated as
validated, safety-grade, or design-quality engineering data.

Governing physics (Hall–Petch and solid-solution strengthening)
---------------------------------------------------------------
The yield strength of the synthetic structural-steel samples is modelled using
a Hall–Petch grain-size contribution together with approximately linear
solid-solution strengthening terms:

    σ_y = σ_0 + k · d^(-1/2)
          + a_C · C + a_Mn · Mn + a_Si · Si                  [MPa]

where
    σ_y = yield strength                                      [MPa]
    σ_0 = base/reference strength                             [MPa]
    k   = Hall–Petch coefficient                              [MPa·√µm]
    d   = grain size                                           [µm]
    C   = carbon content                                      [wt%]
    Mn  = manganese content                                   [wt%]
    Si  = silicon content                                     [wt%]
    a_C = carbon strengthening coefficient                    [MPa/wt%]
    a_Mn = manganese strengthening coefficient                [MPa/wt%]
    a_Si = silicon strengthening coefficient                  [MPa/wt%]

The Hall–Petch term introduces a nonlinear relationship with grain size:
smaller grains increase yield strength according to d^(-1/2), while the
composition terms are approximately linear.

Coefficient sources
-------------------
The base strength, Hall–Petch coefficient, manganese coefficient and silicon 
coefficient are based on literature values used for simplified structural-steel 
strengthening relationships. The Pickering relationship gives σ_0 = 53.9 MPa, 
a_Mn = 32.3 MPa/wt%, a_Si = 83.2 MPa/wt%, and a Hall–Petch coefficient of 
17.4 MPa·√mm. The Hall–Petch coefficient is converted here to approximately 
550.2 MPa·√µm to match the grain-size unit used by the generator.

* σ_0 = 53.9 MPa
* k = 550.2 MPa·√µm
* a_Mn = 32.3 MPa/wt%
* a_Si = 83.2 MPa/wt%

The Hall–Petch coefficient is expressed here in MPa·√µm to match the grain-size
unit used by the generator.

The carbon coefficient (a_C = 5000 MPa/wt%) and the temperature coefficients
used for tempering and test temperature are project-defined effective
coefficients for this synthetic teaching dataset. They are not presented as
universal literature material constants.

These coefficients are used only to construct an educational synthetic dataset
and are not intended to represent validated material-property data for any
particular grade of structural steel.

Assumptions and simplifications
-------------------------------
* The dataset represents synthetic structural-steel tensile-testing examples
  for machine-learning demonstration and teaching only.
* Yield strength is modelled using Hall–Petch strengthening plus simplified
  approximately linear solid-solution strengthening contributions from carbon,
  manganese and silicon.
* Grain size is treated as an input microstructural variable and is assumed to
  be representative of the effective grain size relevant to yielding.
* Tempering temperature and test temperature are included as input variables
  but are represented using simplified empirical effects rather than a
  complete metallurgical model.
* Real steel behaviour depends on many additional factors, including phase
  composition, heat-treatment history, dislocation density, precipitates,
  texture and strain rate. These effects are not modelled explicitly.
* The generated values are not experimental measurements and must not be used
  for structural design, safety-critical qualification, material certification,
  or engineering decisions.

Noise model
-----------
Random specimen-to-specimen scatter is added to represent measurement and
material variability that is not captured by the simplified physics model.
The noise is deliberately retained because real tensile-test measurements
contain irreducible scatter.

Determinism
-----------
Sampling uses ``numpy.random.default_rng(seed)`` with a fixed seed (default 42),
so the dataset is reproducible: rerunning with the same seed, row count, and
numpy version produces byte-identical output.

Usage
-----
    python3 scripts/generate_steel_tensile_strength.py
    python3 scripts/generate_steel_tensile_strength.py --rows 500 --seed 42
    python3 scripts/generate_steel_tensile_strength.py --out /tmp/steel.csv

Licence
-------
Part of Engineering ML Studio; released under the project's Apache-2.0 licence
(see ../LICENSES.txt). Copyright in this new contribution is held by UKRI.
"""

from __future__ import annotations

import argparse
import csv
import math
import os

import numpy as np

# --- Literature-derived coefficients -----------------------------------------
SIGMA_0_MPA = 53.9
HALL_PETCH_K_MPA_SQRT_UM = 550.2

MANGANESE_COEFF_MPA_PER_WT_PCT = 32.3
SILICON_COEFF_MPA_PER_WT_PCT = 83.2

# --- Project-defined synthetic carbon contribution --------------------------
# Used as an effective carbon-strengthening term for this teaching dataset.
CARBON_COEFF_MPA_PER_WT_PCT = 5000.0

# --- Project-defined synthetic temperature corrections ----------------------
TEMPER_REFERENCE_C = 400.0
TEMPER_COEFF_MPA_PER_C = -0.20

TEST_REFERENCE_C = 20.0
TEST_TEMP_COEFF_MPA_PER_C = -0.20

# --- Synthetic specimen-to-specimen scatter ----------------------------------
NOISE_SIGMA = 0.04

# --- Sampling ranges ---------------------------------------------------------
# These are synthetic sampling ranges for the demonstration dataset, not
# guaranteed composition or testing limits for any particular steel grade.
RANGES = {
    "carbon_wt_pct":           (0.02, 0.12),
    "manganese_wt_pct":        (0.30, 1.60),
    "silicon_wt_pct":          (0.05, 0.50),
    "grain_size_um":           (5.0, 50.0),
    "tempering_temperature_c": (200.0, 650.0),
    "test_temperature_c":      (-20.0, 100.0),
}

# Column order of the written CSV.
COLUMNS = [
    "carbon_wt_pct",
    "manganese_wt_pct",
    "silicon_wt_pct",
    "grain_size_um",
    "tempering_temperature_c",
    "test_temperature_c",
    "yield_strength_mpa",  # target
]


def yield_strength_mpa(
    carbon,
    manganese,
    silicon,
    grain_size,
    tempering_temperature,
    test_temperature,
):
    """Calculate synthetic yield strength [MPa] before specimen scatter."""

    hall_petch = HALL_PETCH_K_MPA_SQRT_UM / math.sqrt(grain_size)

    carbon_strengthening = CARBON_COEFF_MPA_PER_WT_PCT * carbon
    manganese_strengthening = MANGANESE_COEFF_MPA_PER_WT_PCT * manganese
    silicon_strengthening = SILICON_COEFF_MPA_PER_WT_PCT * silicon

    tempering_effect = TEMPER_COEFF_MPA_PER_C * (
        tempering_temperature - TEMPER_REFERENCE_C
    )

    test_temperature_effect = TEST_TEMP_COEFF_MPA_PER_C * (
        test_temperature - TEST_REFERENCE_C
    )

    return (
        SIGMA_0_MPA
        + hall_petch
        + carbon_strengthening
        + manganese_strengthening
        + silicon_strengthening
        + tempering_effect
        + test_temperature_effect
    )


def _sample_uniform(rng, low, high, n):
    return rng.uniform(low, high, n)



def generate(rows: int = 500, seed: int = 42, sigma: float = NOISE_SIGMA):
    """Return (header, list-of-rows, diagnostics) for the synthetic dataset."""
    rng = np.random.default_rng(seed)

    carbon = _sample_uniform(rng, *RANGES["carbon_wt_pct"], rows)
    manganese = _sample_uniform(rng, *RANGES["manganese_wt_pct"], rows)
    silicon = _sample_uniform(rng, *RANGES["silicon_wt_pct"], rows)
    grain_size = _sample_uniform(rng, *RANGES["grain_size_um"], rows)
    tempering_temperature = _sample_uniform(
        rng, *RANGES["tempering_temperature_c"], rows
    )
    test_temperature = _sample_uniform(
        rng, *RANGES["test_temperature_c"], rows
    )

    # Multiplicative lognormal noise factor (strictly positive).
    noise = np.exp(rng.normal(0.0, sigma, rows))

    out_rows = []
    yield_values = []

    for i in range(rows):
        yield_strength = yield_strength_mpa(
            carbon[i],
            manganese[i],
            silicon[i],
            grain_size[i],
            tempering_temperature[i],
            test_temperature[i],
        )

        yield_strength *= noise[i]

        yield_values.append(yield_strength)

        out_rows.append([
            round(float(carbon[i]), 5),
            round(float(manganese[i]), 5),
            round(float(silicon[i]), 5),
            round(float(grain_size[i]), 4),
            round(float(tempering_temperature[i]), 2),
            round(float(test_temperature[i]), 2),
            round(float(yield_strength), 3),
        ])

    diagnostics = {
        "rows": rows,
        "seed": seed,
        "sigma": sigma,
        "yield_strength_min_mpa": min(yield_values),
        "yield_strength_max_mpa": max(yield_values),
    }

    return COLUMNS, out_rows, diagnostics


def validate(header, rows):
    """Fail loudly if the dataset is not sensible."""
    assert header == COLUMNS, "unexpected column order"
    assert rows, "no rows generated"

    yield_index = COLUMNS.index("yield_strength_mpa")

    for r in rows:
        assert len(r) == len(COLUMNS), "ragged row"

        # Yield strength must be strictly positive.
        assert r[yield_index] > 0.0, "non-positive yield strength"

        # Every value must be finite.
        for v in r:
            assert math.isfinite(v), "non-finite value"

        # Check the six inputs against their configured sampling ranges.
        for index, column in enumerate(COLUMNS[:-1]):
            low, high = RANGES[column]
            assert low <= r[index] <= high, f"{column} outside range"


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
        os.path.join(here, "..", "examples", "steel_tensile_strength_sample.csv")
    )
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--out", default=default_out, help="output CSV path")
    parser.add_argument("--rows", type=int, default=500, help="number of rows")
    parser.add_argument("--seed", type=int, default=42, help="random seed")
    parser.add_argument("--sigma", type=float, default=NOISE_SIGMA, help="lognormal noise sigma")
    args = parser.parse_args()

    header, rows, diag = generate(rows=args.rows, seed=args.seed, sigma=args.sigma)
    validate(header, rows)
    write_csv(args.out, header, rows)

    print(f"Wrote {diag['rows']} rows to {args.out}")
    print(f"  seed={diag['seed']} sigma={diag['sigma']}")
    print(
        f"  yield_strength_mpa: "
        f"{diag['yield_strength_min_mpa']:.3f} .. "
        f"{diag['yield_strength_max_mpa']:.3f} MPa"
    )


if __name__ == "__main__":
    main()
