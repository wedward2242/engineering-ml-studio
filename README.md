# Engineering ML Studio

> **Provisional name.** Early redevelopment stage — expect significant change.

Engineering ML Studio is a **browser-first machine-learning platform for engineers**. It runs
entirely in the browser, keeps data on the user's own machine, and aims to make training,
exploring, and building small engineering ML projects approachable for people who are not
machine-learning specialists.

**Try it: <https://weiwangstfc.github.io/engineering-ml-studio/>** — nothing to install, and no
data ever leaves your machine.

## Purpose

To give engineers a private, no-installation environment where they can load data, train and
compare models, understand the results, and — when they are ready — grow from no-code use
toward writing their own Python. The current focus is **regression**.

## Intended uses

- Learning and **exploration** of regression on engineering data.
- **Small engineering ML projects** (data preparation → training → validation → prediction → monitoring).
- Teaching the underlying concepts and, later, the underlying code.

## Current technical model (confirmed from the source project)

- **Browser-local calculation.** All model training and prediction run client-side in the browser;
  there is no backend, no account, and no data upload endpoint.
- **Static web application.** Plain HTML/CSS/JavaScript, no build step, deployed as static files.
- **Regression-only** at present, across the model families inherited from Local Regression Studio.

See [`docs/ARCHITECTURE_AUDIT.md`](docs/ARCHITECTURE_AUDIT.md) for the confirmed technical audit.

## Attribution and origin

Engineering ML Studio is an **independently maintained derivative**. It was **initially derived from
Local Regression Studio**, developed by **Yu Duan**.

- Original project: **Local Regression Studio**
- Original developer: **Yu Duan**
- Original source repository: <https://github.com/MartianonEarth/localregressorstudio>
- Original licence: **MIT** (see [`LICENSES.txt`](LICENSES.txt))

Yu Duan and any previous contributors retain full credit for the original work. The original
copyright and licence notices are preserved unchanged. See [`NOTICE.md`](NOTICE.md) for the full
attribution statement.

Engineering ML Studio is **led and maintained by Wei Wang at the Science and Technology Facilities
Council (STFC)**. Copyright in **new contributions** developed for Engineering ML Studio under this
STFC project is held by **UK Research and Innovation (UKRI)**, unless otherwise stated. This does
**not** transfer or replace the copyright of the original authors. Future development, releases, and
roadmap for Engineering ML Studio are decided independently (see [`GOVERNANCE.md`](GOVERNANCE.md)).

## Licence

Engineering ML Studio is released under the **Apache License, Version 2.0** — see
[`LICENSE`](LICENSE). You may use, modify and redistribute it, including commercially, provided you
keep the licence, the copyright notices and the [`NOTICE`](NOTICE) file, and state what you changed.
Apache-2.0 also grants an explicit patent licence, which is why it was chosen over MIT/BSD.

Two things the licence does **not** cover, and which are held separately:

- **The name and logo.** "Engineering ML Studio" identifies the project and its official training
  and certification. The licence grants no trademark rights (Apache-2.0 section 6). Forks and
  derivatives are welcome, under a different name.
- **Training course materials.** Any curriculum, exercises, solutions, assessment and instructor
  material produced for courses run on this platform are **not** part of this repository and are
  **not** covered by this licence.

For guidance on deciding where new resources belong, see [Course Materials and Repository Boundary](docs/COURSE_MATERIALS.md).

The inherited Local Regression Studio code remains under its original permissive terms
([`LICENSES.txt`](LICENSES.txt)), which permit sublicensing; those notices are retained unchanged.
See [`NOTICE`](NOTICE) for the short-form attribution required in redistributions, and
[`NOTICE.md`](NOTICE.md) for the full provenance.

## Running locally

This is a static site and must be served over HTTP (not opened as a `file://`). From the repository
root:

```bash
python3 -m http.server 8000
# then open http://127.0.0.1:8000
```

