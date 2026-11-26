#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 UK Research and Innovation (UKRI)
"""Tests for the synthetic steel tensile-strength dataset generator.
These use only the Python standard library plus numpy (already required by the
generator). Run with:

    python3 -m unittest tests.test_steel_dataset
    python3 tests/test_steel_dataset.py

They check that the documented, deterministic generator behaves as promised:
fixed columns, requested row count, sensible physical ranges, strictly positive
yield strength, and reproducibility for a fixed seed. They also confirm the
bundled example CSV matches a fresh generation with the defaults.
"""

import csv
import io
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
sys.path.insert(0, ROOT)

from scripts import generate_steel_tensile_strength as gen

BUNDLED_CSV = os.path.join(ROOT, "examples", "steel_tensile_strength_sample.csv")

def rows_to_csv_text(header, rows):
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    writer.writerows(rows)
    return buf.getvalue()


class SteelDatasetGeneratorTests(unittest.TestCase):

    def test_expected_columns_and_units(self):
        header, rows, diag = gen.generate(rows=10, seed=1)

        self.assertEqual(
            header,
            [
                "carbon_wt_pct",
                "manganese_wt_pct",
                "silicon_wt_pct",
                "grain_size_um",
                "tempering_temperature_c",
                "test_temperature_c",
                "yield_strength_mpa",
            ],
        )
        self.assertEqual(header[-1], "yield_strength_mpa")

    def test_requested_row_count(self):
        for n in (10, 100, 500):
            _, rows, diag = gen.generate(rows=n, seed=1)
            self.assertEqual(len(rows), n)
            self.assertEqual(diag["rows"], n)

    def test_no_negative_or_non_finite_yield_strength(self):
        header, rows, _ = gen.generate(rows=500, seed=7)
        yield_index = header.index("yield_strength_mpa")

        for r in rows:
            self.assertGreater(r[yield_index], 0.0)

            for v in r:
                self.assertTrue(_is_finite(v))

    def test_ranges_are_sensible(self):
        header, rows, diag = gen.generate(rows=500, seed=42)

        idx = {name: header.index(name) for name in header}

        for r in rows:
            self.assertGreaterEqual(r[idx["carbon_wt_pct"]], 0.02)
            self.assertLessEqual(r[idx["carbon_wt_pct"]], 0.12)

            self.assertGreaterEqual(r[idx["manganese_wt_pct"]], 0.30)
            self.assertLessEqual(r[idx["manganese_wt_pct"]], 1.60)

            self.assertGreaterEqual(r[idx["silicon_wt_pct"]], 0.05)
            self.assertLessEqual(r[idx["silicon_wt_pct"]], 0.50)

            self.assertGreaterEqual(r[idx["grain_size_um"]], 2.0)
            self.assertLessEqual(r[idx["grain_size_um"]], 50.0)

            self.assertGreaterEqual(
                r[idx["tempering_temperature_c"]], 200.0
            )
            self.assertLessEqual(
                r[idx["tempering_temperature_c"]], 650.0
            )

            self.assertGreaterEqual(
                r[idx["test_temperature_c"]], -20.0
            )
            self.assertLessEqual(
                r[idx["test_temperature_c"]], 100.0
            )

        self.assertGreater(diag["yield_strength_min_mpa"], 0.0)
        self.assertTrue(_is_finite(diag["yield_strength_max_mpa"]))

    def test_deterministic_for_fixed_seed(self):
        a = gen.generate(rows=200, seed=42)
        b = gen.generate(rows=200, seed=42)
        self.assertEqual(a[0], b[0])
        self.assertEqual(a[1], b[1])   # identical rows on a repeat run

    def test_different_seeds_differ(self):
        a = gen.generate(rows=200, seed=42)
        b = gen.generate(rows=200, seed=43)
        self.assertNotEqual(a[1], b[1])

    def test_validate_accepts_generated_data(self):
        header, rows, _ = gen.generate(rows=100, seed=3)
        gen.validate(header, rows)  # must not raise

    def test_validate_rejects_input_outside_range(self):
        header, rows, _ = gen.generate(rows=10, seed=3)
        invalid_rows = [list(row) for row in rows]

        carbon_index = header.index("carbon_wt_pct")
        invalid_rows[0][carbon_index] = 0.0

        with self.assertRaises(ValueError):
            gen.validate(header, invalid_rows)

    def test_validate_rejects_malformed_rows(self):
        header, rows, _ = gen.generate(rows=10, seed=3)

        ragged_rows = [list(row) for row in rows]
        ragged_rows[0].pop()

        with self.assertRaises(ValueError):
            gen.validate(header, ragged_rows)

        non_finite_rows = [list(row) for row in rows]
        non_finite_rows[0][0] = float("nan")

        with self.assertRaises(ValueError):
            gen.validate(header, non_finite_rows)

    def test_invalid_rows_are_rejected(self):
        for rows in (0, -1, True, 1.5):
            with self.subTest(rows=rows):
                with self.assertRaises(ValueError):
                    gen.generate(rows=rows)

    def test_invalid_seeds_are_rejected(self):
        for seed in (True, 1.5, "42"):
            with self.subTest(seed=seed):
                with self.assertRaises(ValueError):
                    gen.generate(seed=seed)

    def test_invalid_sigma_is_rejected(self):
        for sigma in (-0.1, float("inf"), float("-inf"), float("nan"), True, "0.04"):
            with self.subTest(sigma=sigma):
                with self.assertRaises(ValueError):
                    gen.generate(sigma=sigma)

    def test_zero_sigma_is_accepted(self):
        header, rows, _ = gen.generate(rows=10, seed=1, sigma=0.0)
        gen.validate(header, rows)

    def test_bundled_csv_matches_default_generation(self):
        """The committed example CSV is reproducible from the documented defaults."""
        self.assertTrue(os.path.exists(BUNDLED_CSV), "bundled example CSV is missing")

        header, rows, _ = gen.generate(rows=500, seed=42, sigma=0.04)

        expected = rows_to_csv_text(header, rows).replace("\r\n", "\n")

        with open(BUNDLED_CSV, "r", newline="") as fh:
            actual = fh.read().replace("\r\n", "\n")

        self.assertEqual(
            actual,
            expected,
            "examples/steel_tensile_strength_sample.csv is out of date; "
            "rerun scripts/generate_steel_tensile_strength.py",
        )


