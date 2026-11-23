# Explore mode (Phase 1 prototype)

> **Prototype.** Explore mode is an early Phase 1 prototype. Its wording, layout, and the set of
> examples and models on offer are expected to change. It is a **training demonstration and learning
> aid**, **not** a validated engineering design tool.

Explore mode is a guided, no-code introduction to regression, framed around a concrete **engineering
problem** rather than around machine-learning terminology. It lets someone who is **not** a
machine-learning specialist start from a mechanical/thermal engineering question, train a model on a
bundled example, compare a simple and a more flexible approach, and read a plain-language explanation
of what the result means **in engineering terms** — without uploading data, writing code, or touching
the full Project workflow.

All calculations run locally in the browser. The only network requests are same-origin fetches of the
bundled example CSV files (`examples/*.csv`).

## The engineering problem it teaches

The default (and primary) example is **predicting the pressure drop along a length of pipe** — a core
mechanical/thermal engineering quantity in any fluid-carrying system (cooling loops, hydraulics,
process piping, HVAC). The journey deliberately **starts from the problem, not from a model name**:

- **What we predict (target):** pressure drop, in **kilopascals (kPa)**.
- **Inputs (with SI units):** pipe length (m), pipe diameter (m), mean flow velocity (m/s), fluid
  density (kg/m³), and dynamic viscosity (Pa·s).
- **Expected physical trends** (stated up front, then checked after training): pressure drop generally
  **increases** when flow velocity or pipe length increases, and **decreases** when the pipe diameter
  increases.

Model names (Linear Regression, Decision Tree, Random Forest) are still shown, but as **secondary**
detail beneath plain-language choices — a beginner is never required to understand them to proceed.

## Where it fits

Engineering ML Studio opens on a **landing page** with a top navigation bar (Home · Explore ·
Project · About) and two primary routes:

- **Explore with an example** → this mode.
- **Build a project** → the full inherited eight-stage workflow, now labelled **Project mode**
  (unchanged in behaviour). See [`BASELINE_BEHAVIOUR.md`](BASELINE_BEHAVIOUR.md).

A third route, **Learn with Python**, is now active (Phase 2): it opens a **Learn** page that links
to a guided Jupyter notebook reproducing this same pressure-drop workflow in Python. Explore's Stage 4
also offers a **"Continue in Python"** call to action to the same page. See
[`PHASE2_LEARN_THE_CODE_PLAN.md`](PHASE2_LEARN_THE_CODE_PLAN.md) and
[`../notebooks/README.md`](../notebooks/README.md).

## The four stages (problem-led)

1. **Understand the pressure-drop problem.** A plain description of the engineering question, the
   inputs and their units, the target and its unit (kPa), the expected physical trends, the range of
   conditions the dataset covers, and a clear **synthetic-data disclaimer**. A lightweight inline
   SVG schematic (no external assets) shows flow through a pipe of length *L* and diameter *D* with a
   pressure drop Δp across it. A collapsed *"Use a different example"* control offers the secondary,
   non-engineering dataset without cluttering the main path.
2. **Choose an approach.** The primary choice is phrased as an engineering decision, **not** an
   algorithm name:
   - **Start with a simple trend** *(uses Linear Regression)* — the default.
   - **Try a tree-based flexible relationship** *(uses Random Forest)* — reveals two beginner controls
     (number of trees, maximum depth).
   - **Try an advanced flexible model** *(uses a Neural Network)* — an **advanced**, non-default
     option that reveals safe neural-network presets (size and training length; learning rate under an
     "Advanced setting"). See [`NEURAL_NETWORK_DEMO.md`](NEURAL_NETWORK_DEMO.md).
   - **Compare approaches** *(Linear Regression, Decision Tree, Random Forest and Neural Network)* —
     trains all four so the beginner can see the trade-off.

   Fine print explains *why* a flexible model can fit a curved relationship that a straight-line trend
   misses, warns that a very flexible model can **overfit** (memorise the training data and generalise
   poorly), and states plainly that **a more complex model is not automatically more accurate or more
   suitable for engineering use**. A collapsed glossary gives one honest sentence per model (see
   below). The neural network is deliberately offered as an *advanced* option, never the default.
3. **Train and compare predictions.** A single **"Train and show predictions"** action runs the
   chosen approach(es). Results appear as a small table with the **target unit shown in every column
   header** — *Test RMSE (kPa)*, *Test R²*, *Training RMSE (kPa)* — and an **actual-vs-predicted**
   scatter plot with a dashed "perfect prediction" diagonal and **kPa on both axes**. When more than
   one approach is trained, a focus selector chooses which model the plot and interpretation describe;
   the best-generalising model (highest test R²) is focused by default.
