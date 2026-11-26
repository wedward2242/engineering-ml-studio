// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 UK Research and Innovation (UKRI)
//
// D3a: browser main-thread training benchmark.
// Opt in with EMS_TRAINING_BENCHMARK=smoke, =full or =pipeline.
//
//   full      times MLCore.trainModel alone (one fit, default parameters).
//   pipeline  times a real Project-mode "Train" click with default settings,
//             from click to metrics table: preprocessing, the fit, prediction
//             intervals (30 bootstrap refits for ridge), diagnostics and
//             rendering. This is what the user actually waits for.
//
// Optional overrides (defaults reproduce the original D3a table):
//   EMS_BENCH_MODELS=forest,ann   EMS_BENCH_SIZES=10000
//   EMS_BENCH_REPETITIONS=1       EMS_BENCH_TIMEOUT_MS=600000
// This file measures existing training behaviour only. It does not implement
// worker training or change any model algorithms.

const { test, expect } = require('@playwright/test');

const MODE = process.env.EMS_TRAINING_BENCHMARK || 'off';

const ALL_MODELS = [
  'linear',
  'ridge',
  'elasticnet',
  'robust',
  'tree',
  'forest',
  'gboost',
  'knn',
  'quantile',
  'gp',
  'ann'
];

function envList(name, fallback, parse) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.split(',').map(v => v.trim()).filter(Boolean).map(parse || (v => v));
}

const MODELS = envList('EMS_BENCH_MODELS', ALL_MODELS);
const SIZES = envList('EMS_BENCH_SIZES', [1000, 10000, 50000], Number);
const FEATURES = 30;
const SEED = 42;
const REPETITIONS = Number(process.env.EMS_BENCH_REPETITIONS) || 3;
const TRAINING_TIMEOUT_MS = Number(process.env.EMS_BENCH_TIMEOUT_MS) || 8000;

// These are existing implementation limits, not benchmark-imposed limits.
const MODEL_LIMITS = {
  gp: 2000,
  knn: 25000
};

test.skip(
  !['smoke', 'full', 'pipeline'].includes(MODE),
  'Opt-in D3a benchmark. Set EMS_TRAINING_BENCHMARK=smoke, full or pipeline.'
);

