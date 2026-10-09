// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 UK Research and Innovation (UKRI)
// Phase 1 tests — landing page + guided, problem-led Explore mode.
//
// These cover the NEW front door (landing page, top navigation) and the beginner
// Explore workflow, which is built around a concrete engineering problem:
// predicting the pressure drop of a fluid flowing through a pipe. They do not
// touch the inherited Project-mode tests in smoke.spec.js. As with the baseline,
// everything runs with `?localOnly=1` so the app uses bundled libraries and
// makes no external requests.

const { test, expect } = require('@playwright/test');

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
function isLocalUrl(url) {
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('about:')) return true;
  try { return LOCAL_HOSTS.has(new URL(url).hostname); } catch { return true; }
}

function instrument(page) {
  const pageErrors = [];
  const externalRequests = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('request', req => { if (!isLocalUrl(req.url())) externalRequests.push(req.url()); });
  return { pageErrors, externalRequests };
}

// The landing page is the default view; Explore/Project controllers load last.
async function appReady(page) {
  await page.waitForFunction(() => !!(window.LocalRegressionApp && window.EMSModes && window.EMSExplore));
}
async function enterExplore(page) {
  await page.locator('.top-nav [data-nav="explore"]').click();
  await expect(page.locator('#view-explore')).toBeVisible();
}
// Advance Explore to stage 3 with a given approach ('simple' | 'flexible' | 'compare').
async function goToTrain(page, approach) {
  await enterExplore(page);
  await page.click('#exploreToStage2');
  if (approach) await page.locator(`input[name="exploreApproach"][value="${approach}"]`).check();
  await page.click('#exploreToStage3');
}
async function train(page, approach, expectedRows) {
  await goToTrain(page, approach);
  await page.click('#exploreTrainBtn');
  await expect(page.locator('#exploreComparison tbody tr')).toHaveCount(expectedRows);
}
// Read the fitted results straight from the controller's exposed state.
function results(page) {
  return page.evaluate(() => {
    const out = {};
    const r = window.EMSExplore.state.results;
    Object.keys(r).forEach(k => { out[k] = { r2: r[k].testMetrics.r2, rmse: r[k].testMetrics.rmse }; });
    return out;
  });
}

