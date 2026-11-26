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

    Object.keys(r).forEach(k => {
      out[k] = {
        r2: r[k].testMetrics.r2,
        rmse: r[k].testMetrics.rmse,
        mae: r[k].testMetrics.mae,
        trainRmse: r[k].trainMetrics.rmse
      };
    });

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
    await expect(page.locator('#exploreStage1Heading')).toContainText('pressure drop');
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
    // B2: the overfitting demonstration is only shown for Compare.
    await expect(page.locator('#exploreOverfitDemo')).toBeHidden();
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
    // B2: a deliberate overfitting demonstration — the same tree at every depth.
    await expect(page.locator('#exploreOverfitDemo')).toBeVisible();
    await expect(page.locator('#exploreOverfitCurvePlot svg').first()).toBeVisible();
    await expect(page.locator('#exploreOverfitSensiblePlot svg').first()).toBeVisible();
    await expect(page.locator('#exploreOverfitFlexiblePlot svg').first()).toBeVisible();
    await expect(page.locator('#exploreOverfitSensibleMetrics')).toContainText('Test RMSE:');
    await expect(page.locator('#exploreOverfitFlexibleMetrics')).toContainText('Test RMSE:');
    await expect(page.locator('#exploreOverfitFlexibleTitle')).toContainText('depth 15');
  });

  test('B2. every engineering example shows overfitting: the deepest tree\'s training error overstates its accuracy', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await enterExplore(page);
    for (const key of ['pipe', 'cooling', 'steel', 'orifice']) {
      await page.evaluate(k => window.EMSExplore.selectExample(k), key);
      await page.evaluate(k => window.EMSExplore.loadDataset(k), key);
      await page.evaluate(() => window.EMSExplore.goToStage(2));
      await page.locator('input[name="exploreApproach"][value="compare"]').check();
      await page.evaluate(() => window.EMSExplore.train());
      const demo = await page.evaluate(() => {
        const d = window.EMSExplore.state.overfitDemo;
        return d && {
          sensibleDepth: d.sensible.depth,
          flexibleDepth: d.flexible.depth,
          flexibleTrain: d.flexible.result.trainMetrics.rmse,
          flexibleTest: d.flexible.result.testMetrics.rmse,
          sensibleTest: d.sensible.result.testMetrics.rmse,
          sensibleTrain: d.sensible.result.trainMetrics.rmse,
          // The comparison table must be untouched by the demonstration.
          tableModels: Object.keys(window.EMSExplore.state.results).sort()
        };
      });
      expect(demo, key + ': demo computed').toBeTruthy();
      expect(demo.tableModels, key).toEqual(['ann', 'forest', 'linear', 'tree']);
      expect(demo.sensibleDepth, key + ': sensible depth below the maximum').toBeLessThan(demo.flexibleDepth);
      expect(demo.flexibleTrain, key + ': deeper tree fits training rows more closely').toBeLessThan(demo.sensibleTrain);
      // The robust lesson: the deep tree's training score overstates its accuracy,
      // by more than the sensible tree's does.
      expect(demo.flexibleTest / demo.flexibleTrain, key + ': deep tree test/train gap').toBeGreaterThan(2);
      expect(demo.flexibleTest / demo.flexibleTrain, key + ': gap wider than the sensible tree')
        .toBeGreaterThan(demo.sensibleTest / demo.sensibleTrain);
      await expect(page.locator('#exploreOverfitExplanation'), key).toContainText('That is overfitting');
    }
  });

  test('13. an actual-vs-predicted plot is drawn with unit-labelled axes', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await train(page, 'simple', 1);
    await expect(page.locator('#explorePlotCard')).toBeVisible();
    await expect(page.locator('#explorePlot svg').first()).toBeVisible();
    await expect(page.locator('#explorePlot')).toContainText('kPa');
  });

  test('14. stage 4 explains R², RMSE, MAE and overfitting using actual model results', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await train(page, 'simple', 1);
    await page.click('#exploreToStage4');

    await expect(page.locator('#explore-stage-4')).toBeVisible();

    const interpretation = page.locator('#exploreInterpretation');
    const cards = interpretation.locator('.explore-insight');

    await expect(cards).toHaveCount(6);

    const metrics = Object.values(await results(page))[0];

    const r2Card = cards.filter({ hasText: 'How good is the fit?' });
    const rmseCard = cards.filter({ hasText: 'How large are the typical errors?' });
    const maeCard = cards.filter({ hasText: 'What is the average absolute error?' });
    const overfitCard = cards.filter({ hasText: 'Is it overfitting?' });

    await expect(r2Card).toContainText('R²');
    await expect(rmseCard).toContainText('RMSE');
    await expect(maeCard).toContainText('MAE');
    await expect(overfitCard).toBeVisible();

    await expect(r2Card).toContainText('variation');
    await expect(rmseCard).toContainText('training RMSE');
    await expect(maeCard).toContainText('average size');
    await expect(overfitCard).toContainText('test RMSE');
    await expect(overfitCard).toContainText('training RMSE');

    const displayedText = await interpretation.textContent();

    const formatted = value => {
      const a = Math.abs(value);
      return a >= 100 ? value.toFixed(1) : a >= 1 ? value.toFixed(2) : value.toFixed(4);
    };

    expect(displayedText).toContain(metrics.r2.toFixed(3));
    expect(displayedText).toContain(formatted(metrics.rmse));
    expect(displayedText).toContain(formatted(metrics.mae));
    expect(displayedText).toContain(formatted(metrics.trainRmse));
    expect(displayedText).toContain('kPa');

    // The user's own numbers are visible without opening anything; the generic
    // definitions are dismissible disclosures, closed by default (WORKPLAN B1).
    for (const card of [r2Card, rmseCard, maeCard, overfitCard]) {
      await expect(card.locator('h3')).toBeVisible();
      await expect(card.locator(':scope > p')).toBeVisible();
      const explainer = card.locator('details.explore-explainer');
      await expect(explainer).toHaveCount(1);
      await expect(explainer).toHaveJSProperty('open', false);
    }
    await expect(r2Card.locator(':scope > p')).toContainText(metrics.r2 >= 0 ? '%' : 'average');
    await expect(rmseCard.locator(':scope > p')).toContainText(formatted(metrics.rmse));
    await expect(maeCard.locator(':scope > p')).toContainText(formatted(metrics.mae));
    const r2Explainer = r2Card.locator('details.explore-explainer');
    await expect(r2Explainer.locator('p')).toBeHidden();
    await r2Explainer.locator('summary').click();
    await expect(r2Explainer.locator('p')).toBeVisible();
    await expect(r2Explainer.locator('p')).toContainText('predicting the average');
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
    await expect(page.locator('#exploreProblem')).toContainText('harder, noisier prediction problem');
    await expect(page.locator('#exploreProblem')).toContainText('cleaner, physics-based engineering examples');
    await page.click('#exploreToStage2');
    await page.click('#exploreToStage3');
    await page.click('#exploreTrainBtn');
    await expect(page.locator('#exploreComparison tbody tr')).toHaveCount(1);
    await page.click('#exploreToStage4');
    await expect(page.locator('#exploreEngineering')).toContainText('Not an engineering dataset');
  });

  test('A4. Convective cooling, steel and orifice examples load their correct problem descriptions and targets', async ({ page }) => {
    await page.goto('/?localOnly=1');
    await appReady(page);
    await enterExplore(page);

    const examples = [
      {
        key: 'cooling',
        description: 'predict the convective heat-transfer rate',
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

  // E1: Direct links must open the requested Explore activity, not just the Explore view.
  test('E1. direct links open every supported Explore example', async ({ page }) => {
    const examples = ['pipe', 'cooling', 'steel', 'orifice', 'nonlinear'];

    for (const example of examples) {
      // A fresh navigation verifies the route during initial application startup.
      await page.goto(`/?localOnly=1#explore/${example}`);
      await appReady(page);

      await expect(page.locator('#view-explore')).toBeVisible();
      await expect(
        page.locator(`#exploreExampleSwitch input[value="${example}"]`)
      ).toBeChecked();
    }
  });

  // E1: The original Explore route must retain pipe as its default activity.
  test('E1. the plain Explore route selects the default pipe example', async ({ page }) => {
    await page.goto('/?localOnly=1#explore');
    await appReady(page);

    await expect(page.locator('#view-explore')).toBeVisible();
    await expect(
      page.locator('#exploreExampleSwitch input[value="pipe"]')
    ).toBeChecked();
  });

  // E1: Unsupported nested routes must not silently display the default example.
  test('E1. an unknown Explore example route falls back to Home', async ({ page }) => {
    await page.goto('/?localOnly=1#explore/unknown');
    await appReady(page);

    await expect(page.locator('#view-home')).toBeVisible();
  });

  // E1: Changing examples must create navigable history entries.
  test('E1. browser back and forward restore the previously selected examples', async ({ page }) => {
    await page.goto('/?localOnly=1#explore');
    await appReady(page);

    await expect(page.locator('#exploreExampleSwitch input[value="pipe"]')).toBeChecked();

    // Confirm the Explore view is visible before testing example navigation.
    await expect(page.locator('#view-explore')).toBeVisible();
    // Open the secondary example selector before interacting with its radio buttons.
    await page.locator('.explore-other-examples summary').click();
    // Select two activities so the browser has distinct example routes to revisit.
    await page.locator('#exploreExampleSwitch input[value="cooling"]').check();
    await expect(page).toHaveURL(/#explore\/cooling$/);

    await page.locator('#exploreExampleSwitch input[value="steel"]').check();
    await expect(page).toHaveURL(/#explore\/steel$/);

    // Back should restore cooling, then pipe.
    await page.goBack();
    await expect(page.locator('#exploreExampleSwitch input[value="cooling"]')).toBeChecked();

    await page.goBack();
    await expect(page.locator('#exploreExampleSwitch input[value="pipe"]')).toBeChecked();

    // Forward should restore the same selections in the same order.
    await page.goForward();
    await expect(page.locator('#exploreExampleSwitch input[value="cooling"]')).toBeChecked();

    await page.goForward();
    await expect(page.locator('#exploreExampleSwitch input[value="steel"]')).toBeChecked();
  });

  test('A4. the page heading and guidance follow the selected example, not just the problem panel', async ({ page }) => {
    await page.goto('/?localOnly=1#explore/steel');
    await appReady(page);

    await expect(page.locator('#exploreHeading')).toHaveText('Predict steel yield strength');
    await expect(page.locator('#exploreStage1Heading')).toContainText('steel yield strength');
    // No pipe-specific phrase may survive anywhere in the shell copy.
    for (const node of await page.locator('#view-explore [data-ex-copy]').all()) {
      await expect(node).not.toContainText('pressure');
      await expect(node).not.toContainText('kPa');
    }
    await expect(page.locator('#view-explore [data-ex-copy="target"]').first()).toHaveText('yield strength');
    await expect(page.locator('#view-explore [data-ex-copy="unitSuffix"]')).toHaveText(', in MPa');

    // Switching through the example picker updates the heading too.
    await page.locator('.explore-other-examples summary').click();
    await page.locator('#exploreExampleSwitch input[value="orifice"]').check();
    await expect(page.locator('#exploreHeading')).toHaveText('Predict flow rate through an orifice');
    await expect(page.locator('#view-explore [data-ex-copy="unitSuffix"]')).toHaveText(', in m³/s');

    // The mathematical example is labelled as such and has no unit.
    await page.locator('#exploreExampleSwitch input[value="nonlinear"]').check();
    await expect(page.locator('#exploreEyebrowKind')).toHaveText('Guided mathematical example');
    await expect(page.locator('#view-explore [data-ex-copy="unitSuffix"]')).toHaveText('');

    // And back to the default.
    await page.locator('#exploreExampleSwitch input[value="pipe"]').check();
    await expect(page.locator('#exploreHeading')).toHaveText('Predict pressure drop in a pipe');
    await expect(page.locator('#view-explore [data-ex-copy="unitSuffix"]')).toHaveText(', in kPa');
  });

  test('E1. returning to Explore through the navigation keeps the selected example in the URL', async ({ page }) => {
    await page.goto('/?localOnly=1#explore/cooling');
    await appReady(page);
    await expect(page.locator('#exploreExampleSwitch input[value="cooling"]')).toBeChecked();

    await page.locator('.top-nav [data-nav="home"]').click();
    await expect(page).toHaveURL(/#home$/);
    await page.locator('.top-nav [data-nav="explore"]').click();

    // The address bar must name the activity on screen, so it can be shared.
    await expect(page).toHaveURL(/#explore\/cooling$/);
    await expect(page.locator('#exploreExampleSwitch input[value="cooling"]')).toBeChecked();
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
