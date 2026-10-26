// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 UK Research and Innovation (UKRI)
// Phase 3 (increment 2) — Project-mode professional application shell.
//
// These tests exercise the PRESENTATION + NAVIGATION layer that presents the
// inherited eight internal panels as six user-facing stages inside a compact
// engineering-application shell: an application top bar, a compact left workflow
// navigator, a dominant workspace that shows ONE stage at a time, collapsible
// stage guidance, and privacy / local-processing relocated OUT of the workflow
// rail.
//
// A second describe block holds REGRESSION GUARDS proving the underlying eight
// internal panels, model IDs, training pipeline and artifact/export contract
// are unchanged — the shell is presentation only.
//
// As with the baseline smoke tests, everything runs with `?localOnly=1` so the
// app uses bundled libraries (offline, deterministic, backend-free).

const { test, expect } = require('@playwright/test');
const path = require('path');

const HOUSE_CSV = path.join(__dirname, '..', 'examples', 'house_prices_sample.csv');

// The eight internal panels that MUST continue to exist unchanged.
const PANEL_IDS = [
  'step-upload', 'step-features', 'step-preprocess', 'step-model',
  'step-split', 'step-diagnostics', 'step-predict', 'step-monitor'
];

// The eleven model radio values that MUST NOT change (order-independent).
const MODEL_VALUES = [
  'linear', 'ridge', 'elasticnet', 'robust', 'tree', 'forest',
  'gboost', 'knn', 'quantile', 'gp', 'ann'
];

async function ready(page) {
  await page.goto('/?localOnly=1');
  await expect(page.locator('.top-nav')).toBeVisible();
}

async function enterProjectMode(page) {
  await page.waitForFunction(() => !!window.EMSModes);
  await page.locator('.top-nav [data-nav="project"]').click();
  await expect(page.locator('#view-project')).toBeVisible();
  // The presentation shell attaches on load; make sure it is present.
  await page.waitForFunction(() => !!window.EMSProjectShell);
}

// The workspace shows one stage at a time; reveal a stage via the shell's own
// navigation API before interacting with controls that live inside it. This
// drives the real showStage() path (the same one the rail and Continue buttons
// use) and introduces no behaviour.
async function goToStage(page, panelId) {
  await page.evaluate((id) => window.EMSProjectShell.goToPanel(id), panelId);
  await expect(page.locator('#' + panelId)).toBeVisible();
}

async function loadDataset(page) {
  await page.setInputFiles('#csvFile', HOUSE_CSV);
  await expect(page.locator('#targetColumn option', { hasText: 'price' })).toHaveCount(1);
  await expect(page.locator('#step-features')).not.toHaveClass(/locked/);
}

async function selectTargetAndFeatures(page) {
  await goToStage(page, 'step-features');
  await page.selectOption('#targetColumn', 'price');
  await page.click('#autoFeaturesBtn');
  await expect(page.locator('#featureList input[type="checkbox"]:checked').first()).toBeVisible();
  await expect(page.locator('#step-model')).not.toHaveClass(/locked/);
  await expect(page.locator('#step-split')).not.toHaveClass(/locked/);
}

async function train(page) {
  await goToStage(page, 'step-split');
  await page.click('#trainBtn');
  await expect(page.locator('#metricsTable tbody tr').first()).toBeVisible();
}

async function fullWorkflow(page) {
  await ready(page);
  await enterProjectMode(page);
  await loadDataset(page);
  await selectTargetAndFeatures(page);
  await train(page);
}