def _r2(y, pred):
    import numpy as np
    return 1.0 - float(np.sum((y - pred) ** 2)) / float(np.sum((y - y.mean()) ** 2))


def _linear_cv_r2(X, y, folds=5, seed=0):
    """Out-of-fold R² of ordinary least squares (numpy only, no scikit-learn)."""
    import numpy as np
    idx = np.random.default_rng(seed).permutation(len(y))
    pred = np.empty_like(y)
    for test_idx in np.array_split(idx, folds):
        train_idx = np.setdiff1d(idx, test_idx)
        A = np.c_[np.ones(len(train_idx)), X[train_idx]]
        coef = np.linalg.lstsq(A, y[train_idx], rcond=None)[0]
        pred[test_idx] = np.c_[np.ones(len(test_idx)), X[test_idx]] @ coef
    return _r2(y, pred)


class SteelDatasetTeachingPropertyTests(unittest.TestCase):
    """Guard the reason this dataset exists (WORKPLAN A2).

    A2 was chosen because the Hall-Petch d^(-1/2) term is genuinely nonlinear
    against near-linear composition effects, so a linear model does acceptably
    and a flexible model does better. An earlier version used a dissolved-carbon
    coefficient that made carbon explain over 90% of the variance: every
    structural test passed, yet linear regression beat every flexible model.
    These tests fail if a coefficient or range change removes the lesson.
    """

    @classmethod
    def setUpClass(cls):
        import numpy as np
        header, rows, _ = gen.generate(rows=500, seed=42)
        _, clean_rows, _ = gen.generate(rows=500, seed=42, sigma=0.0)
        data = np.array(rows, dtype=float)
        cls.X = data[:, :-1]
        cls.y = data[:, -1]
        cls.signal = np.array(clean_rows, dtype=float)[:, -1]
        cls.idx = {name: i for i, name in enumerate(header)}

    def test_hall_petch_dominates_the_signal(self):
        import numpy as np
        d = self.X[:, self.idx["grain_size_um"]]
        carbon = self.X[:, self.idx["carbon_wt_pct"]]
        hall_petch = gen.HALL_PETCH_K_MPA_SQRT_UM / np.sqrt(d)
        carbon_term = gen.CARBON_COEFF_MPA_PER_WT_PCT * carbon
        total = np.var(self.signal)
        self.assertGreater(np.var(hall_petch) / total, 0.5,
                           "Hall-Petch term should be the main source of variation")
        self.assertLess(np.var(carbon_term) / total, 0.25,
                        "carbon must not swamp the Hall-Petch term")

    def test_linear_is_acceptable_but_clearly_below_the_noise_ceiling(self):
        ceiling = _r2(self.y, self.signal)
        linear = _linear_cv_r2(self.X, self.y)
        self.assertGreater(linear, 0.5, "a straight line should still do acceptably")
        self.assertGreater(ceiling - linear, 0.10,
                           "a flexible model needs real headroom over linear "
                           f"(linear {linear:.3f}, noise ceiling {ceiling:.3f})")

    def test_the_gap_is_the_hall_petch_curvature_not_noise(self):
        import numpy as np
        X = self.X.copy()
        X[:, self.idx["grain_size_um"]] = X[:, self.idx["grain_size_um"]] ** -0.5
        ceiling = _r2(self.y, self.signal)
        self.assertGreater(_linear_cv_r2(X, self.y), ceiling - 0.02,
                           "linearising d^(-1/2) should close the gap to the noise ceiling")

    def test_yield_strength_is_plausible_for_structural_steel(self):
        self.assertGreater(self.y.min(), 100.0)
        self.assertLess(self.y.max(), 700.0)


def _is_finite(x):
    return x == x and x not in (float("inf"), float("-inf"))


if __name__ == "__main__":
    unittest.main()
