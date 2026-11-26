# D3a — Worker-training proposal

**Status:** Browser benchmark completed and re-measured after review (2026-11-26); implementation recommendation
**Scope:** Proposal only. No worker-training implementation or model-algorithm changes are included.

## Decision summary

- **Proceed to D3b, but put the worker boundary at the training *job*, not at `MLCore.trainModel`.** What freezes the tab is the whole Project-mode Train click — preprocessing, the fit, prediction-interval refits, predictions for diagnostics and cross-validation — and at the proposed 10,000-row target that is 3–76 s for every model. The single fit is often a small part of it (table 2).
- **Run every model through the worker**, on one code path, with the existing main-thread path retained as the fallback. A per-model split is not justified by the measurements: even linear regression freezes the tab for about 4 s at 10k rows, and the per-job payload copy (about 2.4 MB at 10k × 30) is negligible against that.
- **k-nearest neighbours is the most urgent case, not a "keep on main thread" case.** Its fit is 1.5 ms, but a default Train click at 10k rows takes 76 s, because every training, validation and test prediction scans the stored rows.
- **Profile the model-independent overhead first** (about 3–4 s at 10k rows for every model). Whatever part of it is rendering — e.g. Plotly drawing every diagnostic point — stays on the main thread and is *not* fixed by a worker; it needs a separate presentation change.
- Do not change model algorithms or remove existing row limits.

## Method

All numbers below come from one machine and one harness, so they are comparable with each other: Intel Core i9-10980XE (3.0 GHz), Linux, headless Chromium 131 via Playwright 1.49.1, fixed seed 42, `?localOnly=1`. Data: 30 uniform features in [−1, 1], target `1.5·x0 − 0.8·x1 + 0.25·x2·x3` plus small noise (see `tests/worker-training-benchmark.spec.js`).

**Absolute times depend heavily on hardware.** The first version of this table was measured on an unrecorded machine roughly 2.5–3× faster per core than this one (e.g. quantile regression at 10k rows: 4.2 s there, 9.9 s here). Classroom and corporate laptops will vary by at least that much. Read the *ratios* between models and between columns; treat the absolute values as indicative only.

Reproduce:

```bash
EMS_TRAINING_BENCHMARK=full     EMS_BENCH_TIMEOUT_MS=600000 npx playwright test tests/worker-training-benchmark.spec.js
EMS_TRAINING_BENCHMARK=pipeline EMS_BENCH_SIZES=1000,10000  npx playwright test tests/worker-training-benchmark.spec.js
```

## Table 1 — single fit (`MLCore.trainModel`), application default parameters

Median of 3 measured runs after a warm-up (1 run at 50k rows), milliseconds. `LIMIT` = an existing model guard rejects that size; guards were not bypassed.

| Model | 1k rows × 30 | 10k rows × 30 | 50k rows × 30 |
|---|---:|---:|---:|
| Linear regression (`linear`) | 7.5 | 42 | 97 |
| Ridge regression (`ridge`) | 7.2 | 37 | 146 |
| Elastic net (`elasticnet`) | 20 | 179 | 376 |
| Huber robust regression (`robust`) | 64 | 296 | 2,176 |
| Decision tree (`tree`) | 79 | 840 | 3,731 |
| Random forest (`forest`) | 871 | 6,140 | 16,772 |
| Gradient-boosted trees (`gboost`) | 2,853 | 24,758 | 174,681 |
| k-nearest neighbours (`knn`) | 0.3 | 1.5 | LIMIT (25,000) |
| Linear quantile regression (`quantile`) | 1,947 | 9,937 | 47,753 |
| Gaussian process (`gp`) | 545 | LIMIT (2,000) | LIMIT (2,000) |
| Neural network (`ann`) | 14,886 | 69,744 | 135,057 |

Notes:

- The first version capped each run at 8 s and recorded `>8s` for forest, gradient boosting and the neural network at 10k rows — exactly the cells that matter at the proposed target size. They are now measured to completion.
- The forest row first used `maxFeatures: 'all'` and 24 thresholds; the application default is `'sqrt'` and 20, about 4× cheaper at 10k rows. The harness now mirrors the real defaults.
- The neural-network row is a worst case: with no validation set, early stopping watches the training loss, which keeps falling, so every run uses all 150 epochs. In the application a validation set is supplied and training usually stops earlier.

## Table 2 — what the user waits for: a default Project-mode Train click

