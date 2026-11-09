# D3a — Worker-training proposal

**Status:** Browser benchmark completed; implementation recommendation
**Scope:** Proposal only. No worker-training implementation or model-algorithm changes are included.

## Decision summary

- Proceed to D3b with Web Workers for the more expensive training workloads, while retaining the existing main-thread training path as a fallback.
- Move random forest (`forest`), gradient-boosted trees (`gboost`), neural network (`ann`) and quantile regression (`quantile`) towards worker-based training.
- Treat decision-tree regression (`tree`) as a worker candidate for larger datasets, subject to a suitable cancellation design.
- Consider Gaussian process (`gp`) worker support only within its existing 2,000-row hard limit.
- Keep linear regression (`linear`), ridge regression (`ridge`), elastic net (`elasticnet`), robust regression (`robust`) and k-nearest neighbours (`knn`) on the main thread initially.
- Do not change model algorithms or remove existing row limits as part of D3a.

## Timing table

Default application trainer parameters were used, with fixed seed 42. Each successful cell reports the median elapsed training time in milliseconds from three measured repetitions. `>8s` means the bounded training run exceeded the 8-second timeout. `LIMIT` means the existing model guard rejected the requested row count. These are browser-main-thread training measurements, not worker timings.

| Model | 1k rows × 30 | 10k rows × 30 | 50k rows × 30 | D3b direction |
|---|---:|---:|---:|---|
| Linear regression (`linear`) | 1.3 | 12.2 | 33.3 | **No-go**; keep on main thread |
| Ridge regression (`ridge`) | 1.2 | 17.4 | 39.4 | **No-go**; keep on main thread |
| Elastic net (`elasticnet`) | 3.5 | 24.9 | 121.0 | **No-go** initially; keep on main thread |
| Huber robust regression (`robust`) | 12.0 | 126.8 | 692.4 | **No-go** initially; monitor larger workloads |
| Decision-tree regression (`tree`) | 23.1 | 350.0 | 2513.9 | **Go** for larger workloads, subject to cancellation design |
| Random forest (`forest`) | 858.1 | >8s | >8s | **Go**; expensive iterative tree training |
| Gradient-boosted trees (`gboost`) | 885.8 | >8s | >8s | **Go**; expensive at larger sizes |
| k-nearest neighbours (`knn`) | 0.1 | 0.6 | LIMIT (25,000-row hard limit) | **No-go** for training-only worker; prediction is a separate workload |
| Linear quantile regression (`quantile`) | 805.5 | 4165.2 | >8s | **Go** for larger workloads |
| Gaussian process (`gp`) | 217.3 | LIMIT (2,000-row hard limit) | LIMIT (2,000-row hard limit) | **Go** within the existing GP row limit |
| Neural network (`ann`) | 4945.8 | >8s | >8s | **Go**; expensive even at 1k rows |

### Measurement caveats and completion evidence

- Measurements ran through the browser's existing `MLCore.trainModel` dispatch on the main thread.
- The input matrix contained 30 deterministic numeric features and a deterministic numeric target, generated using fixed seed 42.
- The benchmark attempted all 33 model/size configurations: 11 models at 1k, 10k and 50k rows.
- Successful configurations report the median of three measured repetitions. The reported values are elapsed training times in milliseconds.
- The benchmark uses an 8-second training timeout. A `>8s` result is a lower bound, not an exact measurement of how long the trainer would take if allowed to continue.
- GP at 10k/50k and kNN at 50k were rejected by their existing hard limits. Do not alter or bypass those guards to fill a timing cell.
- The benchmark measures training time only. In particular, kNN prediction latency is a separate workload and has not been measured here.
- The benchmark harness should be retained as the D3b comparison harness. D3b should add worker-vs-main-thread output comparison using the same seed, data, model parameters and target-transform assumptions. Timing is diagnostic, not the correctness gate.

## Cooperative cancellation

**Decision:** Do not attempt to interrupt synchronous JavaScript from the worker message handler. A worker cannot process a `CANCEL` message while it is executing a synchronous loop. For D3b, add cooperative yields only at natural outer-loop boundaries in the models selected for worker execution, then check cancellation immediately after each yield.

Existing trainer patterns already provide some suitable boundaries:

