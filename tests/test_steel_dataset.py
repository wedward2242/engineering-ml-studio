#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 UK Research and Innovation (UKRI)
"""These use only the Python standard library plus numpy (already required by the
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
sys.path.insert(0, os.path.join(ROOT, "scripts"))

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

            self.assertGreaterEqual(r[idx["grain_size_um"]], 5.0)
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


def _is_finite(x):
    return x == x and x not in (float("inf"), float("-inf"))


if __name__ == "__main__":
    unittest.main()