One run per cell, milliseconds, from clicking **Train** to the metrics table appearing: upload already done, default settings (70/15/15 split, prediction intervals on — 30 bootstrap refits for ridge — and cross-validation off). A 10k-row CSV gives about 7,000 training rows.

| Model | 1k-row CSV | 10k-row CSV | Fit alone at 10k (table 1) |
|---|---:|---:|---:|
| `linear` | 1,220 | 4,235 | 42 |
| `ridge` | 1,065 | 4,729 | 37 |
| `elasticnet` | 761 | 3,342 | 179 |
| `robust` | 1,031 | 4,323 | 296 |
| `tree` | 943 | 5,980 | 840 |
| `forest` | 1,341 | 7,230 | 6,140 |
| `gboost` | 2,480 | 19,068 | 24,758 |
| `knn` | 1,601 | **75,798** | 1.5 |
| `quantile` | 2,173 | 8,296 | 9,937 |
| `gp` | 3,521 | LIMIT | LIMIT |
| `ann` | 8,114 | 34,098 | 69,744 |

What this changes:

1. **Every model freezes the tab for seconds at 10k rows.** About 3–4 s of each Train click is model-independent (linear, ridge and elastic net differ little). D3b should profile that first: computation in it (prediction intervals, diagnostics, hashing for the experiment record) can move to the worker; rendering cannot.
2. **kNN is the slowest model in the application at 10k rows**, entirely because of prediction, which the first version did not measure. It must go through the worker, and its progress reporting should cover prediction, not just fitting.
3. **Turning on cross-validation, hyper-parameter search or larger bootstrap counts multiplies the fit cost** (k + 1 fits for k-fold cross-validation; one fit per search trial). These are loops *around* `trainModel`. A worker boundary at `trainModel` would copy the training matrix across once per fit; a job-level boundary copies it once.
4. **For the target-size decision (WORKPLAN §8, question 2):** at 10k rows on this machine a default Train click is about 3–8 s for most models, 19 s for gradient boosting, 34 s for the neural network and 76 s for kNN. A worker makes these waits responsive and cancellable; it does not shorten them. Whether a minute-long kNN run is acceptable in a classroom is a product decision, not a D3b one.

## Cooperative cancellation

**Decision:** Do not attempt to interrupt synchronous JavaScript from the worker message handler. A worker cannot process a `CANCEL` message while it is executing a synchronous loop. For D3b, add cooperative yields only at natural outer-loop boundaries in the models selected for worker execution, then check cancellation immediately after each yield.

Existing trainer patterns already provide some suitable boundaries:

- Forest: between trees; already checks cancellation and yields between trees.
- Gradient boosting: between estimators; already checks cancellation and yields periodically.
- ANN: between epochs; already checks cancellation and yields periodically, but one epoch can still be long.
- GP: between optimisation iterations; matrix factorisation / `fitGPState` itself remains synchronous and may be the longest uninterruptible section.
- Quantile: between iterations; each iteration scans all rows/features, so a large iteration can still block cancellation.
- Tree: recursive tree construction is synchronous and has no useful yield point without a more invasive refactor.
- kNN: yield and check cancellation between blocks of query rows during prediction — that, not fitting, is where its 76 s at 10k rows goes (table 2).
- Linear, ridge, elastic net and robust regression: do not add yield machinery in the first pass; their fits are short, and the remaining wait is the model-independent overhead.

The implementation should avoid rewriting inherited algorithms. First instrument the existing natural boundaries. If one uninterrupted unit remains too long, D3b should make the smallest targeted change to split that unit; otherwise document the residual cancellation latency. Do not promise immediate cancellation.

## Progress reporting

**Decision:** Reuse `worker-client.js`'s existing `PROGRESS` handling; add an optional progress callback to trainer entry points and emit progress at existing outer-loop boundaries. Do not invent a second progress protocol or restructure the trainers.

Suggested hooks:

- Forest: completed trees / configured tree count.
- Gradient boosting: completed estimators / configured estimator count.
- ANN: completed epochs / configured epoch count.
- GP: completed optimisation iterations / configured iteration count.
- Quantile: report each of the three quantile fits and iteration progress within the current fit.
- Tree: no granular progress in the first pass; report start/completion unless the tree implementation is split.
- kNN: prediction progress (query rows completed / total) for training, validation and test predictions.
- Linear, ridge, elastic net and robust regression: start/completion only.
- All models: report the job's stages (preprocessing, fitting, intervals, evaluation) so the long model-independent part is visible too.