- Forest: between trees; already checks cancellation and yields between trees.
- Gradient boosting: between estimators; already checks cancellation and yields periodically.
- ANN: between epochs; already checks cancellation and yields periodically, but one epoch can still be long.
- GP: between optimisation iterations; matrix factorisation / `fitGPState` itself remains synchronous and may be the longest uninterruptible section.
- Quantile: between iterations; each iteration scans all rows/features, so a large iteration can still block cancellation.
- Tree: recursive tree construction is synchronous and has no useful yield point without a more invasive refactor.
- Linear, ridge, elastic net, robust regression and kNN: do not add yield machinery in the first pass unless implementation requirements or further measurements change the go/no-go decision.

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
- Linear, ridge, elastic net, robust regression and kNN: start/completion only.

Progress messages must be throttled where necessary so reporting does not become a significant part of training cost.

## Payload cost and structured cloning

**Decision:** Send only the training request inputs and options; do not send the UI, DOM objects, callbacks, or application state. The worker request should contain a request ID/type envelope plus model ID, `X`, `y`, params and seed. The result should contain the trained model artifact and serializable training metadata/history needed by the caller.

Plain arrays, numbers, strings, booleans and plain objects are structured-cloneable. Functions, DOM nodes and closures are not. Audit each model artifact before enabling it in the worker; do not assume every model result is cloneable without checking.

At 50,000 × 30, there are 1.5 million numeric feature values. The raw numeric payload is about 12 MB as Float64 values, before row-array/object overhead; nested JavaScript arrays can cost substantially more and structured cloning may add a noticeable copy. D3b should measure request preparation/postMessage-to-start and result-return overhead separately from trainer time. Do not change the application's matrix representation solely on assumption. If payload overhead is material, a transferable typed-array buffer can be considered as a follow-up, but only with a clear representation contract and tests proving identical values.

## D3b go/no-go by model

| Model | Recommendation for D3b |
|---|---|
| `linear` | Keep on main thread |
| `ridge` | Keep on main thread |
| `elasticnet` | Keep on main thread; measured 50k training median is 121.0 ms |
| `robust` | Keep on main thread initially; monitor UI impact at larger sizes |
| `tree` | Worker candidate for larger datasets; first resolve long synchronous tree-build cancellation behaviour |
| `forest` | Worker |
| `gboost` | Worker |
| `ann` | Worker; investigate long epoch duration and cancellation latency |
| `quantile` | Worker for medium/large fits |
| `gp` | Worker only within the existing GP row limit; synchronous factorisation remains a cancellation-latency risk |
| `knn` | Keep training on main thread; separately evaluate prediction latency |

All worker decisions retain graceful fallback to the current main-thread path when `Worker` is unavailable or worker setup/training fails.

## D3b estimate

**Estimate: 6 working days** (within the workplan's 5–8 day range), assuming the existing worker request/response and progress/cancel plumbing can be reused and no model algorithm or saved-project schema changes are required.

1. **Day 1:** implement `TRAIN` worker dispatch, load the existing core modules in the worker, and add version/cache-busting updates.
2. **Days 2–3:** connect selected trainers, progress callbacks and cancellation checks at the natural boundaries described above; retain main-thread fallback.
3. **Day 4:** add deterministic main-thread-vs-worker equivalence tests for all worker-enabled models and the reusable baseline harness.
4. **Day 5:** browser tests for cancellation, progress, unavailable-worker fallback, timeout handling and representative dataset sizes.
5. **Day 6:** run full Python and Playwright suites, inspect payload/performance results, update docs, and resolve regressions.

This estimate assumes testing and review reveal no need for invasive algorithm rewrites. If GP factorisation or tree construction must be made internally cooperative, add 1–2 days and re-estimate before expanding scope.

## Acceptance criteria for D3a

- [x] Reviewed existing worker client and trainer behaviour.
- [x] Identified existing GP and kNN size limits; no guards bypassed.
- [x] Captured initial timings for feasible configurations; timeouts and rejected sizes are explicitly recorded.
- [x] Ran and recorded the browser-main-thread timing matrix (33 configurations, with repeated measurements).
- [x] Settled cancellation, progress, payload, per-model direction and D3b estimate in this proposal.
- [x] Updated the proposal using the browser benchmark results.