test.describe('Engineering ML Studio — Phase 1 landing + problem-led Explore', () => {
  test('1. landing page loads with the product name and no fatal errors', async ({ page }) => {
    const { pageErrors } = instrument(page);
    await page.goto('/?localOnly=1');
    await appReady(page);
    await expect(page.locator('#view-home')).toBeVisible();
    await expect(page.locator('#view-home h1')).toContainText('Engineering ML Studio');
    expect(pageErrors, `Unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([]);
  });

  test('2. both primary routes (Explore and Project) are offered', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await expect(page.locator('#view-home .route-grid [data-mode="explore"]')).toBeVisible();
    await expect(page.locator('#view-home .route-grid [data-mode="project"]')).toBeVisible();
    // The "Learn with Python" route is now live (Phase 2) and navigates to Learn mode.
    await expect(page.locator('#view-home [data-mode="learn"]')).toBeVisible();
  });

  test('3. entering Project mode reveals the inherited workflow unchanged', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await page.locator('.top-nav [data-nav="project"]').click();
    await expect(page.locator('#view-project')).toBeVisible();
    await expect(page.locator('main.app-shell')).toBeVisible();
    await expect(page.locator('#step-upload')).toBeVisible();
  });

  test('4. the user can return to the landing page', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await enterExplore(page);
    await page.locator('.top-nav [data-nav="home"]').click();
    await expect(page.locator('#view-home')).toBeVisible();
    await expect(page.locator('#view-explore')).toBeHidden();
  });

  test('5. Explore is problem-led: four stages and a pressure-drop heading', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await enterExplore(page);
    await expect(page.locator('#exploreSteps li')).toHaveCount(4);
    await expect(page.locator('#exploreHeading')).toContainText('pressure drop');
    await expect(page.locator('#explore-stage-1')).toBeVisible();
    await expect(page.locator('#exploreStage1Heading')).toContainText('pressure-drop problem');
  });

  test('6. stage 1 describes the problem with SI units, target, trends and a disclaimer', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await enterExplore(page);
    const problem = page.locator('#exploreProblem');
    await expect(problem).toContainText('Mean flow velocity');
    await expect(problem).toContainText('m/s');
    await expect(problem).toContainText('kPa');           // target unit
    await expect(problem).toContainText('Pressure drop generally increases'); // expected trend
    await expect(problem).toContainText('synthetic demonstration');           // disclaimer
    // A lightweight inline schematic with no external asset.
    await expect(page.locator('#exploreProblem svg.explore-schematic')).toBeVisible();
  });

  test('7. stage 2 offers approaches, not algorithm names, and defaults to the simple trend', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await enterExplore(page);
    await page.click('#exploreToStage2');
    const approaches = page.locator('input[name="exploreApproach"]');
    await expect(approaches).toHaveCount(4);
    await expect(page.locator('input[name="exploreApproach"][value="simple"]')).toBeChecked();
    await expect(page.locator('#explore-stage-2')).toContainText('Start with a simple trend');
    await expect(page.locator('#explore-stage-2')).toContainText('Try a tree-based flexible relationship');
    await expect(page.locator('#explore-stage-2')).toContainText('Try an advanced flexible model');
    await expect(page.locator('#explore-stage-2')).toContainText('Compare approaches');
    // The neural network is offered, but only as the advanced (non-default) option.
    await expect(page.locator('input[name="exploreApproach"][value="advanced"]')).not.toBeChecked();
  });

  test('8. model names are kept visible but secondary', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await enterExplore(page);
    await page.click('#exploreToStage2');
    await expect(page.locator('#explore-stage-2 .explore-model-name').first()).toContainText('Uses Linear Regression');
    await expect(page.locator('#explore-stage-2')).toContainText('Uses Random Forest');
    // A glossary of the model names is available but tucked away.
    await expect(page.locator('.explore-model-details')).toContainText('Random Forest');
  });

  test('9. the simple approach trains Linear Regression with a physical unit on the metrics', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await train(page, 'simple', 1);
    await expect(page.locator('#exploreComparison')).toContainText('Linear Regression');
    await expect(page.locator('#exploreComparison')).toContainText('Test RMSE (kPa)');
    await expect(page.locator('#exploreComparison')).toContainText('Test R²');
  });

  test('10. the flexible approach reveals tree controls and trains Random Forest', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await enterExplore(page);
    await page.click('#exploreToStage2');
    await page.locator('input[name="exploreApproach"][value="flexible"]').check();
    await expect(page.locator('#exploreControls')).toBeVisible();
    await expect(page.locator('#exploreTreesField')).toBeVisible();
    await page.click('#exploreToStage3');
    await page.click('#exploreTrainBtn');
    await expect(page.locator('#exploreComparison tbody tr')).toHaveCount(1);
    await expect(page.locator('#exploreComparison')).toContainText('Random Forest');
  });

  test('11. the flexible approach fits the nonlinear problem better than the simple trend', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await train(page, 'compare', 4);
    const r = await results(page);
    expect(r.linear && r.forest, 'both linear and forest were trained').toBeTruthy();
    // Random Forest should explain more of the variance than a single linear trend.
    expect(r.forest.r2).toBeGreaterThan(r.linear.r2);
  });

  test('12. comparing approaches trains all four and offers a focus selector', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await train(page, 'compare', 4);
    await expect(page.locator('#exploreComparison')).toContainText('Linear Regression');
    await expect(page.locator('#exploreComparison')).toContainText('Decision Tree');
    await expect(page.locator('#exploreComparison')).toContainText('Random Forest');
    await expect(page.locator('#exploreComparison')).toContainText('Neural Network');
    await expect(page.locator('#exploreFocusWrap')).toBeVisible();
    await expect(page.locator('#exploreFocusModel option')).toHaveCount(4);
  });

  test('13. an actual-vs-predicted plot is drawn with unit-labelled axes', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await train(page, 'simple', 1);
    await expect(page.locator('#explorePlotCard')).toBeVisible();
    await expect(page.locator('#explorePlot svg').first()).toBeVisible();
    await expect(page.locator('#explorePlot')).toContainText('kPa');
  });

  test('14. stage 4 shows a plain-language interpretation with R² and RMSE in kPa', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await train(page, 'simple', 1);
    await page.click('#exploreToStage4');
    await expect(page.locator('#explore-stage-4')).toBeVisible();
    await expect(page.locator('#exploreInterpretation .explore-insight').first()).toBeVisible();
    await expect(page.locator('#exploreInterpretation')).toContainText('R²');
    await expect(page.locator('#exploreInterpretation')).toContainText('kPa');
  });

  test('15. stage 4 gives an engineering interpretation with trend and extrapolation checks', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await train(page, 'flexible', 1);
    await page.click('#exploreToStage4');
    const eng = page.locator('#exploreEngineering');
    await expect(eng).toContainText('Engineering interpretation');
    await expect(eng).toContainText('flow velocity');
    await expect(eng).toContainText('pipe diameter');
    await expect(eng).toContainText('physical trend');
    await expect(eng).toContainText('demonstrated range'); // extrapolation caution
  });

  test('16. the secondary generic example is a maths demonstration with no trend checks', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await enterExplore(page);
    // Open the clearly-secondary "use a different example" control and switch.
    await page.locator('.explore-other-examples summary').click();
    const examples = page.locator('#exploreExampleSwitch input[name="exploreExample"]');
    await expect(examples).toHaveCount(5);
    await expect(examples.first()).toBeChecked();     // pipe is the default
    await examples.nth(4).check();                     // generic nonlinear
    await expect(page.locator('#exploreProblem')).toContainText('mathematical');
    await page.click('#exploreToStage2');
    await page.click('#exploreToStage3');
    await page.click('#exploreTrainBtn');
    await expect(page.locator('#exploreComparison tbody tr')).toHaveCount(1);
    await page.click('#exploreToStage4');
    await expect(page.locator('#exploreEngineering')).toContainText('Not an engineering dataset');
  });
  test('A4. Fin, steel and orifice examples load their correct problem descriptions and targets', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await enterExplore(page);

    const examples = [
      {
        key: 'fin',
        description: 'predict heat dissipation',
        target: 'Heat dissipation',
        unit: 'W'
      },
      {
        key: 'steel',
        description: 'yield strength',
        target: 'Yield strength',
        unit: 'MPa'
      },
      {
        key: 'orifice',
        description: 'predict flow rate',
        target: 'Flow rate',
        unit: 'm³/s'
      }
    ];

    await page.locator('.explore-other-examples summary').click();

    for (const example of examples) {
      await page.locator(
        `#exploreExampleSwitch input[name="exploreExample"][value="${example.key}"]`
      ).check();

      await expect(page.locator('#exploreProblem')).toContainText(example.description);
      await expect(page.locator('#exploreProblem .explore-target')).toContainText(example.target);
      await expect(page.locator('#exploreProblem .explore-unit').last()).toContainText(example.unit);
    }
  });

  test('17. no non-local requests occur during the Explore workflow', async ({ page }) => {
    const { externalRequests } = instrument(page);
    await page.goto('/?localOnly=1');
    await appReady(page);
    await train(page, 'compare', 4);
    await page.click('#exploreToStage4');
    await expect(page.locator('#exploreEngineering .explore-insight').first()).toBeVisible();
    expect(
      externalRequests,
      `Unexpected non-local requests:\n${externalRequests.join('\n')}`
    ).toEqual([]);
  });

  test('18. primary actions are reachable and operable by keyboard', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    let reached = false;
    for (let i = 0; i < 12 && !reached; i++) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate(() => {
        const a = document.activeElement;
        return !!(a && (a.matches('a[data-nav]') || a.matches('[data-mode]')));
      });
    }
    expect(reached, 'Expected keyboard focus to reach a navigation/route control').toBe(true);
    await page.locator('#view-home [data-mode="explore"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#view-explore')).toBeVisible();
  });

  test('19. narrow (mobile) viewport has no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/?localOnly=1');
    await appReady(page);
    const overflow = () => page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await overflow()).toBeLessThanOrEqual(1); // landing page
    await enterExplore(page);
    expect(await overflow()).toBeLessThanOrEqual(1); // explore view
  });

  test('20. the Learn route explains reproducing the workflow in Python', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await page.locator('.top-nav [data-nav="learn"]').click();
    await expect(page.locator('#view-learn')).toBeVisible();
    await expect(page.locator('#learnHeading')).toContainText('Python');
    // Honest, non-identical-numbers framing is present.
    await expect(page.locator('#view-learn')).toContainText('differ slightly from the browser');
    // The synthetic-data caution carries over from Explore.
    await expect(page.locator('#view-learn')).toContainText('synthetic');
    // Both ways to run the notebook are offered, as external links (allowed by CSP).
    await expect(page.locator('#view-learn a[href*="colab.research.google.com"]')).toBeVisible();
    await expect(page.locator('#view-learn a[href*="github.com"][href$=".ipynb"]')).toBeVisible();
  });

  test('21. the Learn page uses text links, not an external badge image (CSP-safe)', async ({ page }) => {
    const { externalRequests } = instrument(page);
    await page.goto('/?localOnly=1');
    await appReady(page);
    await page.locator('.top-nav [data-nav="learn"]').click();
    await expect(page.locator('#view-learn')).toBeVisible();
    // No external images (e.g. a Colab badge SVG) are requested — img-src forbids them.
    await expect(page.locator('#view-learn img')).toHaveCount(0);
    expect(
      externalRequests,
      `Unexpected non-local requests:\n${externalRequests.join('\n')}`
    ).toEqual([]);
  });

  test('22. Explore stage 4 offers a "Continue in Python" route to Learn', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await train(page, 'simple', 1);
    await page.click('#exploreToStage4');
    const cta = page.locator('#explore-stage-4 .explore-cta [data-mode="learn"]');
    await expect(cta).toBeVisible();
    await expect(cta).toContainText('Continue in Python');
    await cta.click();
    await expect(page.locator('#view-learn')).toBeVisible();
    await expect(page.locator('#view-explore')).toBeHidden();
  });

  test('23. the landing page "Learn with Python" card navigates to Learn', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await page.locator('#view-home [data-mode="learn"]').click();
    await expect(page.locator('#view-learn')).toBeVisible();
    await expect(page.locator('#view-home')).toBeHidden();
  });

  // --- Neural network: an advanced flexible option, never the beginner default -----

  test('24. the neural network is offered as an advanced option, not the default', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await enterExplore(page);
    await page.click('#exploreToStage2');
    // The default is still the simple trend, not the neural network.
    await expect(page.locator('input[name="exploreApproach"][value="simple"]')).toBeChecked();
    await expect(page.locator('input[name="exploreApproach"][value="advanced"]')).not.toBeChecked();
    // The option is named in plain terms, with the algorithm as secondary detail.
    await expect(page.locator('#explore-stage-2')).toContainText('Try an advanced flexible model');
    await expect(page.locator('#explore-stage-2')).toContainText('Uses a Neural Network');
    // The educational caution is present.
    await expect(page.locator('#explore-stage-2')).toContainText('not automatically more accurate');
  });

  test('25. choosing the advanced approach reveals the safe NN presets (not free architecture editing)', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await enterExplore(page);
    await page.click('#exploreToStage2');
    await page.locator('input[name="exploreApproach"][value="advanced"]').check();
    await expect(page.locator('#exploreAnnControls')).toBeVisible();
    // Two size presets, small by default; no free neuron/layer inputs.
    await expect(page.locator('input[name="exploreAnnArch"]')).toHaveCount(2);
    await expect(page.locator('input[name="exploreAnnArch"][value="small"]')).toBeChecked();
    await expect(page.locator('#exploreAnnTraining')).toBeVisible();
    // Learning rate is tucked away under an advanced setting, not on the main path.
    await expect(page.locator('#exploreAnnLearningRate')).toBeHidden();
    await page.locator('.explore-ann-advanced summary').click();
    await expect(page.locator('#exploreAnnLearningRate')).toBeVisible();
    // Scaling is explained but not something the user must configure.
    await expect(page.locator('#exploreAnnControls')).toContainText('common scale');
  });

  test('26. the advanced approach trains a neural network with metrics in kPa', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await train(page, 'advanced', 1);
    await expect(page.locator('#exploreComparison')).toContainText('Neural Network');
    await expect(page.locator('#exploreComparison')).toContainText('Test RMSE (kPa)');
    const r = await results(page);
    expect(Number.isFinite(r.ann.r2), 'NN test R² is finite').toBe(true);
    expect(Number.isFinite(r.ann.rmse), 'NN test RMSE is finite').toBe(true);
    expect(r.ann.rmse).toBeGreaterThan(0);
  });

  test('27. training is deterministic for a fixed preset (same numbers on a fresh reload)', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await train(page, 'advanced', 1);
    const first = await results(page);
    // Reload the app and train again from scratch with the same preset and seed.
    await page.reload();
    await appReady(page);
    await train(page, 'advanced', 1);
    const second = await results(page);
    expect(second.ann.rmse).toBeCloseTo(first.ann.rmse, 6);
    expect(second.ann.r2).toBeCloseTo(first.ann.r2, 6);
  });

  test('28. the medium preset also trains and the NN loss curve is an advanced (collapsed) diagnostic', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    // The size preset lives on stage 2, so choose it before advancing to training.
    await enterExplore(page);
    await page.click('#exploreToStage2');
    await page.locator('input[name="exploreApproach"][value="advanced"]').check();
    await page.locator('input[name="exploreAnnArch"][value="medium"]').check();
    await page.click('#exploreToStage3');
    await page.click('#exploreTrainBtn');
    await expect(page.locator('#exploreComparison tbody tr')).toHaveCount(1);
    const r = await results(page);
    expect(Number.isFinite(r.ann.rmse), 'medium NN test RMSE is finite').toBe(true);
    // The loss curve is present but secondary: a collapsed <details>, closed by default.
    const lossCard = page.locator('#exploreLossCard');
    await expect(lossCard).toBeVisible();
    await expect(lossCard).toHaveJSProperty('open', false);
    await lossCard.locator('summary').click();
    await expect(page.locator('#exploreLossPlot svg').first()).toBeVisible();
  });

  test('29. stage 4 gives an honest, deterministic neural-network interpretation', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await train(page, 'compare', 4);
    // Focus the neural network so its interpretation is shown.
    await page.selectOption('#exploreFocusModel', 'ann');
    await page.click('#exploreToStage4');
    const interp = page.locator('#exploreInterpretation');
    await expect(interp).toContainText('neural network');
    await expect(interp).toContainText('converge');
    // The honesty message about small tabular data / tree methods is present.
    await expect(interp).toContainText('tree');
    await expect(interp).toContainText('does not establish');
    // Extrapolation and physical-validation cautions still apply.
    await expect(interp).toContainText('extrapolation');
    await expect(interp).toContainText('physical validation');
  });

  test('30. no non-local requests occur while training the neural network', async ({ page }) => {
    const { externalRequests } = instrument(page);
    await page.goto('/?localOnly=1');
    await appReady(page);
    await train(page, 'advanced', 1);
    expect(
      externalRequests,
      `Unexpected non-local requests:\n${externalRequests.join('\n')}`
    ).toEqual([]);
  });
});