Full instructions, browser requirements, and how to run the automated tests are in
[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

## Publishing

Every push to `main` publishes the site to GitHub Pages via
[`.github/workflows/pages.yml`](.github/workflows/pages.yml). There is no build step — the
repository root is the site — so the workflow simply uploads the checked-out tree and deploys it.
It uses no secrets and contacts no external service.

## Status

**Phase 3 prototype (in progress): a friendlier Project mode.** This stage re-presents the inherited
Project workflow as **six clear stages** — *1. Load data · 2. Choose inputs and quantity to predict ·
3. Prepare data · 4. Choose and train models · 5. Evaluate results · 6. Predict, export and monitor* —
with engineering language, per-stage guidance, and advanced modelling and governance controls tucked
behind progressive disclosure. This is a **thin presentation and navigation layer only**: the eight
inherited panels, the training pipeline, the eleven models (default Linear Regression), and the
artifact/approval/export contract are all **unchanged**. The neural network remains an **advanced,
non-default** option. See [`docs/PHASE3_PROJECT_MODE_UX_PLAN.md`](docs/PHASE3_PROJECT_MODE_UX_PLAN.md)
and [`docs/PROJECT_MODE_STAGE_MAPPING.md`](docs/PROJECT_MODE_STAGE_MAPPING.md).

**Phase 2 prototype: the first "Learn the Code" pathway.** Building on the Explore
mode, this stage adds a guided **Jupyter notebook** that reproduces the *same* pressure-drop
activity in Python — the same dataset, the same five inputs and target, the same fixed random seed
(42) and the same three models — using `pandas`, `scikit-learn` and `matplotlib`. A new in-app
**Learn** page links out to the notebook (Google Colab or a local Jupyter run) and a **"Continue in
Python"** call to action appears at the end of the Explore workflow. The notebook is deliberately
faithful to Explore but **not numerically identical**: Explore runs its own in-browser model code
while the notebook uses scikit-learn, so the exact figures differ — the *teaching narrative* (linear
under-fits, a deep tree overfits, the forest is strongest) is what carries across. This connection
is one-way and static: **no browser state is transferred, no Python runs in the browser, and no
account or cloud service is involved.** See
[`docs/PHASE2_LEARN_THE_CODE_PLAN.md`](docs/PHASE2_LEARN_THE_CODE_PLAN.md) and
[`notebooks/README.md`](notebooks/README.md).

Phase 2 also adds a **neural network** as an **advanced, flexible option — not the beginner
default**. Explore gains a fourth approach ("try an advanced flexible model"), the four-way *Compare*
now includes it, and the notebook gains an optional advanced section. It reuses the **inherited**
browser network (no new dependency, no server compute) with safe presets, and is framed honestly: a
more complex model is not automatically more accurate, and on small tabular data well-tuned
tree-based methods are often as good or better. See
[`docs/NEURAL_NETWORK_DEMO.md`](docs/NEURAL_NETWORK_DEMO.md).

**Phase 1 prototype: landing page + problem-led engineering Explore mode.** On top of
the reproducible baseline, this stage adds a new **landing page** and a beginner-friendly **Explore
mode**. Explore is now **problem-led and focused on engineering**: it starts from a concrete
mechanical/thermal question — **predicting the pressure drop along a pipe** — rather than from
machine-learning terminology. Its four guided stages are *understand the problem → choose an approach →
train and compare predictions → interpret the engineering meaning*. The primary choice is framed as an
engineering decision ("start with a simple trend" / "try a more flexible relationship" / "compare
approaches") with the model names (Linear Regression, Random Forest, Decision Tree) shown only as
secondary detail. Results, plots, and the rule-based interpretation are reported in **physical units
(kPa)** and include an engineering-trend and extrapolation check.

The example is a new **synthetic, documented, physically-informed** dataset
(`examples/pipe_pressure_drop_sample.csv`, generated from the **Darcy–Weisbach** equation by a
committed, deterministic script) — a **training demonstration, not an engineering design tool**. The
inherited eight-stage application is **preserved unchanged as "Project mode"**. No ML algorithms were
changed, no inherited datasets were deleted (the house-price example was removed only from the beginner
Explore path), and no licences or deployment configuration were changed. See
[`docs/EXPLORE_MODE.md`](docs/EXPLORE_MODE.md),
[`examples/README.md`](examples/README.md), and
[`docs/PHASE1_IMPLEMENTATION_PLAN.md`](docs/PHASE1_IMPLEMENTATION_PLAN.md).

The prior stage established an **independent project foundation with a reproducible baseline**: a
documented local-run procedure and an automated **test foundation** (dev-only) that pins down current
behaviour. See [`ROADMAP.md`](ROADMAP.md), [`docs/BASELINE_BEHAVIOUR.md`](docs/BASELINE_BEHAVIOUR.md),
and [`docs/BASELINE_TEST_REPORT.md`](docs/BASELINE_TEST_REPORT.md).

### Modes

- **Explore** — a guided, no-code, **problem-led** introduction to regression built around an
  engineering example (predicting pressure drop in a pipe). New in Phase 1. See
  [`docs/EXPLORE_MODE.md`](docs/EXPLORE_MODE.md).
- **Project** — the full modelling workflow on your own data, now presented as **six guided stages**
  (Phase 3). The eight inherited internal panels (upload → features → preprocess → model → split →
  diagnostics → predict → monitor, plus governance) and all calculations are unchanged behind the new
  presentation. See [`docs/PROJECT_MODE_STAGE_MAPPING.md`](docs/PROJECT_MODE_STAGE_MAPPING.md).
- **Learn with Python** — a guided Jupyter notebook that reproduces the Explore pressure-drop
  workflow in Python (`pandas` + `scikit-learn`). New in Phase 2. See
  [`notebooks/README.md`](notebooks/README.md) and the in-app **Learn** page.

## ⚠️ Important safety notice

Engineering ML Studio is **not a validated safety-critical engineering tool**. It has not been
qualified, certified, or independently verified for use in safety-critical, regulatory, or
life-affecting engineering decisions. Results are for exploration, learning, and non-critical work.
Always independently verify any output before relying on it.

## Documentation

- [`NOTICE.md`](NOTICE.md) — attribution and origin
- [`GOVERNANCE.md`](GOVERNANCE.md) — how the project is run
- [`ROADMAP.md`](ROADMAP.md) — planned phases
- [`docs/WORKPLAN.md`](docs/WORKPLAN.md) — **current status, gaps and the prioritised task list** (start here if you are joining the project)
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how to contribute
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) — local run and test instructions
- [`docs/EXPLORE_MODE.md`](docs/EXPLORE_MODE.md) — the Phase 1 Explore-mode prototype
- [`docs/NEURAL_NETWORK_DEMO.md`](docs/NEURAL_NETWORK_DEMO.md) — the neural network as an advanced option (browser + notebook)
- [`docs/PHASE1_IMPLEMENTATION_PLAN.md`](docs/PHASE1_IMPLEMENTATION_PLAN.md) — Phase 1 plan
- [`docs/PHASE2_LEARN_THE_CODE_PLAN.md`](docs/PHASE2_LEARN_THE_CODE_PLAN.md) — Phase 2 "Learn the Code" plan
- [`docs/PHASE3_PROJECT_MODE_UX_PLAN.md`](docs/PHASE3_PROJECT_MODE_UX_PLAN.md) — Phase 3 Project-mode UX plan
- [`docs/PROJECT_MODE_STAGE_MAPPING.md`](docs/PROJECT_MODE_STAGE_MAPPING.md) — six-stage ↔ eight-panel mapping
- [`notebooks/README.md`](notebooks/README.md) — the Phase 2 teaching notebook
- [`docs/BASELINE_BEHAVIOUR.md`](docs/BASELINE_BEHAVIOUR.md) — current behaviour the tests protect
- [`docs/BASELINE_TEST_REPORT.md`](docs/BASELINE_TEST_REPORT.md) — baseline test run and tooling
- [`docs/PRODUCT_VISION.md`](docs/PRODUCT_VISION.md) — product vision
- [`docs/ARCHITECTURE_AUDIT.md`](docs/ARCHITECTURE_AUDIT.md) — confirmed technical audit
- [`docs/UX_REDESIGN_PLAN.md`](docs/UX_REDESIGN_PLAN.md) — proposed UX redesign