4. **Interpret the engineering meaning.** Two rule-based, **deterministic** panels:
   - *Reading the result* — what R² and RMSE mean here, the RMSE expressed **in physical units**
     (e.g. "on average about 16.5 kPa out"), whether the training/test gap hints at overfitting, and
     how to read the diagonal plot.
   - *Engineering interpretation* — probes the trained model to check whether it reproduces the
     expected physical trends (Δp up with velocity and length, down with diameter), flags any
     physically implausible behaviour (e.g. negative predictions), restates the error in practical
     units, and asks explicitly **"is the model being used inside its demonstrated range?"** (an
     extrapolation caution). It does **not** claim the model "obeys physics" beyond the specific
     checks it actually performs. All of this text is generated from the numbers by fixed rules —
     **no external AI service is called**.

Every stage carries brief *What you are doing / Why it matters / What to look for* guidance, and
back/next controls. You can restart, return to the landing page, continue into Project mode, or
**continue in Python** (to the Learn page and its notebook) at any time from Stage 4.

## Beginner model explanations (honest, one sentence each)

Shown as secondary glossary detail, deliberately avoiding overstatement:

- **Linear Regression** — learns a single **weighted relationship** that combines the inputs; simple
  and transparent, but it can only capture straight-line trends, so it may miss curved behaviour.
  (It is *not* described as merely "a straight line", because with several inputs it is a weighted
  combination, not one line.)
- **Decision Tree** — **divides the input conditions into regions** and predicts a value for each
  region; it can bend to the data, but a deep tree tends to **overfit** — very low training error yet
  poor predictions on unseen cases.
- **Random Forest** — **combines many trees** and averages them; usually **more stable and accurate**
  than a single tree, but **less transparent**, and like all these models it can **extrapolate
  poorly** outside the range it was trained on.
- **Neural network** — **combines layers of simple units** to learn nonlinear relationships; flexible
  and powerful, but it needs its inputs put on a **common scale**, has **more settings**, **trains
  more slowly**, and can **overfit** small datasets. Offered as an advanced option, not the default,
  and — importantly — not automatically better than the simpler models above.

## The bundled dataset (synthetic, physically-informed)

The primary example uses a **synthetic, documented, physically-informed** dataset created for this
project: [`examples/pipe_pressure_drop_sample.csv`](../examples/pipe_pressure_drop_sample.csv)
(500 rows, fixed seed). It is **not** experimental or design-grade data.

- **Governing physics:** the **Darcy–Weisbach** equation, Δp = f·(L/D)·(ρv²/2), with the Darcy
  friction factor *f* from the Reynolds number Re = ρvD/μ — laminar `f = 64/Re` below Re = 2300 and
  the explicit **Haaland** turbulent correlation above it. Wall roughness is held constant
  (ε = 0.045 mm, typical commercial steel) and is documented, not an input feature.
- **Why this design teaches well:** the laminar/turbulent switch and the nonlinear friction factor
  create a genuinely **curved** relationship. A single linear trend under-fits it, a deep single tree
  over-fits it, and a random forest generalises best — which is exactly the lesson Stage 2 sets up.
  Measured in the browser on this dataset (seed 42, default splits) the contrast is real:

  | Approach | Test R² | Test RMSE (kPa) | Training RMSE (kPa) | What it shows |
  | --- | --- | --- | --- | --- |
  | Linear Regression | ~0.56 | ~26.6 | ~21.1 | captures the main trend, misses the curve (under-fits) |
  | Decision Tree | ~0.68 | ~22.8 | ~6.2 | large train/test gap → clear over-fitting |
  | Random Forest | ~0.83 | ~16.5 | ~10.2 | best of the simpler models |
  | Neural Network (Small preset) | ~0.99 | ~4.8 | ~3.1 | fits this smooth synthetic data very well *here* — but see the caveat below |

  (Indicative values from a representative run; see the generator and tests for exact reproduction.)
  The neural network fits this particular smooth, low-noise synthetic function extremely well in the
  browser; in the `scikit-learn` notebook the same-shaped network does **not** beat the Random Forest.
  That divergence is deliberate and honest — a single strong score does not prove one model type is
  superior. See [`NEURAL_NETWORK_DEMO.md`](NEURAL_NETWORK_DEMO.md) for the full browser-vs-notebook
  comparison.
- **Generator:** [`scripts/generate_pipe_pressure_drop.py`](../scripts/generate_pipe_pressure_drop.py)
  documents the equation, assumptions, sampling ranges, noise model, and limitations; it is
  deterministic (numpy `default_rng`, fixed seed) and validates its own output (positive Δp, finite
  values, sensible ranges). Regenerate with:

  ```bash
  python3 scripts/generate_pipe_pressure_drop.py --rows 500 --seed 42
  ```

