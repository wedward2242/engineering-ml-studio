#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 UK Research and Innovation (UKRI)
"""Tests for the synthetic fin heat-dissipation dataset generator.

These use only the Python standard library plus numpy (already required by the
generator). Run with:

    python3 -m unittest tests.test_fin_dataset      # from the repo root
    python3 tests/test_fin_dataset.py

They check that the documented, deterministic generator behaves as promised:
fixed columns, requested row count, sensible physical ranges, strictly positive
heat dissipation, and byte-for-byte reproducibility for a fixed seed. They also
confirm the bundled example CSV matches a fresh generation with the defaults.
"""

import csv
import io
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import generate_fin_heat_dissipation as gen

BUNDLED_CSV = os.path.join(ROOT, "examples", "fin_heat_dissipation_sample.csv")

def rows_to_csv_text(header, rows):
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    writer.writerows(rows)
    return buf.getvalue()


class FinDatasetGeneratorTests(unittest.TestCase):
    def test_expected_columns_and_units(self):
        header, rows, _ = gen.generate(rows=50, seed=42)

        self.assertEqual(header, [
            "h_w_m2k", "area_m2", "delta_t_k", "heat_dissipation_w",
        ])

        # The target column carries its unit; it is the last column.
        self.assertEqual(header[-1], "heat_dissipation_w")

    def test_requested_row_count(self):
        for n in (10, 100, 500):
            _, rows, diag = gen.generate(rows=n, seed=1)
            self.assertEqual(len(rows), n)
            self.assertEqual(diag["rows"], n)

    def test_no_negative_or_non_finite_heat_values(self):
        header, rows, _ = gen.generate(rows=500, seed=7)
        heat_index = header.index("heat_dissipation_w")

        for r in rows:
            self.assertGreater(r[heat_index], 0.0)  # strictly positive
            for v in r:
                self.assertTrue(_is_finite(v))      # every value finite
                self.assertGreater(v, 0.0)          # every input positive

    def test_ranges_are_sensible(self):
        header, rows, diag = gen.generate(rows=500, seed=42)

        idx = {name: header.index(name) for name in header}

        for r in rows:
            self.assertGreaterEqual(r[idx["h_w_m2k"]], 5.0)
            self.assertLessEqual(r[idx["h_w_m2k"]], 500.0)

            self.assertGreaterEqual(r[idx["area_m2"]], 0.001)
            self.assertLessEqual(r[idx["area_m2"]], 0.5)

            self.assertGreaterEqual(r[idx["delta_t_k"]], 5.0)
            self.assertLessEqual(r[idx["delta_t_k"]], 100.0)

        # Heat dissipation should be positive and finite.
        self.assertGreater(diag["heat_dissipation_min_w"], 0.0)
        self.assertTrue(_is_finite(diag["heat_dissipation_max_w"]))

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

    def test_bundled_csv_matches_default_generation(self):
        """The committed example CSV is reproducible from the documented defaults."""
        self.assertTrue(os.path.exists(BUNDLED_CSV), "bundled example CSV is missing")

        header, rows, _ = gen.generate(rows=500, seed=42, sigma=0.05)

        expected = rows_to_csv_text(header, rows).replace("\r\n", "\n")

        with open(BUNDLED_CSV, "r", newline="") as fh:
            actual = fh.read().replace("\r\n", "\n")

        self.assertEqual(
            actual,
            expected,
            "examples/fin_heat_dissipation_sample.csv is out of date; "
            "rerun scripts/generate_fin_heat_dissipation.py",
        )


def _is_finite(x):
    return x == x and x not in (float("inf"), float("-inf"))


if __name__ == "__main__":
    unittest.main()