test.describe('Project mode — application shell (top bar, rail, workspace)', () => {
  // ---- Application top bar ---------------------------------------------

  test('1. a compact top bar names the workspace and shows the Project mode', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    const topbar = page.locator('#view-project .app-topbar');
    await expect(topbar).toBeVisible();
    // The app top bar carries a compact, Project-specific title (the full product
    // name is shown once, in the global brand) plus the Project mode chip.
    await expect(topbar.locator('h1')).toContainText('Engineering project workspace');
    await expect(topbar.locator('.app-mode-chip')).toHaveText('Project');
    // The top bar is short — it is a bar, not a hero banner.
    const h = await topbar.evaluate(el => el.getBoundingClientRect().height);
    expect(h).toBeLessThan(120);
  });

  test('2. utility actions (Home, Save, Open, Privacy, Help) live in the top bar', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    const topbar = page.locator('#view-project .app-topbar');
    await expect(topbar.locator('#topbarHomeBtn')).toBeVisible();
    await expect(topbar.locator('#topbarSaveBtn')).toBeVisible();
    await expect(topbar.locator('#topbarOpenBtn')).toBeVisible();
    await expect(topbar.locator('#privacyInfoBtn')).toBeVisible();
    await expect(topbar.locator('a', { hasText: 'Help' })).toBeVisible();
  });

  test('3. privacy / local-processing is presented OUTSIDE the workflow rail', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    // Privacy button and the local-processing disclosure sit in the top bar.
    await expect(page.locator('#view-project .app-topbar #privacyInfoBtn')).toHaveCount(1);
    await expect(page.locator('#view-project .app-topbar .local-processing')).toHaveCount(1);
    await expect(page.locator('#view-project .app-topbar .local-processing'))
      .toContainText(/local/i);
    // The rail contains no privacy / system / help / contact cards any more.
    await expect(page.locator('#view-project .stage-rail #privacyInfoBtn')).toHaveCount(0);
    await expect(page.locator('#view-project .sidebar .privacy-card')).toHaveCount(0);
    await expect(page.locator('#view-project .sidebar .sidebar-help-card')).toHaveCount(0);
  });

  test('4. the local-processing disclosure keeps the browser-local wording', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    const details = page.locator('#view-project .app-topbar .local-processing');
    await expect(details.locator('summary')).toContainText('Local processing');
    await expect(details).toContainText(/stay on this device/i);
  });

  // ---- Footer: system / help / contact / scope / attribution ----------

  test('5. system, help and contact utilities are relocated to a footer', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    const footer = page.locator('#view-project .app-footer');
    await expect(footer).toBeVisible();
    await expect(footer.locator('#systemIntegrityBtn')).toBeVisible();
    await expect(footer.locator('#systemRecoveryBtn')).toBeVisible();
    await expect(footer.locator('a', { hasText: 'User guide' })).toBeVisible();
    await expect(footer.locator('a', { hasText: 'Report issue' })).toBeVisible();
  });

  test('6. scope boundaries and the legacy-engine attribution are preserved', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    await expect(page.locator('#view-project .app-footer-scope'))
      .toContainText(/stays in the browser/i);
    await expect(page.locator('#view-project .app-footer-scope'))
      .toContainText(/not a safety-critical/i);
    await expect(page.locator('#view-project .app-footer-credit'))
      .toContainText('Built on the Local Regression Studio engine.');
  });

  // ---- Compact workflow navigator (six stages) ------------------------

  test('7. the rail presents exactly six user-facing stages with concise labels', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    const labels = page.locator('#view-project .stage-list > .stage-item .stage-label');
    await expect(labels).toHaveCount(6);
    await expect(labels.nth(0)).toHaveText('Load data');
    await expect(labels.nth(1)).toHaveText('Inputs and target');
    await expect(labels.nth(2)).toHaveText('Prepare data');
    await expect(labels.nth(3)).toHaveText('Choose and train');
    await expect(labels.nth(4)).toHaveText('Evaluate results');
    await expect(labels.nth(5)).toHaveText('Predict and monitor');
  });

  test('8. the six stages render as application rows: no bullets, no link underline', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    const listType = await page.evaluate(() =>
      getComputedStyle(document.querySelector('#view-project .stage-list')).listStyleType);
    expect(listType).toBe('none');
    // The row link is not the default underlined blue link.
    const deco = await page.evaluate(() =>
      getComputedStyle(document.querySelector('#view-project .stage-item[data-stage="1"] a.stage-row')).textDecorationLine);
    expect(deco).toBe('none');
    // The number and label are laid out side by side (not concatenated "1Load").
    const gap = await page.evaluate(() => {
      const row = document.querySelector('#view-project .stage-item[data-stage="1"] a.stage-row');
      const num = row.querySelector('.stage-num').getBoundingClientRect();
      const label = row.querySelector('.stage-label').getBoundingClientRect();
      return label.left - num.right;
    });
    expect(gap).toBeGreaterThan(2);
  });

  test('9. stage 4 heading full text stays "Choose inputs and quantity to predict" for stage 2', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    await expect(page.locator('#step-features h2')).toHaveText('Choose inputs and quantity to predict');
  });

  test('10. grouped stages 4 and 6 use plain substage labels (no 4A/4B/6A/6B tags)', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    // Four substages total, two under each grouped stage.
    await expect(page.locator('#view-project .substage-item')).toHaveCount(4);
    // The old numeric tag spans are gone; labels are plain.
    await expect(page.locator('#view-project .substage-tag')).toHaveCount(0);
    const labels = await page.locator('#view-project .substage-label').allTextContents();
    expect(labels.map(t => t.trim())).toEqual([
      'Choose models', 'Configure validation and train',
      'Predict and export', 'Monitor and revalidate'
    ]);
    // No substage row text begins with an ordered-list "<number>." marker.
    for (const t of labels) expect(t.trim()).not.toMatch(/^\d+\.\s/);
  });

  // ---- Single-stage workspace -----------------------------------------

  test('11. the workspace shows exactly one stage panel at a time', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    // On a fresh Project view only Load data is shown.
    await expect(page.locator('#view-project .panel:visible')).toHaveCount(1);
    await expect(page.locator('#step-upload')).toBeVisible();
    await expect(page.locator('#step-features')).not.toBeVisible();
    // Loading data and moving to stage 2 hides stage 1 and shows stage 2.
    await loadDataset(page);
    await goToStage(page, 'step-features');
    await expect(page.locator('#view-project .panel:visible')).toHaveCount(1);
    await expect(page.locator('#step-upload')).not.toBeVisible();
    await expect(page.locator('#step-features')).toBeVisible();
  });

  test('12. clicking a rail stage switches the shown panel', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    await loadDataset(page);
    // Stage 2 is now available; clicking its rail row reveals its panel.
    await page.locator('#view-project .stage-item[data-stage="2"] a.stage-row').click();
    await expect(page.locator('#step-features')).toBeVisible();
    await expect(page.locator('#step-upload')).not.toBeVisible();
  });

  test('13. substages are shown only while their grouped stage is current', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    // Before reaching stage 4 its substage list is collapsed.
    await expect(page.locator('#view-project .stage-item[data-stage="4"] .substage-list'))
      .not.toBeVisible();
    await loadDataset(page);
    await selectTargetAndFeatures(page);
    await goToStage(page, 'step-model');
    await expect(page.locator('#view-project .stage-item[data-stage="4"] .substage-list'))
      .toBeVisible();
    await expect(page.locator('#view-project .stage-item[data-stage="4"]'))
      .toHaveClass(/substages-open/);
  });

  // ---- Collapsible stage guidance -------------------------------------

  test('14. each stage keeps What/Why/Look-for guidance in a collapsed disclosure', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    for (const id of PANEL_IDS) {
      const guidance = page.locator(`#${id} details.stage-guidance`);
      await expect(guidance, `${id} guidance`).toHaveCount(1);
      // Collapsed by default so it does not dominate the workspace.
      expect(await guidance.evaluate(el => el.hasAttribute('open')), `${id} open`).toBe(false);
      await expect(guidance.locator('summary')).toContainText(/guidance/i);
      // The content is still present (textContent) for reference.
      await expect(guidance).toContainText('What you are doing');
      await expect(guidance).toContainText('Why it matters');
      await expect(guidance).toContainText('Look for');
    }
  });

  // ---- Model presentation grouping (unchanged content) -----------------

  test('15. recommended starting models are Linear, Random Forest and Gradient Boosting', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    const rec = page.locator('#step-model .model-group:not(.other-models-group) .model-card input[name="modelType"]');
    await expect(rec).toHaveCount(3);
    const values = await rec.evaluateAll(els => els.map(e => e.value));
    expect(values.sort()).toEqual(['forest', 'gboost', 'linear'].sort());
  });

  test('16. the remaining models sit under a collapsed "Other modelling approaches" disclosure', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    const other = page.locator('#step-model .other-models-group');
    await expect(other).toHaveCount(1);
    expect(await other.evaluate(el => el.hasAttribute('open'))).toBe(false);
    await expect(other.locator('summary')).toContainText('Other modelling approaches');
  });

  test('17. the neural network is marked Advanced and lives in the Other group', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    const annCard = page.locator('#step-model .other-models-group .model-card:has(input[value="ann"])');
    await expect(annCard).toHaveCount(1);
    await expect(annCard.locator('.advanced-badge')).toContainText(/advanced/i);
  });

  test('18. advanced model settings are collapsed by default (tuning hidden)', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    const adv = page.locator('#step-model details.advanced-settings');
    await expect(adv).toHaveCount(1);
    await expect(adv.locator('summary')).toContainText('Advanced model settings');
    expect(await adv.evaluate(el => el.hasAttribute('open'))).toBe(false);
    await expect(page.locator('#tuningMode')).toBeAttached();
    await expect(page.locator('#tuningMode')).not.toBeVisible();
  });

  test('19. opening advanced model settings reveals tuning + model-specific controls', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    await loadDataset(page);
    await selectTargetAndFeatures(page);
    await goToStage(page, 'step-model');
    await page.locator('#step-model details.advanced-settings summary').click();
    await expect(page.locator('#tuningMode')).toBeVisible();
    await expect(page.locator('#modelParams')).toBeVisible();
  });

  test('20. advanced validation and governance are presented as a distinct disclosure', async ({ page }) => {
    await fullWorkflow(page);
    const gov = page.locator('#step-diagnostics details.governance-details');
    await expect(gov).toHaveCount(1);
    await expect(gov.locator('summary')).toContainText('Advanced validation and governance');
    await expect(page.locator('#downloadModelBtn')).toBeVisible();
  });

  test('21. Prepare data shows a "Recommended starting point" note without changing defaults', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    await expect(page.locator('#step-preprocess .recommendation-note'))
      .toContainText('Recommended starting point');
    await expect(page.locator('#numericMissing')).toHaveValue('mean');
    await expect(page.locator('#numericScaling')).toHaveValue('standard');
    await expect(page.locator('#categoricalMissing')).toHaveValue('missing');
  });

  // ---- Engineering terminology -----------------------------------------

  test('22. target is labelled "Quantity to predict" with the formal term in secondary help', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    const label = page.locator('#step-features label:has(#targetColumn)');
    await expect(label).toContainText('Quantity to predict');
    await expect(label.locator('.term-note')).toContainText('target');
  });

  test('23. auto-detect control uses input-variable language', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    await expect(page.locator('#autoFeaturesBtn')).toContainText(/input variables/i);
  });

  // ---- Back / Continue navigation --------------------------------------

  test('24. Continue-to-next buttons carry the agreed wording', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    await expect(page.locator('#step-model .stage-continue')).toHaveText('Continue to validation and training');
    await expect(page.locator('#step-diagnostics .stage-continue')).toHaveText('Continue to prediction and export');
    await expect(page.locator('#step-predict .stage-continue')).toHaveText('Continue to monitoring and revalidation');
  });

  test('25. the Load-data Continue button is disabled until a dataset is loaded, then navigates', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    const cont = page.locator('#step-upload .stage-continue');
    await expect(cont).toBeDisabled();
    await loadDataset(page);
    await expect(cont).toBeEnabled();
    await cont.click();
    // Navigation reveals and focuses the now-available target stage.
    await expect(page.locator('#step-features')).toBeVisible();
    await expect(page.locator('#step-features')).toBeFocused();
  });

  test('26. every stage after the first offers a Back control', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    await loadDataset(page);
    await goToStage(page, 'step-features');
    const back = page.locator('#step-features .stage-back');
    await expect(back).toBeVisible();
    await back.click();
    await expect(page.locator('#step-upload')).toBeVisible();
  });

  test('27. unsafe stage jumping is prevented — a locked stage link does not reveal it', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    await expect(page.locator('#step-diagnostics')).toHaveClass(/locked/);
    await page.locator('#view-project .stage-item[data-stage="5"] a[href="#step-diagnostics"]')
      .click({ force: true });
    // Still locked and still not shown; the guard refused navigation.
    await expect(page.locator('#step-diagnostics')).toHaveClass(/locked/);
    await expect(page.locator('#step-diagnostics')).not.toBeVisible();
  });

  test('28. the rail mirrors panel availability as stages unlock', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    const stage2Row = page.locator('#view-project .stage-item[data-stage="2"] > a.stage-row');
    await expect(stage2Row).toHaveClass(/is-locked/);
    await loadDataset(page);
    await expect(stage2Row).toHaveClass(/is-available/);
  });

  test('29. a full model can still be trained through the shell', async ({ page }) => {
    await fullWorkflow(page);
    await expect(page.locator('#metricsTable tbody tr').first()).toBeVisible();
    await expect(page.locator('#step-diagnostics')).not.toHaveClass(/locked/);
  });
});

