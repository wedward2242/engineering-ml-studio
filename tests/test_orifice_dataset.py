#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 UK Research and Innovation (UKRI)
"""Tests for the synthetic orifice flow-rate dataset.

These use only the Python standard library plus numpy (already required by the
generator). Run with:

    python3 -m unittest tests.test_orifice_dataset
    python3 tests/test_orifice_dataset.py

They check that the documented, deterministic generator behaves as promised:
fixed columns, requested row count, sensible physical ranges, strictly positive
flow rate, and reproducibility for a fixed seed. They also confirm the bundled
example CSV matches a fresh generation with the defaults.
"""

import csv
import io
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from scripts import generate_orifice_flow as gen

BUNDLED_CSV = os.path.join(ROOT, "examples", "orifice_flow_sample.csv")

def rows_to_csv_text(header, rows):
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    writer.writerows(rows)
    return buf.getvalue()


class OrificeDatasetGeneratorTests(unittest.TestCase):

    def test_expected_columns_and_units(self):
        header, _, _ = gen.generate(rows=10, seed=1)

        self.assertEqual(
            header,
            [
                "pressure_difference_pa",
                "orifice_diameter_m",
                "fluid_density_kg_m3",
                "discharge_coefficient",
                "flow_rate_m3_s",
            ],
        )
        self.assertEqual(header[-1], "flow_rate_m3_s")

    def test_requested_row_count(self):
        for n in (10, 100, 500):
            _, rows, diag = gen.generate(rows=n, seed=1)
            self.assertEqual(len(rows), n)
            self.assertEqual(diag["rows"], n)

    def test_no_negative_or_non_finite_flow_rate(self):
        header, rows, _ = gen.generate(rows=500, seed=7)
        flow_index = header.index("flow_rate_m3_s")

        for r in rows:
            self.assertGreater(r[flow_index], 0.0)

            for v in r:
                self.assertTrue(_is_finite(v))

    def test_ranges_are_sensible(self):
        header, rows, diag = gen.generate(rows=500, seed=42)

        idx = {name: header.index(name) for name in header}

        for r in rows:
            self.assertGreaterEqual(
                r[idx["pressure_difference_pa"]], 1000.0
            )
            self.assertLessEqual(
                r[idx["pressure_difference_pa"]], 100000.0
            )

            self.assertGreaterEqual(
                r[idx["orifice_diameter_m"]], 0.005
            )
            self.assertLessEqual(
                r[idx["orifice_diameter_m"]], 0.050
            )

            self.assertGreaterEqual(
                r[idx["fluid_density_kg_m3"]], 850.0
            )
            self.assertLessEqual(
                r[idx["fluid_density_kg_m3"]], 1050.0
            )

            self.assertGreaterEqual(
                r[idx["discharge_coefficient"]], 0.60
            )
            self.assertLessEqual(
                r[idx["discharge_coefficient"]], 0.65
            )

        self.assertGreater(diag["flow_min_m3_s"], 0.0)
        self.assertTrue(_is_finite(diag["flow_max_m3_s"]))

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
            "examples/orifice_flow_sample.csv is out of date; "
            "rerun scripts/generate_orifice_flow.py",
        )


def _is_finite(x):
    return x == x and x not in (float("inf"), float("-inf"))


if __name__ == "__main__":
    unittest.main()