function median(values) {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// A Node-side timeout is important because synchronous training can block
// the browser page's own event loop.
async function evaluateWithTimeout(page, expression, args, timeoutMs) {
  let timer;

  const operation = page.evaluate(expression, args);

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('BENCHMARK_TIMEOUT')),
      timeoutMs
    );
  });

  try {
    return await Promise.race([operation, timeout]);
  } catch (error) {
    if (error.message === 'BENCHMARK_TIMEOUT') {
      // Closing the page terminates the timed-out run. Don't wait indefinitely
      // for a renderer that may be blocked by synchronous training.
      void page.close().catch(() => {});
      await Promise.race([operation.catch(() => {}), delay(100)]);
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function openApplication(page) {
  await page.goto('/?localOnly=1');

  await page.waitForFunction(
    () => !!(window.MLCore && window.LocalRegressionApp)
  );

  // Confirm that the fully wrapped training entry point exists.
  await page.waitForFunction(
    () => typeof window.MLCore.trainModel === 'function'
  );
}

async function prepareData(page, rows) {
  return page.evaluate(({ rows, features, seed }) => {
    const rng = window.MLCore.mulberry32(seed);

    // Generate data outside the measured training interval.
    const X = Array.from(
      { length: rows },
      () => Array.from(
        { length: features },
        () => rng() * 2 - 1
      )
    );

    // A deterministic regression target with linear and nonlinear terms.
    const y = X.map(
      row =>
        1.5 * row[0] -
        0.8 * row[1] +
        0.25 * row[2] * row[3] +
        0.05 * (rng() - 0.5)
    );

    window.__D3aBenchmarkData = { X, y };

    return {
      rowCount: X.length,
      featureCount: X[0].length,
      targetCount: y.length,
    };
  }, {
    rows,
    features: FEATURES,
    seed: SEED
  });
}

// Mirror the parameters read by the existing application's
// getModelParameters() mirrors the default model parameters defined in js/app.js.
async function getModelParameters(_page, modelType) {
  const defaults = {
    linear: {},

    ridge: {
      lambda: 1
    },

    elasticnet: {
      lambda: 0.1,
      l1Ratio: 0.5,
      maxIterations: 500,
      tolerance: 1e-6
    },

    robust: {
      huberDelta: 1.345,
      maxIterations: 80,
      tolerance: 1e-6,
      ridge: 1e-8
    },

    tree: {
      maxDepth: 8,
      minLeaf: 5,
      maxThresholds: 24,
      maxFeatures: 'all'
    },

    forest: {
      nTrees: 40,
      maxDepth: 8,
      minLeaf: 5,
      sampleRate: 0.8,
      maxThresholds: 24,
      maxFeatures: 'all',
      maxRowsPerTree: 20000
    },

    gboost: {
      nEstimators: 80,
      learningRate: 0.05,
      maxDepth: 3,
      minLeaf: 5,
      sampleRate: 0.8,
      maxThresholds: 20
    },

    knn: {
      k: 7,
      weighting: 'distance',
      distancePower: 2,
      maxRows: 25000
    },

    quantile: {
      quantile: 0.5,
      lower: 0.025,
      upper: 0.975,
      iterations: 1500,
      learningRate: 0.03,
      l2: 0.0001
    },

    gp: {
      gpMode: 'exact',
      kernel: 'rbf',
      lengthScale: 1,
      signalVariance: 1,
      noiseStd: 0.1,
      jitter: 1e-8,
      optimizeIterations: 0,
      rqAlpha: 1,
      subsetSize: 500,
      subsetMethod: 'farthest',
      autoSubsetMin: 100,
      autoSubsetMax: 1000,
      autoSubsetCount: 5,
      subsetTolerance: 0.01,
      gpHardLimit: 2000
    },

    ann: {
      hidden1: 64,
      hidden2: 0,
      hidden3: 0,
      activation: 'relu',
      optimizer: 'adam',
      learningRate: 0.001,
      batchSize: 32,
      epochs: 150,
      dropout: 0,
      l2: 0,
      patience: 20,
      minDelta: 1e-5,
      earlyStopping: true,
      uncertaintyMethod: 'mc',
      mcPasses: 50,
      ensembleSize: 3,
      annHardLimit: 1000000
    }
  };

  if (!Object.prototype.hasOwnProperty.call(defaults, modelType)) {
    throw new Error(`No benchmark parameters defined for model: ${modelType}`);
  }

  return defaults[modelType];
}

async function trainOnce(page, modelType, X, y, params) {
  return evaluateWithTimeout(
    page,
    async ({ modelType, params, seed }) => {
      const { X, y } = window.__D3aBenchmarkData;

      const start = performance.now();
      const model = await window.MLCore.trainModel(
        modelType, X, y, params, seed, null, null
      );

      const elapsedMs = performance.now() - start;

      if (!model) {
        throw new Error(`${modelType} returned no model`);
      }

      return {
        elapsedMs,
        modelKind: model.kind || model.type || typeof model
      };
    },
    {
      modelType,
      params,
      seed: SEED
    },
    TRAINING_TIMEOUT_MS
  );
}

async function benchmarkCombination(page, modelType, rows) {
  const result = {
    model: modelType,
    rows,
    features: FEATURES,
    seed: SEED,
    warmupMs: null,
    repetitionsMs: [],
    medianMs: null,
    status: 'pending',
    detail: null
  };

  const limit = MODEL_LIMITS[modelType];

  if (limit && rows > limit) {
    result.status = 'limit';
    result.detail = `Existing model limit: ${limit} rows`;
    return result;
  }

  try {
    await openApplication(page);

    const data = await prepareData(page, rows);

    if (
      data.rowCount !== rows ||
      data.featureCount !== FEATURES ||
      data.targetCount !== rows
    ) {
      throw new Error('Generated dataset dimensions are incorrect');
    }

    const params = await getModelParameters(page, modelType);

    // Warm-up is reported separately and excluded from the median.
    const warmup = await trainOnce(
      page,
      modelType,
      data.X,
      data.y,
      params
    );

    result.warmupMs = warmup.elapsedMs;

    for (let i = 0; i < REPETITIONS; i++) {
      const measurement = await trainOnce(
        page,
        modelType,
        data.X,
        data.y,
        params
      );

      result.repetitionsMs.push(measurement.elapsedMs);
    }

    result.medianMs = median(result.repetitionsMs);
    result.status = 'ok';
    result.detail = `Completed ${result.repetitionsMs.length} measured runs`;
  } catch (error) {
    if (error.message === 'BENCHMARK_TIMEOUT') {
      result.status = 'timeout';
      result.detail = `Training exceeded ${TRAINING_TIMEOUT_MS} ms`;
    } else {
      result.status = 'error';
      result.detail = String(error.message || error).slice(0, 500);
    }
  }

  return result;
}

test('D3a browser main-thread training benchmark', async ({ page }, testInfo) => {
  test.skip(MODE === 'pipeline', 'pipeline mode runs the end-to-end benchmark only');
  test.setTimeout(MODE === 'full' ? 30 * 60 * 1000 : 60_000);

  const cases = MODE === 'smoke'
    ? [{ model: 'linear', rows: 1000 }]
    : SIZES.flatMap(rows => MODELS.map(model => ({ model, rows })));

  const results = [];

  // Use the existing fixture context to make replacement pages after timeouts.
  const context = page.context();
  let currentPage = page;

  for (const item of cases) {
    const result = await benchmarkCombination(
      currentPage,
      item.model,
      item.rows
    );

    results.push(result);

    console.log(
      `[D3a benchmark] ${result.model}, ${result.rows} rows: ` +
      `${result.status}` +
      (result.medianMs !== null ? `, median ${result.medianMs.toFixed(1)} ms` : '') +
      (result.detail ? ` (${result.detail})` : '')
    );

    if (currentPage.isClosed()) {
      currentPage = await context.newPage();
    }
  }

  console.log(
    'WORKER_TRAINING_BENCHMARK_RESULTS=' + JSON.stringify(results)
  );

  if (MODE === 'smoke') {
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('ok');
    expect(results[0].medianMs).toBeGreaterThanOrEqual(0);
    expect(results[0].repetitionsMs).toHaveLength(REPETITIONS);
  } else {
    expect(results).toHaveLength(MODELS.length * SIZES.length);

    const errors = results.filter(result => result.status === 'error');

    expect(errors, 'Unexpected benchmark errors').toEqual([]);
  }
});

// ---------------------------------------------------------------------------
// End-to-end Project-mode benchmark (EMS_TRAINING_BENCHMARK=pipeline).
// ---------------------------------------------------------------------------

// Same data-generating formula as prepareData(), written as a CSV so it goes
// through the real upload, profiling and preprocessing path.
function benchmarkCsv(rows) {
  let state = SEED >>> 0;
  const rng = () => {
    // mulberry32, identical to MLCore.mulberry32
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const header = Array.from({ length: FEATURES }, (_, i) => 'x' + i).concat('y');
  const lines = [header.join(',')];
  for (let r = 0; r < rows; r++) {
    const x = Array.from({ length: FEATURES }, () => rng() * 2 - 1);
    const y = 1.5 * x[0] - 0.8 * x[1] + 0.25 * x[2] * x[3] + 0.05 * (rng() - 0.5);
    lines.push(x.map(v => v.toFixed(6)).concat(y.toFixed(6)).join(','));
  }
  return lines.join('\n') + '\n';
}

async function pipelineTrainOnce(page, modelType, csvPath, timeoutMs) {
  await page.goto('/?localOnly=1');
  await page.waitForFunction(() => !!(window.LocalRegressionApp && window.LocalRegressionApp.version));
  await page.locator('.top-nav [data-nav="project"]').click();
  await page.waitForFunction(() => !!window.EMSProjectShell);

  await page.setInputFiles('#csvFile', csvPath);
  await expect(page.locator('#targetColumn option', { hasText: /^y$/ })).toHaveCount(1, { timeout: 120_000 });

  await page.evaluate(() => window.EMSProjectShell.goToPanel('step-features'));
  await page.selectOption('#targetColumn', 'y');
  await page.click('#autoFeaturesBtn');
  await page.evaluate(() => window.EMSProjectShell.goToPanel('step-model'));
  // Some models sit behind an advanced disclosure; select through the radio's
  // own change event, exactly as a click would.
  await page.evaluate(type => {
    const radio = document.querySelector(`#step-model input[name="modelType"][value="${type}"]`);
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
  }, modelType);
  await expect(page.locator(`#step-model input[name="modelType"][value="${modelType}"]`)).toBeChecked();
  await page.evaluate(() => window.EMSProjectShell.goToPanel('step-split'));

  const started = Date.now();
  await page.click('#trainBtn');
  await expect(page.locator('#metricsTable tbody tr').first()).toBeVisible({ timeout: timeoutMs });
  return Date.now() - started;
}

test('D3a end-to-end Project-mode Train click', async ({ page }, testInfo) => {
  test.skip(MODE !== 'pipeline', 'Set EMS_TRAINING_BENCHMARK=pipeline.');
  test.setTimeout(3 * 60 * 60 * 1000);

  const fs = require('node:fs');
  const timeoutMs = Number(process.env.EMS_BENCH_TIMEOUT_MS) || 600_000;
  const repetitions = Number(process.env.EMS_BENCH_REPETITIONS) || 1;
  const sizes = envList('EMS_BENCH_SIZES', [1000, 10000], Number);
  const results = [];
  const context = page.context();
  let currentPage = page;

  for (const rows of sizes) {
    const csvPath = testInfo.outputPath(`bench-${rows}x${FEATURES}.csv`);
    fs.writeFileSync(csvPath, benchmarkCsv(rows));

    for (const model of MODELS) {
      const result = { model, rows, features: FEATURES, repetitionsMs: [], medianMs: null, status: 'pending' };
      const limit = MODEL_LIMITS[model];
      if (limit && rows > limit) {
        result.status = 'limit';
      } else {
        try {
          for (let i = 0; i < repetitions; i++) {
            result.repetitionsMs.push(await pipelineTrainOnce(currentPage, model, csvPath, timeoutMs));
          }
          result.medianMs = median(result.repetitionsMs);
          result.status = 'ok';
        } catch (error) {
          result.status = /Timeout|timed out/i.test(String(error && error.message)) ? 'timeout' : 'error';
          result.detail = String(error && error.message || error).slice(0, 300);
          void currentPage.close().catch(() => {});
          currentPage = await context.newPage();
        }
      }
      results.push(result);
      console.log(`[D3a pipeline] ${model}, ${rows} rows: ${result.status}` +
        (result.medianMs !== null ? `, median ${result.medianMs.toFixed(0)} ms` : '') +
        (result.detail ? ` (${result.detail.split('\n')[0]})` : ''));
    }
  }

  console.log('WORKER_TRAINING_PIPELINE_RESULTS=' + JSON.stringify(results));
  expect(results.filter(r => r.status === 'error'), 'Unexpected pipeline errors').toEqual([]);
});