Progress messages must be throttled where necessary so reporting does not become a significant part of training cost.

## Payload cost and structured cloning

**Decision:** Send one *training job* per Train click. The main thread reads the form controls (model type, parameters, split, seed, preprocessing, interval and cross-validation settings — about a dozen values that `trainAndEvaluate` in `js/app.js` currently reads inline) and posts them with the raw rows. The worker runs split → preprocess → tune → fit → interval refits → predictions and metrics → cross-validation, unchanged and in the same order, and returns the model artifact plus the evaluation numbers. Rendering, the experiment record and all DOM work stay on the main thread.

To keep results bit-identical and the fallback honest, extract that compute section into one pure function that both the worker and the main-thread fallback call. That is the main refactor in D3b; it moves code without changing what it computes.

Plain arrays, numbers, strings, booleans and plain objects are structured-cloneable; functions, DOM nodes and closures are not. Audit each model artifact before enabling it; do not assume every result is cloneable.

At 10k × 30 the numeric payload is about 2.4 MB (12 MB at 50k × 30) before nested-array overhead. Against multi-second jobs a single copy is very likely negligible, but D3b should measure post-to-start and result-return time separately from compute. Transferable typed arrays are a follow-up only if that measurement says so.

## D3b go/no-go by model

Every model goes through the worker on the same job path; the table records priority and the specific risk for each.

| Model | D3b | Default Train click at 10k | Specific risk |
|---|---|---:|---|
| `knn` | **Go — first** | 76 s | Cost is prediction, not fitting; progress must cover prediction |
| `ann` | **Go — first** | 34 s | Long epochs limit cancellation latency |
| `gboost` | **Go — first** | 19 s | Already yields between estimators |
| `quantile` | Go | 8 s | Large iterations block cancellation |
| `forest` | Go | 7 s | Already yields between trees |
| `tree` | Go | 6 s | Recursive build has no yield point; report start/finish only |
| `linear`, `ridge`, `elasticnet`, `robust` | Go (same path) | 3–5 s | Time is mostly model-independent overhead; profile it |
| `gp` | Go, within its 2,000-row limit | 3.5 s at 1k | Synchronous factorisation cannot be interrupted |

All worker decisions retain graceful fallback to the main-thread path when `Worker` is unavailable or worker setup fails.

## D3b estimate

**Estimate: 8 working days** (the top of the workplan's 5–8 day range). The first version said 6 days for a `trainModel`-level boundary; the measurements move the boundary to the whole job, which adds the extraction of the compute section of `trainAndEvaluate` and coverage of interval refits, prediction and cross-validation.

1. **Day 1:** profile a 10k-row Train click to attribute the ~3–4 s model-independent overhead between computation and rendering. Write the bit-identical comparison test against the current main-thread path (WORKPLAN D3b: test first).
2. **Days 2–3:** extract the compute section of `trainAndEvaluate` into one pure function called on the main thread; the full suite and the bit-identical test must stay green with no worker involved yet.
3. **Day 4:** `TRAIN_JOB` message in `js/lrs-worker.js` (`importScripts` the three core modules), timeout override (the 15 s default in `WorkerClient.request()` is far too short — see table 2), fallback wiring.
4. **Days 5–6:** migrate model by model, one commit each, starting with `knn`, `ann`, `gboost`; progress callbacks and cooperative cancellation at the boundaries described above.
5. **Day 7:** browser tests for progress, cancellation, unavailable-worker fallback and timeout handling; re-run tables 1 and 2.
6. **Day 8:** documentation, regressions, review.

If profiling shows most of the overhead is rendering, fixing that (e.g. downsampling plotted points) is a separate presentation task, not D3b. If GP factorisation or tree construction must be made internally cooperative, add 1–2 days and re-estimate before expanding scope.

## Acceptance criteria for D3a

- [x] Reviewed existing worker client and trainer behaviour.
- [x] Identified existing GP and kNN size limits; no guards bypassed.
- [x] Measured all 33 fit configurations to completion, with application default parameters (table 1).
- [x] Measured the end-to-end default Train click for every model at 1k and 10k rows (table 2).
- [x] Recorded hardware and browser, and how to reproduce.
- [x] Settled cancellation, progress, payload and worker boundary, per-model direction and D3b estimate.
