// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 UK Research and Innovation (UKRI)
//
// D3a: browser main-thread training benchmark.
// Opt in with EMS_TRAINING_BENCHMARK=smoke or =full.
// This file measures existing training behaviour only. It does not implement
// worker training or change any model algorithms.

const { test, expect } = require('@playwright/test');

const MODE = process.env.EMS_TRAINING_BENCHMARK || 'off';

const MODELS = [
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

const SIZES = [1000, 10000, 50000];
const FEATURES = 30;
const SEED = 42;
const REPETITIONS = 3;
const TRAINING_TIMEOUT_MS = 8000;

// These are existing implementation limits, not benchmark-imposed limits.
const MODEL_LIMITS = {
  gp: 2000,
  knn: 25000
};

test.skip(
  !['smoke', 'full'].includes(MODE),
  'Opt-in D3a benchmark. Set EMS_TRAINING_BENCHMARK=smoke or full.'
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