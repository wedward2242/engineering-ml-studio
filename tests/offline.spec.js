
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 UK Research and Innovation (UKRI)

// These are the Playwright functions used to run the test and check results.
const { test, expect } = require('@playwright/test');

// The application should only contact its own local development server.
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

// Return true for URLs that do not require an external network connection.
function isLocalUrl(url) {
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('about:')) {
    return true;
  }

  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return true;
  }
}

test('offline startup loads bundled libraries without external requests', async ({ page }) => {
  // Collect external requests before navigation so that initial loading is monitored.
  const externalRequests = [];
  const pageErrors = [];

  page.on('request', request => {
    if (!isLocalUrl(request.url())) {
      externalRequests.push(request.url());
    }
  });

  // Record uncaught browser errors as another indication of failed startup.
  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });

  // The query parameter explicitly selects the application's offline loading path.
  await page.goto('/?localOnly=1');

  // Wait until the application controllers have loaded.
  await page.waitForFunction(() =>
    Boolean(window.LocalRegressionApp && window.EMSModes && window.EMSExplore)
  );

  // Read the dependency status and runtime globals from the browser.
  const offlineStatus = await page.evaluate(() => ({
    modeRequested: window.__dependencyStatus?.modeRequested,
    libraries: window.__dependencyStatus?.libraries,
    csvEngineAvailable: Boolean(window.CSVEngine && window.CSVEngine.parse),
    plotlyAvailable: Boolean(window.Plotly && window.Plotly.newPlot),
    runtimeLabel: document.getElementById('runtimeMode')?.textContent
  }));

  // Confirm that the URL selected offline mode.
  expect(offlineStatus.modeRequested).toBe('local-only');

  // Confirm that both bundled third-party libraries loaded successfully.
  expect(offlineStatus.libraries.csv.source).toBe('local');
  expect(offlineStatus.libraries.plotly.source).toBe('local');

  // Confirm that the loaded libraries expose the functions the application needs.
  expect(offlineStatus.csvEngineAvailable).toBe(true);
  expect(offlineStatus.plotlyAvailable).toBe(true);

  // Confirm that the application visibly reports its runtime mode.
  expect(offlineStatus.runtimeLabel).toContain('Offline mode');

  // Confirm that startup did not produce uncaught browser errors.
  expect(pageErrors).toEqual([]);

  // Fail if any request escaped to an external host during startup.
  expect(
    externalRequests,
    `Unexpected external requests:\n${externalRequests.join('\n')}`
  ).toEqual([]);
});
