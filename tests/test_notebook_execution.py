#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 UK Research and Innovation (UKRI)
"""End-to-end execution test for the Learn the Code notebook.

This actually *runs* the notebook top to bottom, exactly as a learner would, and
checks that it completes and produces sane results. It needs the notebook stack
(``nbclient``/``nbformat``) plus the notebook's own dependencies (``pandas``,
``scikit-learn``, ``matplotlib``); if any are missing the whole test is skipped
so the lightweight test environments still pass.

    python3 -m unittest tests.test_notebook_execution     # from the repo root

Design choices that keep this honest and CI-friendly:

* It runs with the working directory set to ``notebooks/`` and a non-interactive
  matplotlib backend, so the notebook loads the **local** committed CSV and needs
  **no internet** (we assert it reported the local load, not the GitHub fallback).
* It asserts on **sane ranges and the qualitative ranking** (linear under-fits,
  the forest is strongest), never on exact floating-point values — the numbers
  will differ from the browser and across library versions, by design.
"""

import os
import re
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
NOTEBOOK = os.path.join(ROOT, "notebooks", "pipe_pressure_drop.ipynb")
NOTEBOOK_DIR = os.path.join(ROOT, "notebooks")

# Non-interactive plotting before anything imports matplotlib in the kernel.
os.environ.setdefault("MPLBACKEND", "Agg")

# Skip cleanly if the notebook/ML stack is not installed.
_MISSING = []
try:
    import nbformat  # noqa: F401
    from nbclient import NotebookClient
    from nbclient.exceptions import CellExecutionError
except Exception as exc:  # pragma: no cover - environment dependent
    _MISSING.append(f"notebook tooling ({exc})")
for _mod in ("pandas", "sklearn", "matplotlib", "numpy"):
    try:
        __import__(_mod)
    except Exception:  # pragma: no cover - environment dependent
        _MISSING.append(_mod)


def collect_stream_text(nb):
    """Concatenate all stdout/stream and text/plain outputs of the executed notebook."""
    chunks = []
    for cell in nb.cells:
        if cell.get("cell_type") != "code":
            continue
        for out in cell.get("outputs", []):
            if out.get("output_type") == "stream":
                chunks.append(out.get("text", ""))
            elif out.get("output_type") in ("execute_result", "display_data"):
                data = out.get("data", {})
                if "text/plain" in data:
                    text = data["text/plain"]
                    chunks.append("".join(text) if isinstance(text, list) else text)
            elif out.get("output_type") == "error":
                chunks.append("\n".join(out.get("traceback", [])))
    return "\n".join(chunks)


@unittest.skipIf(_MISSING, "notebook execution deps missing: " + ", ".join(_MISSING))
class NotebookExecutionTests(unittest.TestCase):
    executed = None
    output_text = ""

    @classmethod
    def setUpClass(cls):
        nb = nbformat.read(NOTEBOOK, as_version=4)
        client = NotebookClient(
            nb,
            timeout=300,
            kernel_name="python3",
            resources={"metadata": {"path": NOTEBOOK_DIR}},
        )
        try:
            cls.executed = client.execute()
        except CellExecutionError as exc:  # pragma: no cover - failure path
            raise AssertionError(f"notebook failed to execute top-to-bottom: {exc}")
        cls.output_text = collect_stream_text(cls.executed)

    def _test_r2(self, model_name):
        # Parse the results table row: "<Model>  <train R2>  <test R2>  ...".
        match = re.search(
            re.escape(model_name) + r"\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)",
            self.output_text,
        )
        self.assertIsNotNone(match, f"could not find test R2 for {model_name}")
        return float(match.group(2))

    def test_runs_offline_from_local_dataset(self):
        self.assertIn(
            "Loaded local dataset",
            self.output_text,
            "notebook did not load the local dataset (should not need the network in CI)",
        )

    def test_no_execution_errors(self):
        errors = [
            out
            for cell in self.executed.cells
            if cell.get("cell_type") == "code"
            for out in cell.get("outputs", [])
            if out.get("output_type") == "error"
        ]
        self.assertEqual(errors, [], "notebook produced execution errors")

    def test_metric_ranges_and_ranking(self):
        linear = self._test_r2("Linear Regression")
        tree = self._test_r2("Decision Tree")
        forest = self._test_r2("Random Forest")

        # Sane ranges (broad, version-tolerant) — never exact values.
        self.assertTrue(0.3 <= linear <= 0.75, f"linear test R2 out of range: {linear}")
        self.assertTrue(0.55 <= tree <= 0.95, f"tree test R2 out of range: {tree}")
        self.assertTrue(0.65 <= forest <= 0.98, f"forest test R2 out of range: {forest}")

        # Qualitative ranking the learner also saw in the browser.
        self.assertLess(linear, tree, "linear should under-fit relative to the tree")
        self.assertLess(linear, forest, "linear should under-fit relative to the forest")
        self.assertGreaterEqual(
            forest, tree - 0.05, "the forest should be at least as strong as a single tree"
        )

    def test_predictions_physically_plausible(self):
        self.assertIn(
            "physically sensible",
            self.output_text,
            "expected the no-negative-predictions plausibility check to pass",
        )

    def test_trend_checks_all_pass(self):
        self.assertGreaterEqual(
            self.output_text.count("[OK"), 3, "expected all three trend checks to pass"
        )
        self.assertNotIn("[WARN]", self.output_text, "a physical trend check failed")

    def test_extrapolation_flagged(self):
        self.assertIn(
            "In demonstrated range? False",
            self.output_text,
            "the out-of-range example should be flagged as extrapolation",
        )

    def test_optional_neural_network_runs_and_is_sane(self):
        # The optional Section 16 must execute and land in a believable range.
        nn = self._test_r2("Neural Network")
        self.assertTrue(0.4 <= nn <= 0.99, f"NN test R2 out of range: {nn}")
        # It should at least be competitive with the simple linear trend.
        linear = self._test_r2("Linear Regression")
        self.assertGreater(nn, linear - 0.05, "the NN should beat, or match, the linear trend")
        # The section reports its training honestly (iteration count / convergence).
        self.assertIn("iterations", self.output_text, "NN should report its iteration count")