- **Provenance and reuse:** see [`../examples/README.md`](../examples/README.md). The dataset and
  generator are new contributions to Engineering ML Studio, released under the project's existing MIT
  terms (copyright in the new contribution held by UKRI).

### Secondary example (kept, clearly labelled)

The inherited generic nonlinear dataset is retained only as a **secondary** option behind *"Use a
different example"*, relabelled **"Explore a generic nonlinear relationship"** and stated to be a
**mathematical demonstration, not an engineering dataset** (it has no units and the Stage 4
engineering-trend checks are replaced by a note that it is not an engineering example). The default is
always the pipe problem. The inherited **house-price** dataset has been **removed from the beginner
Explore path**; the CSV file is **not deleted** (it remains available for Project mode and
compatibility).

## How it reuses the existing engine (no ML duplication)

Explore mode contains **no machine-learning maths of its own**. It orchestrates the same functions
Project mode uses:

- `window.CSVEngine.parse(...)` — parse the example CSV.
- `MLCore.inferColumns`, `MLCore.splitRows` (seed 42; 70 / 15 / 15 train/val/test).
- `MLCore.fitPreprocessor` / `MLCore.transformRows` — standardise numeric inputs, one-hot encode
  categoricals (same config the baseline unit test pins down).
- `MLCore.fitTargetTransform('none')` / `applyTargetTransform` / `fitSmearing` /
  `inverseTargetTransform`.
- `window.LRSPlatform.getModelAdapter(type).fit(...)` / `.predict(...)` — a thin wrapper over
  `MLCore.trainModel` / `MLCore.predict`.
- `MLCore.metrics(actual, predicted)` — `{ r2, rmse, mae, mse, n }`.
- `window.Plotly` — the actual-vs-predicted chart.

It deliberately does **not** call the DOM-coupled `trainAndEvaluate()` in `app.js`; instead it
re-creates the *same computation* through the shared functions above, so no numerical code is
duplicated. The Stage 4 engineering-trend check reuses the **already-fitted** model, preprocessor, and
target transform: it predicts on a median-baseline row while sweeping one input from its 10th to its
90th percentile, so even the trend probing adds no new ML maths. Explore keeps its own small state and
never mutates Project state.

**Safe default parameters** (identical to the Project defaults):

- Linear: `{}` (no hyperparameters).
- Decision Tree: `{ maxDepth: 8 (user 2–15), minLeaf: 5, maxThresholds: 24, maxFeatures: 'all' }`.
- Random Forest: `{ nTrees: 40 (user 10–120), maxDepth: 8 (user 2–15), minLeaf: 5, sampleRate: 0.8,
  maxThresholds: 20, maxFeatures: 'sqrt', maxRowsPerTree: 20000 }`.
- Neural Network (**advanced option, not the default**): safe presets only — size *Small* `(16,)`
  (default) or *Medium* `(32, 16)`; training length *Quick* / *Standard* (default) / *Longer* → 150 /
  300 / 600 max epochs; learning rate `0.01` (default, under a collapsed "Advanced setting", clamped
  `0.0001–0.5`). Fixed safe defaults: `activation: relu`, `optimizer: adam`, `batchSize: 32`,
  `l2: 0.0005`, `dropout: 0`, early stopping on (`patience: 25`, `minDelta: 1e-5`), seed 42. Inputs
  are standardised and the target is scaled internally, with predictions returned in kPa. The network
  is the **inherited** implementation in `js/advanced-core.js` reached through the same model adapter —
  no new algorithm and no new dependency. See [`NEURAL_NETWORK_DEMO.md`](NEURAL_NETWORK_DEMO.md).

## Implementation

| File | Role |
| --- | --- |
| `index.html` | Adds the top nav, `#view-home`, `#view-explore` (four problem-led stages), `#view-about`, and wraps the existing app in `#view-project`. No Project markup removed or reordered. |
| `js/modes.js` (`window.EMSModes`) | Tiny view/router layer: shows one view at a time, syncs the nav, mode indicator and URL hash, dispatches an `ems:modechange` event. |
| `js/explore.js` (`window.EMSExplore`) | Explore controller: the problem description + schematic, the approach/stage machine, the shared training pipeline, Plotly rendering, and the rule-based reading + engineering interpretation. |
| `css/explore.css` | Landing + Explore styling, reusing the existing design tokens and component classes. |
| `js/bootstrap.js` | Loads `modes.js` then `explore.js` after `app.js`. |
| `scripts/generate_pipe_pressure_drop.py` | Documented, deterministic generator for the synthetic pressure-drop dataset. |
| `examples/pipe_pressure_drop_sample.csv` | The bundled synthetic dataset (500 rows, seed 42). |

## Shareable Explore links

Explore supports direct links to each of its five activities. These links open the Explore view with the requested example selected:

| URL hash | Activity |
| --- | --- |
| `#explore` | Opens Explore with Pipe selected by default. |
| `#explore/pipe` | Pipe pressure drop |
| `#explore/fin` | Fin heat dissipation |
| `#explore/steel` | Steel strength |
| `#explore/orifice` | Orifice flow |
| `#explore/nonlinear` | Nonlinear demonstration |

Selecting a different example updates the URL and creates a browser history entry. The browser Back and Forward controls restore the previously selected examples. Unsupported or malformed routes, such as `#explore/unknown`, fall back to Home.

These links make it possible to share a specific Explore activity with another user without requiring them to navigate through the example selector.

## Accessibility and responsiveness

Semantic HTML (`nav`, `section`, `ol`, headings, `label`led controls), a skip link, keyboard-operable
navigation and actions, visible focus outlines, `aria-current`/`aria-live` where appropriate, status
conveyed by text and shape (not colour alone), and a layout that reflows to a narrow/mobile viewport
without horizontal scrolling. This is sound accessible practice, not a full WCAG audit.

## Deliberate non-goals (this prototype)

- No new ML algorithms and no changes to existing ML calculations. The neural network offered in
  Explore is the **already-inherited** network in `js/advanced-core.js`, surfaced through the existing
  model adapter with a thin preset/UI layer — it is not a new or duplicated model, and it adds no
  runtime dependency (no TensorFlow.js, Pyodide, or server-side compute).
- No frontend framework, bundler, server, database, accounts, or cloud/AI APIs; Plotly is not
  replaced.
- No changes to Project mode's layout or logic, and no removal of preprocessing, diagnostics, export,
  prediction, monitoring, or governance features. The inherited datasets are **not** deleted.
- The Python/notebook link is one-way and static: Explore does **not** transfer its in-browser
  state, models, or numbers to the notebook — the Learn page simply points to a notebook that
  reproduces the same workflow independently (see Phase 2).
- No deployment or GitHub Pages changes.

## Limitations (stated honestly)

- The pressure-drop dataset is **synthetic** and physically-*informed*, not experimental or validated.
  It is a **training demonstration**, not an engineering design tool; do not use its numbers for real
  design decisions.
- The physics model itself is simplified: fully-developed, steady, single-phase, incompressible flow
  in a straight constant-diameter pipe with **no fittings, bends, entrance, or elevation losses**;
  constant wall roughness; a hard laminar/turbulent switch at Re = 2300 (real transitional flow is not
  modelled in detail).
- The model's "engineering interpretation" verifies only the **specific** trend and plausibility
  checks it performs, over the **demonstrated input range**. It is not a guarantee of physical
  correctness and says nothing about behaviour outside that range.

## Tests

`tests/explore.spec.js` (Playwright, all under `?localOnly=1`) covers the problem-led flow: landing
loads; both routes offered; Project reveals its workflow; return home; the four stages and the
pressure-drop framing; Stage 1 units/target/trend/disclaimer and the inline SVG schematic; Stage 2
showing **approaches (not algorithm names)** with *simple* as default, model names as secondary
detail, and the glossary; the simple approach training Linear with a **kPa** metric header; the
tree-based flexible approach revealing its controls and using Random Forest; the flexible approach
achieving a higher test R² than linear (read from live in-browser results); *Compare* producing four
rows (Linear, Tree, Forest, Neural Network) and a focus selector; the actual-vs-predicted plot
labelled in kPa; Stage 4 reading (R² + kPa) and the engineering trend/extrapolation checks; the
secondary generic example being labelled a maths demonstration; no non-local network requests;
keyboard reachability; and no horizontal overflow at a narrow viewport.

The neural network is covered by dedicated tests: the **advanced** option is offered but **not**
checked by default; selecting it reveals only the safe presets with the learning rate hidden under an
"Advanced setting" and a plain-language scaling note; it trains a network that reports finite metrics
in **kPa**; results are **deterministic** across a fresh reload (same RMSE/R²); the training-curve
diagnostic starts collapsed; the Stage 4 interpretation names convergence, the comparison to the tree
ensemble ("does not establish" superiority), extrapolation, and physical validation; and training the
network makes no non-local requests. `tests/unit.spec.js` adds browser-network unit checks
(determinism for a fixed seed, finite/correctly-shaped predictions and recorded training history, the
Small preset learning a synthetic function, and early stopping respecting the epoch cap).

`tests/test_pipe_dataset.py` (Python `unittest`, standard library + numpy) covers the generator:
expected columns/units, requested row count, strictly-positive and finite pressure drops, sensible
ranges, determinism for a fixed seed, different seeds differing, `validate()` accepting generated
data, and the **bundled CSV matching a fresh default generation byte-for-byte**.

All inherited baseline tests remain green.