test.describe('Project mode — responsive layout and accessibility', () => {
  async function layout(page) {
    return page.evaluate(() => {
      const r = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { x: b.x, y: b.y, w: b.width, h: b.height, bottom: b.bottom, right: b.right };
      };
      const cs = (sel, prop) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el)[prop] : null;
      };
      return {
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
        topbar: r('#view-project .app-topbar'),
        sidebar: r('#view-project .sidebar'),
        workspace: r('#view-project .workspace'),
        label1: r('#view-project .stage-item[data-stage="1"] .stage-label'),
        num1: r('#view-project .stage-item[data-stage="1"] .stage-num'),
        stageListType: cs('#view-project .stage-list', 'listStyleType'),
      };
    });
  }

  // ---- Desktop ---------------------------------------------------------

  test('30. desktop: a compact rail sits left of a dominant workspace', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await ready(page);
    await enterProjectMode(page);
    const L = await layout(page);
    // Rail is a compact left column (~220px) — not more than 250px.
    expect(L.sidebar.w).toBeGreaterThanOrEqual(180);
    expect(L.sidebar.w).toBeLessThanOrEqual(250);
    // The workspace dominates: clearly wider than the rail and to its right.
    expect(L.workspace.w).toBeGreaterThan(L.sidebar.w * 2);
    expect(L.workspace.x).toBeGreaterThanOrEqual(L.sidebar.right - 4);
    // No horizontal overflow.
    expect(L.scrollW).toBeLessThanOrEqual(L.innerW + 1);
  });

  test('31. desktop: stage labels read as text, not crushed into the number badge', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await ready(page);
    await enterProjectMode(page);
    const L = await layout(page);
    expect(L.label1.w).toBeGreaterThan(50);
    expect(L.num1.w).toBeLessThan(36);
    expect(L.label1.h).toBeLessThan(30);
    expect(L.stageListType).toBe('none');
  });

  // ---- Tablet and mobile ----------------------------------------------

  for (const vp of [{ w: 768, h: 1024, name: 'tablet' }, { w: 390, h: 844, name: 'mobile' }]) {
    test(`32.${vp.name}: rail stacks above the workspace with no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await ready(page);
      await enterProjectMode(page);
      const L = await layout(page);
      // Single column: the rail is entirely above the workspace.
      expect(L.sidebar.y).toBeLessThan(L.workspace.y);
      expect(L.sidebar.bottom).toBeLessThanOrEqual(L.workspace.y + 2);
      // No horizontal scrolling.
      expect(L.scrollW).toBeLessThanOrEqual(L.innerW + 1);
    });

    test(`33.${vp.name}: stage links stay keyboard-focusable`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await ready(page);
      await enterProjectMode(page);
      const link = page.locator('#view-project .stage-item[data-stage="1"] a.stage-row');
      await link.focus();
      await expect(link).toBeFocused();
    });
  }

  // ---- Current-stage / locked-state accessibility ----------------------

  test('34. the shown stage is exposed with aria-current="step"', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    await expect(page.locator('#view-project .stage-item[data-stage="1"] .stage-row'))
      .toHaveAttribute('aria-current', 'step');
  });

  test('35. a locked stage exposes its unavailable state to assistive tech', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    await expect(page.locator('#view-project .stage-item[data-stage="2"] a.stage-row'))
      .toHaveAttribute('aria-disabled', 'true');
    await loadDataset(page);
    await expect(page.locator('#view-project .stage-item[data-stage="2"] a.stage-row'))
      .toHaveAttribute('aria-disabled', 'false');
  });
});

test.describe('Project mode — regression guards (presentation only)', () => {
  test('R1. all eight internal panels still exist with their original IDs', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    for (const id of PANEL_IDS) {
      await expect(page.locator(`#${id}`), id).toHaveCount(1);
    }
  });

  test('R2. the eleven model radio values are unchanged and default remains linear', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    const values = await page.locator('#step-model input[name="modelType"]').evaluateAll(
      els => els.map(e => e.value)
    );
    expect(values.sort()).toEqual([...MODEL_VALUES].sort());
    await expect(page.locator('#step-model input[name="modelType"][value="linear"]')).toBeChecked();
  });

  test('R3. the training pipeline still yields metrics and an enabled model download', async ({ page }) => {
    await fullWorkflow(page);
    await expect(page.locator('#metricsTable tbody tr').first()).toBeVisible();
    await expect(page.locator('#downloadModelBtn')).toBeEnabled();
  });

  test('R4. the comparison preset table still documents all eleven model families', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    const rows = page.locator('#comparisonPresetTable tbody tr');
    await expect(rows).toHaveCount(11);
  });

  test('R5. the train action still reads "Train and evaluate"', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    await expect(page.locator('#trainBtn')).toHaveText('Train and evaluate');
  });

  test('R6. no non-local network requests occur while driving the workflow', async ({ page }) => {
    const externalRequests = [];
    const LOCAL = new Set(['127.0.0.1', 'localhost', '[::1]']);
    page.on('request', req => {
      const url = req.url();
      if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('about:')) return;
      try { if (!LOCAL.has(new URL(url).hostname)) externalRequests.push(url); } catch { /* non-network */ }
    });
    await fullWorkflow(page);
    expect(externalRequests, `Unexpected external requests:\n${externalRequests.join('\n')}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Workflow navigation-state model.
//
// The rail must render each stage in exactly ONE of four states — Active,
// Completed, Available, Locked — derived only from which panel is shown and the
// inherited lock cascade. These tests assert the states from COMPUTED STYLES and
// ARIA (not just text), and specifically guard the reported defect: on a fresh
// project (no data, no model) Stage 6 must NOT look active or completed.
// ---------------------------------------------------------------------------
test.describe('Project mode — workflow navigation state', () => {
  // Read the rendered state of a top-level stage row: its state class, the
  // computed marker background, aria attributes and whether a completed check
  // glyph is present.
  async function stageState(page, index) {
    return page.evaluate((i) => {
      const item = document.querySelector(`#view-project .stage-item[data-stage="${i}"]`);
      const row = item && item.querySelector(':scope > a.stage-row');
      if (!row) return null;
      const num = row.querySelector('.stage-num');
      const label = row.querySelector('.stage-label');
      const cls = ['is-active', 'is-complete', 'is-available', 'is-locked']
        .filter((c) => row.classList.contains(c));
      const check = label ? getComputedStyle(label, '::after').content : 'none';
      return {
        state: cls.length === 1 ? cls[0] : cls,
        ariaCurrent: row.getAttribute('aria-current'),
        ariaDisabled: row.getAttribute('aria-disabled'),
        markerBg: num ? getComputedStyle(num).backgroundColor : null,
        rowWeight: getComputedStyle(row).fontWeight,
        // A completed row appends a check via ::after; anything else is "none"/"".
        hasCheck: check && check !== 'none' && check !== 'normal' && check.indexOf('✓') !== -1,
      };
    }, index);
  }

  const countAriaCurrent = (page) =>
    page.locator('#view-project [aria-current="step"]').count();

  // 1. Exactly one stage is Active on a fresh project, and it is Stage 1.
  test('N1. a fresh project has exactly one active stage (Stage 1)', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    expect(await countAriaCurrent(page)).toBe(1);
    const s1 = await stageState(page, 1);
    expect(s1.state).toBe('is-active');
    expect(s1.ariaCurrent).toBe('step');
  });

  // 2. Stage 1's active marker is the strong (primary-dark) treatment.
  test('N2. the active stage uses the strongest marker treatment', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    const s1 = await stageState(page, 1);
    // --primary is a dark teal (rgb(18,95,118)); active text is bold.
    expect(s1.markerBg).toBe('rgb(18, 95, 118)');
    expect(Number(s1.rowWeight)).toBeGreaterThanOrEqual(700);
  });

  // 3. THE DEFECT: on a fresh project Stage 6 must be Locked — not active,
  //    not completed, muted marker, not clickable.
  test('N3. a fresh project does not show Stage 6 as active or completed', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    const s6 = await stageState(page, 6);
    expect(s6.state).toBe('is-locked');
    expect(s6.ariaCurrent).toBeNull();
    expect(s6.ariaDisabled).toBe('true');
    expect(s6.hasCheck).toBe(false);
  });

  // 4. Stage 6's marker must differ from the active-stage marker (the exact
  //    computed-style symptom the reviewer saw).
  test('N4. Stage 6 marker is visually distinct from the active marker', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    const s1 = await stageState(page, 1);
    const s6 = await stageState(page, 6);
    expect(s6.markerBg).not.toBe(s1.markerBg);
    // It is the neutral --line grey, not the primary fill.
    expect(s6.markerBg).toBe('rgb(220, 226, 232)');
  });

  // 5. No later stage is Active or Completed on a fresh project.
  test('N5. no later stage is active or completed initially', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    for (const i of [2, 3, 4, 5, 6]) {
      const s = await stageState(page, i);
      expect(s.state, `stage ${i}`).not.toBe('is-active');
      expect(s.state, `stage ${i}`).not.toBe('is-complete');
    }
  });

  // 6. Loading a dataset makes Stage 2 Available (neutral, clickable) — not
  //    completed — while Stage 1 remains active until the user moves on.
  test('N6. loading a dataset makes Stage 2 available, not completed', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    await loadDataset(page);
    const s2 = await stageState(page, 2);
    expect(s2.state).toBe('is-available');
    expect(s2.ariaDisabled).toBe('false');
    expect(s2.hasCheck).toBe(false);
    // Still exactly one active stage.
    expect(await countAriaCurrent(page)).toBe(1);
  });

  // 7. Moving to Stage 2 marks Stage 1 Completed and Stage 2 Active.
  test('N7. advancing marks the finished stage completed and the new one active', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    await loadDataset(page);
    await goToStage(page, 'step-features');
    const s1 = await stageState(page, 1);
    const s2 = await stageState(page, 2);
    expect(s1.state).toBe('is-complete');
    expect(s1.hasCheck).toBe(true);
    expect(s1.ariaCurrent).toBeNull();
    expect(s2.state).toBe('is-active');
    expect(s2.ariaCurrent).toBe('step');
    expect(await countAriaCurrent(page)).toBe(1);
  });

  // 8. Completed and Active are visually distinct (not the same treatment).
  test('N8. completed and active stages are visually distinct', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    await loadDataset(page);
    await goToStage(page, 'step-features');
    const s1 = await stageState(page, 1); // completed
    const s2 = await stageState(page, 2); // active
    expect(s1.markerBg).not.toBe(s2.markerBg);
    // Completed uses the success colour and a check; active does neither.
    expect(s1.hasCheck).toBe(true);
    expect(s2.hasCheck).toBe(false);
  });

  // 9. Choosing target + features makes Stages 3 and 4 Available but leaves
  //    Stages 5 and 6 Locked (not completed).
  test('N9. selecting inputs unlocks prepare/train but not evaluate/predict', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    await loadDataset(page);
    await selectTargetAndFeatures(page);
    expect((await stageState(page, 3)).state).toBe('is-available');
    expect((await stageState(page, 4)).state).toBe('is-available');
    expect((await stageState(page, 5)).state).toBe('is-locked');
    expect((await stageState(page, 6)).state).toBe('is-locked');
  });

  // 10. During the grouped Stage 4, the parent stays Active across both
  //     substages and aria-current stays unique (on the substage).
  test('N10. grouped Stage 4 stays active across both substages', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    await loadDataset(page);
    await selectTargetAndFeatures(page);

    await goToStage(page, 'step-model');
    let s4 = await stageState(page, 4);
    expect(s4.state).toBe('is-active');
    expect(await countAriaCurrent(page)).toBe(1);
    // aria-current is on the substage, not the parent row.
    expect(s4.ariaCurrent).toBeNull();
    await expect(page.locator('#view-project .substage-item[data-panels="step-model"] a'))
      .toHaveAttribute('aria-current', 'step');

    await goToStage(page, 'step-split');
    s4 = await stageState(page, 4);
    expect(s4.state).toBe('is-active');
    expect(await countAriaCurrent(page)).toBe(1);
    await expect(page.locator('#view-project .substage-item[data-panels="step-split"] a'))
      .toHaveAttribute('aria-current', 'step');
    // Stages 5 and 6 must not look completed while training is still pending.
    expect((await stageState(page, 5)).state).not.toBe('is-complete');
    expect((await stageState(page, 6)).state).not.toBe('is-complete');
  });

  // 11. After training, Stages 1–4 are Completed, Stage 5 is Active, and Stage 6
  //     becomes Available (never completed just because predict unlocked).
  test('N11. after training the earlier stages complete and predict becomes available', async ({ page }) => {
    await fullWorkflow(page); // ends on step-diagnostics (Stage 5) via auto-advance
    for (const i of [1, 2, 3, 4]) {
      expect((await stageState(page, i)).state, `stage ${i}`).toBe('is-complete');
    }
    expect((await stageState(page, 5)).state).toBe('is-active');
    expect((await stageState(page, 6)).state).toBe('is-available');
    expect((await stageState(page, 6)).hasCheck).toBe(false);
    expect(await countAriaCurrent(page)).toBe(1);
    await expect(page.locator('#projectStatusText')).toHaveText('Model trained');
  });

  // 12. Navigating into Stage 6 makes it Active and Stage 5 Completed.
  test('N12. entering Stage 6 makes it active and completes Stage 5', async ({ page }) => {
    await fullWorkflow(page);
    await goToStage(page, 'step-predict');
    expect((await stageState(page, 6)).state).toBe('is-active');
    expect((await stageState(page, 5)).state).toBe('is-complete');
    expect(await countAriaCurrent(page)).toBe(1);
    await expect(page.locator('#view-project .substage-item[data-panels="step-predict"] a'))
      .toHaveAttribute('aria-current', 'step');
  });

  // 13. Back navigation recomputes states correctly.
  test('N13. back navigation updates the active and completed states', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    await loadDataset(page);
    await selectTargetAndFeatures(page);
    await goToStage(page, 'step-preprocess'); // Stage 3 active
    expect((await stageState(page, 3)).state).toBe('is-active');
    await goToStage(page, 'step-features');   // back to Stage 2
    expect((await stageState(page, 2)).state).toBe('is-active');
    expect((await stageState(page, 3)).state).not.toBe('is-active');
    expect((await stageState(page, 1)).state).toBe('is-complete');
    expect(await countAriaCurrent(page)).toBe(1);
  });

  // 14. A Locked stage is genuinely not navigable.
  test('N14. a locked stage cannot be opened', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    expect((await stageState(page, 6)).state).toBe('is-locked');
    await page.locator('#view-project .stage-item[data-stage="6"] > a.stage-row')
      .click({ force: true });
    // Still on Stage 1; the guard refused the jump.
    await expect(page.locator('#step-upload')).toBeVisible();
    await expect(page.locator('#step-predict')).not.toBeVisible();
    expect(await page.evaluate(() => window.EMSProjectShell.currentPanel())).toBe('step-upload');
  });

  // 15. The presentation-layer consistency invariant holds in every state.
  test('N15. dataset/model status stays consistent with active + completed stages', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    // Fresh: no dataset ⇒ no completed stages, exactly one active.
    expect(await page.evaluate(() => window.EMSProjectShell.checkConsistency())).toEqual([]);
    await expect(page.locator('#projectStatusText')).toHaveText('No dataset loaded');
    const completedFresh = await page.locator('#view-project .stage-row.is-complete').count();
    expect(completedFresh).toBe(0);
    // Trained: consistency still holds.
    await loadDataset(page);
    await selectTargetAndFeatures(page);
    await train(page);
    expect(await page.evaluate(() => window.EMSProjectShell.checkConsistency())).toEqual([]);
  });

  // 16. Restoration reflects lock state. A project restored WITHOUT its CSV
  //     unlocks predict/diagnostics while the data stages stay locked; the rail
  //     must not fabricate completed early stages from that.
  test('N16. a restored-without-CSV state does not fake completed data stages', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    // Reproduce the loadProjectFile()-without-CSV lock pattern exactly: the
    // model/diagnostics/predict panels unlocked, the raw-data stages still locked.
    await page.evaluate(() => {
      ['step-diagnostics', 'step-predict'].forEach((id) =>
        document.getElementById(id).classList.remove('locked'));
      ['step-features', 'step-preprocess', 'step-model', 'step-split'].forEach((id) =>
        document.getElementById(id).classList.add('locked'));
      window.EMSProjectShell.syncAll();
    });
    // No dataset ⇒ no completed stages, and the invariant check passes.
    expect(await page.locator('#view-project .stage-row.is-complete').count()).toBe(0);
    expect(await page.evaluate(() => window.EMSProjectShell.checkConsistency())).toEqual([]);
    // Stage 6 (predict) is genuinely reachable now, so it may be Available —
    // but never Active/Completed while sitting on the still-shown upload stage.
    const s6 = await stageState(page, 6);
    expect(['is-available', 'is-active']).toContain(s6.state);
    expect(s6.hasCheck).toBe(false);
  });

  // 17. A fresh session (the only "reset" the app offers) opens on Stage 1 as
  //     the sole active stage with nothing completed.
  test('N17. a fresh session opens on Stage 1 with nothing completed', async ({ page }) => {
    await ready(page);
    await enterProjectMode(page);
    expect(await countAriaCurrent(page)).toBe(1);
    expect((await stageState(page, 1)).state).toBe('is-active');
    expect(await page.locator('#view-project .stage-row.is-complete').count()).toBe(0);
    expect(await page.evaluate(() => window.EMSProjectShell.currentPanel())).toBe('step-upload');
  });
});
