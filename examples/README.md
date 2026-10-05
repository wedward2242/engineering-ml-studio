# Example datasets — provenance and reuse status

This directory holds the small example CSV files bundled with the application. This document records
what is **confirmed** and what is **reasonable inference** about their provenance, so that their
status is never overstated.

The files fall into two groups:

- **Inherited from Local Regression Studio** (`house_prices_sample.csv`,
  `nonlinear_regression_sample.csv`, `nonlinear_prediction_sample.csv`) — introduced by Yu Duan;
  reusable under the MIT licence (confirmed).
- **New to Engineering ML Studio** (`pipe_pressure_drop_sample.csv`) — a documented, deterministic,
  **synthetic physically-informed** dataset created for the problem-led Explore mode, with a committed
  generator script. See [its own section](#pipe_pressure_drop_samplecsv-new-explore-mode-primary).

> ✅ **Reuse status confirmed.** Yu Duan has confirmed that the **inherited** bundled example datasets
> may be reused under the **MIT licence** (see [`../LICENSES.txt`](../LICENSES.txt)). They were
> introduced by Yu Duan as part of the original Local Regression Studio work. The **new**
> `pipe_pressure_drop_sample.csv` is released under the same MIT terms, with copyright in the new
> contribution held by UKRI.

> ℹ️ **Explore-mode change.** The beginner **Explore** mode is now problem-led and uses
> `pipe_pressure_drop_sample.csv` as its primary example; `nonlinear_regression_sample.csv` is kept as
> a clearly-labelled secondary "generic nonlinear" demonstration. `house_prices_sample.csv` has been
> **removed from the Explore path** but the file is **retained** here (unchanged) for Project mode and
> compatibility.

## Summary of provenance (inherited files)

*(Applies to the three inherited files. The new `pipe_pressure_drop_sample.csv` has its own section
below, with full generator documentation.)*

- **[Confirmed]** All three inherited CSVs were introduced in commit **`11ae72e`** ("app body").
- **[Confirmed]** Author of the introducing commit: **Yu Duan** — `MarLen <y.duan@imperial.ac.uk>`,
  dated **2026-07-16**.
- **[Confirmed]** **Reuse is permitted under the MIT licence**, as confirmed by Yu Duan. The files
  are covered by the repository's existing licence file [`../LICENSES.txt`](../LICENSES.txt) as part
  of the original work; there is no separate dataset licence file, and none is required.
- **[Reasonable inference]** The files appear **programmatically generated / synthetic** for
  demonstration (see per-file evidence below). No claim is made that they originate from physical
  experiments or real-world measurements.
- **[Not documented]** No generator script or data dictionary is included, so the exact generating
  functions are not recorded here.

---

## `house_prices_sample.csv`

- **Location:** `examples/house_prices_sample.csv`
- **Rows:** 400 (plus header)
- **Columns:** `property_id`, `area_sq_m`, `bedrooms`, `age_years`, `neighbourhood`,
  `energy_rating`, `has_garden`, `price`
- **Categorical vocabularies:** `neighbourhood` ∈ {Central, East, North, South, West};
  `energy_rating` ∈ {A, B, C, D, E}; `has_garden` ∈ {yes, no}
- **Approximate purpose:** demonstration dataset for tabular regression with mixed
  numeric/categorical features predicting `price`.
- **Appears:** **generated (reasonable inference).**
- **Evidence:** sequential synthetic identifiers (`P0001`, `P0002`, …); small, tidy categorical
  vocabularies; filename contains `sample`; no missing values observed in spot checks.
- **Introducing commit / author:** `11ae72e` — Yu Duan (`MarLen <y.duan@imperial.ac.uk>`), 2026-07-16.
- **Licence / attribution:** reusable under the MIT licence (confirmed by Yu Duan); see
  `../LICENSES.txt`.
- **Unresolved concern:** cannot confirm whether values are purely synthetic or modelled on real
  market data.

## `nonlinear_regression_sample.csv`

- **Location:** `examples/nonlinear_regression_sample.csv`
- **Rows:** 360 (plus header)
- **Columns:** `time`, `x1`, `x2`, `source`, `regime`, `target`
- **Categorical vocabularies:** `source` ∈ {lab-A, lab-B, lab-C, lab-D}; `regime` ∈ {low, mid, high}
- **Approximate purpose:** demonstration dataset for nonlinear regression (training).
- **Appears:** **generated (reasonable inference).**
- **Evidence:** `x1` is a clean evenly-spaced sweep from `-3.0` to `3.0` (a linspace);
  `time` is a simple integer sequence; filename contains `sample`; tidy categorical vocabularies.
- **Introducing commit / author:** `11ae72e` — Yu Duan (`MarLen <y.duan@imperial.ac.uk>`), 2026-07-16.
- **Licence / attribution:** reusable under the MIT licence (confirmed by Yu Duan); see
  `../LICENSES.txt`.
- **Unresolved concern:** the exact generating function and any noise model are not documented.

## `nonlinear_prediction_sample.csv`

- **Location:** `examples/nonlinear_prediction_sample.csv`
- **Rows:** 180 (plus header)
- **Columns:** `time`, `x1`, `x2`, `source`, `regime`, `target`
- **Approximate purpose:** companion "unknown data" file for the prediction step of the nonlinear
  example (same schema as the regression sample).
- **Appears:** **generated (reasonable inference).**
- **Evidence:** same schema and structure as `nonlinear_regression_sample.csv`; evenly-spaced `x1`;
  filename contains `sample`.
- **Introducing commit / author:** `11ae72e` — Yu Duan (`MarLen <y.duan@imperial.ac.uk>`), 2026-07-16.
- **Licence / attribution:** reusable under the MIT licence (confirmed by Yu Duan); see
  `../LICENSES.txt`.
- **Unresolved concern:** relationship to the regression file (e.g. shared generator/seed) is not
  documented.

---

## `pipe_pressure_drop_sample.csv` (new — Explore mode primary)

- **Location:** `examples/pipe_pressure_drop_sample.csv`
- **Rows:** 500 (plus header)
- **Columns (units embedded in the names):** `pipe_length_m`, `pipe_diameter_m`, `flow_velocity_m_s`,
  `fluid_density_kg_m3`, `dynamic_viscosity_pa_s`, `pressure_drop_kpa` (target).
- **Purpose:** the primary, problem-led **Explore**-mode demonstration — predict the pressure drop
  along a pipe from its geometry and the flow conditions (a core mechanical/thermal engineering
  quantity).
- **Status:** **synthetic, documented, physically-informed — a training demonstration only.** It is
  **not** experimental, validated, safety-grade, or design-quality data, and must not be used for real
  design decisions.
- **Governing physics:** the **Darcy–Weisbach** equation Δp = f·(L/D)·(ρ·v²/2), with the Darcy
  friction factor *f* obtained from the Reynolds number Re = ρvD/μ — laminar `f = 64/Re` for
  Re < 2300, and the explicit **Haaland** correlation for turbulent flow. Absolute wall roughness is
  held constant at ε = 0.045 mm (typical commercial steel) and is **documented, not an input feature**.
- **Assumptions / simplifications:** fully-developed, steady, single-phase, incompressible, Newtonian
  flow in a straight, constant-diameter, circular pipe; no fittings, bends, entrance, or elevation
  losses (friction only); a hard laminar/turbulent switch at Re = 2300 (real transitional flow is not
  modelled in detail — a deliberate, small kink that a flexible model can capture but a single linear
  fit cannot).
- **Sampling ranges:** length 2–30 m (uniform); diameter 0.02–0.20 m (log-uniform); velocity
  0.5–4.0 m/s (uniform); density 850–1050 kg/m³ (uniform); viscosity 3×10⁻⁴–2×10⁻³ Pa·s (log-uniform).
- **Noise model:** each pressure drop is multiplied by `exp(N(0, σ))` with σ = 0.05 (~5% relative
  scatter) — multiplicative lognormal noise, so values stay strictly positive.
- **Determinism:** generated with numpy `default_rng(seed)`, default **seed = 42**; the same seed, row
  count, and numpy version reproduce byte-identical output.
- **Generator (documented, reproducible):**
  [`../scripts/generate_pipe_pressure_drop.py`](../scripts/generate_pipe_pressure_drop.py). Regenerate
  the bundled file with:

  ```bash
  python3 scripts/generate_pipe_pressure_drop.py --rows 500 --seed 42
  ```

- **Tests:** [`../tests/test_pipe_dataset.py`](../tests/test_pipe_dataset.py) checks the columns/units,
  row count, strictly-positive/finite values, sensible ranges, determinism, and that the committed CSV
  matches a fresh default generation byte-for-byte.
- **Introducing author / copyright:** new Engineering ML Studio contribution (Wei Wang, STFC);
  copyright in this new contribution held by **UKRI**.
- **Licence:** MIT (the project's existing terms; see [`../LICENSES.txt`](../LICENSES.txt)).

## `fin_heat_dissipation_sample.csv` (new — Explore mode)

- **Location:** `examples/fin_heat_dissipation_sample.csv`

- **Rows:** 500 (plus header)

- **Columns (units embedded in the names):** `h_w_m2k`, `area_m2`, `delta_t_k`,
  `heat_dissipation_w` (target).

- **Purpose:** a synthetic, problem-led **Explore**-mode demonstration — predict heat dissipation from a convective heat-transfer coefficient, heat-transfer surface area, and temperature difference.

- **Status:** **synthetic, documented, physically-informed — a training demonstration only.** It is
  **not** experimental, validated, safety-grade, or design-quality data, and must not be used for real
  design decisions.

- **Governing physics:** Newton's law of cooling, `Q = h · A · ΔT`, where `Q` is the heat-transfer rate
  in watts, `h` is the convective heat-transfer coefficient in W/m²K, `A` is the heat-transfer surface
  area in m², and `ΔT` is the temperature difference in K.

- **Assumptions / simplifications:** steady-state convective heat transfer; the heat-transfer coefficient
  is treated as an input; the surface temperature and surrounding-fluid temperature are represented by
  their temperature difference; radiation, conduction losses through supports, and other secondary effects
  are not modelled.

- **Sampling ranges:** heat-transfer coefficient 5–500 W/m²K (uniform); surface area 0.001–0.5 m²
  (uniform); temperature difference 5–100 K (uniform).

- **Noise model:** each heat-dissipation value is multiplied by `exp(N(0, σ))` with σ = 0.05
  (~5% relative scatter) — multiplicative lognormal noise, so values stay strictly positive.

- **Determinism:** generated with numpy `default_rng(seed)`, default **seed = 42**; the same seed,
  row count, and numpy version reproduce the same output.

- **Generator (documented, reproducible):**
  [`../scripts/generate_fin_heat_dissipation.py`](../scripts/generate_fin_heat_dissipation.py). Regenerate
  the bundled file with:

  ```bash
  python3 scripts/generate_fin_heat_dissipation.py --rows 500 --seed 42
  ```

- **Tests:** [`../tests/test_fin_dataset.py`](../tests/test_fin_dataset.py) checks the columns/units,
  row count, strictly-positive/finite values, sensible ranges, determinism, and that the committed CSV
  matches a fresh default generation byte-for-byte.

- **Introducing author / copyright:** new Engineering ML Studio contribution; copyright in this new
  contribution held by **UKRI**.

- **Licence:** MIT (the project's existing terms; see [`../LICENSES.txt`](../LICENSES.txt)).

## `steel_tensile_strength_sample.csv` (new — Explore mode)

- **Location:** `examples/steel_tensile_strength_sample.csv`
- **Rows:** 500 (plus header)
- **Columns (units embedded in the names):** `carbon_wt_pct`, `manganese_wt_pct`, `silicon_wt_pct`, `grain_size_um`, `tempering_temperature_c`, `test_temperature_c`, `yield_strength_mpa` (target).
- **Purpose:** a synthetic, problem-led **Explore**-mode demonstration — predict structural-steel yield strength from chemical composition, grain size, tempering temperature, and tensile-test temperature.
- **Status:** **synthetic, documented, physically-informed — a training demonstration only.** It is **not** experimental, validated, safety-grade, or design-quality data, and must not be used for structural design, safety-critical qualification, material certification, or real engineering decisions.
- **Governing physics:** Hall–Petch strengthening combined with approximately linear solid-solution strengthening:
  `σ_y = σ_0 + k · d^(-1/2) + a_C · C + a_Mn · Mn + a_Si · Si`
  where grain size contributes nonlinearly through `d^(-1/2)`, while the composition terms are approximately linear.
- **Coefficient sources:** `σ_0 = 53.9 MPa`, `a_Mn = 32.3 MPa/wt%`, and `a_Si = 83.2 MPa/wt%` are based on literature values used for simplified structural-steel strengthening relationships. The Pickering relationship gives a Hall–Petch coefficient of `17.4 MPa·√mm`, which is converted here to approximately `550.2 MPa·√µm` to match the grain-size unit used by the generator. The carbon coefficient (`a_C = 5000 MPa/wt%`) and the temperature coefficients are project-defined effective coefficients for this synthetic teaching dataset rather than universal literature material constants.
- **Assumptions / simplifications:** grain size is treated as the effective microstructural variable relevant to yielding; carbon, manganese and silicon contributions are approximated as linear; tempering temperature and test temperature are represented using simplified empirical corrections. Phase composition, heat-treatment history, dislocation density, precipitation, texture, strain rate, and other metallurgical effects are not modelled explicitly.
- **Sampling ranges:** carbon 0.02–0.12 wt% (uniform); manganese 0.30–1.60 wt% (uniform); silicon 0.05–0.50 wt% (uniform); grain size 5–50 µm (uniform); tempering temperature 200–650 °C (uniform); test temperature −20–100 °C (uniform).
- **Noise model:** each yield-strength value is multiplied by `exp(N(0, σ))` with `σ = 0.04` (~4% relative scatter) — multiplicative lognormal noise, so values remain strictly positive.
- **Determinism:** generated with numpy `default_rng(seed)`, default **seed = 42**; the same seed, row count, and numpy version reproduce byte-identical output.
- **Generator (documented, reproducible):** [`../scripts/generate_steel_tensile_strength.py`](../scripts/generate_steel_tensile_strength.py). Regenerate the bundled file with:

  ```bash
  python3 scripts/generate_steel_tensile_strength.py --rows 500 --seed 42
  ```
- **Tests:** [`../tests/test_steel_dataset.py`](../tests/test_steel_dataset.py) checks the columns/units, row count, strictly-positive/finite values, sensible input ranges, determinism, validation, and that the committed CSV matches a fresh default generation byte-for-byte.
- **Introducing author / copyright:** new Engineering ML Studio contribution; copyright in this new contribution held by **UKRI**.
- **Licence:** Apache-2.0 (the project's licence); see the repository licence files.

---

## Recommended follow-up (optional)

- Reuse permission is **confirmed** (MIT, per Yu Duan); no further licensing action is required to
  use these files as examples.
- The new `pipe_pressure_drop_sample.csv` already ships with a documented generator and data
  dictionary (above); the same could optionally be added retrospectively for the inherited files.
- Optionally, record or add a generator script and a short data dictionary for each inherited file, so
  the synthetic construction is reproducible and documented.
- Continue to avoid describing these datasets as derived from real physical or experimental data
  unless such an origin is ever positively established.