STEEL_NOTEBOOK = os.path.join(ROOT, "notebooks", "steel_tensile_strength.ipynb")


@unittest.skipIf(_MISSING, "notebook execution deps missing: " + ", ".join(_MISSING))
class SteelNotebookExecutionTests(unittest.TestCase):
    executed = None
    output_text = ""

    @classmethod
    def setUpClass(cls):
        nb = nbformat.read(STEEL_NOTEBOOK, as_version=4)
        client = NotebookClient(
            nb,
            timeout=300,
            kernel_name="python3",
            resources={"metadata": {"path": NOTEBOOK_DIR}},
        )
        try:
            cls.executed = client.execute()
        except CellExecutionError as exc:
            raise AssertionError(
                f"steel notebook failed to execute top-to-bottom: {exc}"
            )
        cls.output_text = collect_stream_text(cls.executed)

    def _test_r2(self, model_name):
        match = re.search(
            re.escape(model_name) + r"\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)",
            self.output_text,
        )
        self.assertIsNotNone(match, f"could not find test R2 for {model_name}")
        return float(match.group(2))

    def test_runs_offline_from_local_dataset(self):
        self.assertIn(
            "Loaded local dataset",
            self.output_text,
            "steel notebook should load the committed local CSV",
        )

    def test_no_execution_errors(self):
        errors = [
            out
            for cell in self.executed.cells
            if cell.get("cell_type") == "code"
            for out in cell.get("outputs", [])
            if out.get("output_type") == "error"
        ]
        self.assertEqual(errors, [], "steel notebook produced execution errors")

    def test_model_metrics_are_sane(self):
        linear = self._test_r2("Linear Regression")
        tree = self._test_r2("Decision Tree")
        forest = self._test_r2("Random Forest")

        self.assertTrue(0.85 <= linear <= 1.0, f"linear test R2 out of range: {linear}")
        self.assertTrue(0.65 <= tree <= 0.98, f"tree test R2 out of range: {tree}")
        self.assertTrue(0.80 <= forest <= 1.0, f"forest test R2 out of range: {forest}")

    def test_predictions_are_physically_plausible(self):
        self.assertRegex(
            self.output_text,
            r"None of the \d+ test predictions are negative\. All are positive\.",
            "expected all test predictions to be non-negative",
        )

    def test_all_six_engineering_trend_checks_pass(self):
        self.assertGreaterEqual(
            self.output_text.count("[OK"),
            6,
            "expected all six steel trend checks to pass",
        )
        self.assertNotIn("[WARN]", self.output_text)

    def test_extrapolation_is_flagged(self):
        self.assertRegex(
            self.output_text,
            r"(?:In|Inside) demonstrated range\?\s*False",
            "the out-of-range grain-size example should be flagged",
        )

    def test_optional_neural_network_runs_and_reports_training(self):
        nn = self._test_r2("Neural Network")
        self.assertTrue(0.85 <= nn <= 1.0, f"NN test R2 out of range: {nn}")
        self.assertIn(
            "iterations",
            self.output_text,
            "NN should report its training iteration count",
        )


if __name__ == "__main__":
    unittest.main()
