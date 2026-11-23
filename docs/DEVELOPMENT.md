# Development and local-run guide — Engineering ML Studio

This guide describes how to run Engineering ML Studio locally and how to run the automated
baseline tests. It documents the **current** application exactly as inherited; it does **not**
introduce a build step, a framework, or any change to user-facing behaviour.

## What this application is (and is not)

- **A pure client-side static web application.** All HTML, CSS, and JavaScript are served as-is.
- **No build system, no bundler, no framework, no transpilation.** The browser loads the source
  files directly; there is nothing to "compile".
- **No runtime npm dependencies.** The `package.json` in this repository exists **only** for local
  development and automated testing (Playwright). The shipped application uses none of it.
- **No backend.** Data preparation, training, and prediction all run in the browser. No data is
  uploaded; there are no accounts or telemetry.

## Prerequisites

| Purpose | Requirement | Notes |
| --- | --- | --- |
| Run the app | A modern Chromium- or Firefox-based browser | The app uses Web Workers and dynamic script loading. |
| Serve the app | Python 3 (any 3.x) | Used only as a static file server. Verified with Python 3.12. |
| Run the tests (optional) | Node.js 18+ and npm | Verified with Node 18.19.1 / npm 9.2.0. Test tooling only. |

> **Why a server is required.** The app is loaded over `http://`, not `file://`. It creates a Web
> Worker (`new Worker('./js/lrs-worker.js')`) and loads its modules with dynamic `<script>`
> injection; browsers block both under the `file://` scheme. Opening `index.html` directly will not
> work — always serve it over HTTP.

## Run the application locally

From the repository root:

```bash
python3 -m http.server 8000
```

Then open:

```
http://127.0.0.1:8000
```

To force fully offline mode (bundled libraries only, no CDN requests), append the query parameter:

```
http://127.0.0.1:8000/?localOnly=1
```

A shortcut is also provided:

```bash
npm run serve      # same as: python3 -m http.server 8000
```

**Stop the server** with `Ctrl+C` in the terminal running it.

Any static file server works (e.g. `npx http-server`, `php -S`); Python is used here only because
it is universally available and requires no installation.

## Recommended classroom setting

For teaching sessions where internet access is unreliable or unavailable, use the local-only URL:

```text
http://127.0.0.1:8000/?localOnly=1
```

Before the session:

1. Ensure the repository and its bundled `vendor/` libraries are available on each computer.
2. Start the application locally from the repository root using `python3 -m http.server 8000` or `npm run serve`.
3. Open the local-only URL in the browser.
4. Check that the runtime status displays **Offline mode** and that the bundled libraries are loaded locally.

The application is served from the computer itself, so an external internet connection is not required once the repository is available locally. Keep the local server running for the duration of the session.

The `localOnly=1` setting prevents the application from attempting to load its supported libraries from a CDN. It does not download or install the application for students.

## Local-only data handling (confirmed)

All processing happens in your browser. When the app is opened with `?localOnly=1`, it loads only
the libraries bundled under `vendor/` and makes no external network requests during the core
workflow. This is asserted directly by the automated tests (see below): a test fails if any
non-local request is observed while loading a dataset and training a model.

## Run the automated tests

The tests use [Playwright](https://playwright.dev/) to drive the real application in a headless
browser. They are the reproducible baseline for current behaviour.

First-time setup (installs the dev tooling and a pinned Chromium build):

```bash
npm install
npx playwright install chromium
```

Run all tests:

```bash
npm test
```

Useful variants:

```bash
npm run test:headed     # watch the browser drive the app
npm run test:report     # open the last HTML report (after a CI-style run)
```

The Playwright config (`playwright.config.js`) automatically starts the Python static server on
port 8000 before the tests and reuses an already-running one during local development. To use a
different port, set `EMS_TEST_PORT`.

Test layout:

- `tests/smoke.spec.js` — end-to-end smoke tests of the current workflow (load data → select
  target & features → train → view metrics), plus a check that no data leaves the browser.
- `tests/unit.spec.js` — focused unit tests of the inherited ML core (`window.MLCore`), run inside
  the browser via `page.evaluate` because the modules bind to the global `window` and are not
  importable in Node.
- `tests/explore.spec.js` — the landing page, navigation, and the problem-led Explore workflow,
  including the Phase 2 **Learn** route and the Explore "Continue in Python" call to action.

### Python tests (dataset generator + teaching notebook)

The synthetic-dataset generator and the Phase 2 "Learn the Code" notebook have their own Python
tests, run with the standard-library test runner:

```bash
python -m unittest discover -s tests -p "test_*.py" -v
```

- `tests/test_pipe_dataset.py` — properties of the generated pressure-drop CSV. Needs only `numpy`.
- `tests/test_notebook_structure.py` — static checks on `notebooks/pipe_pressure_drop.ipynb`
  (valid, output-free, expected sections, seed, model names, units, disclaimers). Standard-library
  only, so it runs anywhere.
- `tests/test_notebook_execution.py` — executes the notebook end-to-end **offline** (from the
  committed CSV) and checks the metric ranges, model ranking, and engineering checks. It **skips
  cleanly** if the notebook runtime tooling is absent; to run it, install the notebook dependencies
  plus `nbclient`/`nbconvert`/`nbformat`/`ipykernel` (see `notebooks/requirements.txt`).

Both suites (browser and Python) run in CI; see `.github/workflows/test.yml`.

## Deployment (current)

The current deployment model is a **static website**, published to GitHub Pages at
<https://weiwangstfc.github.io/engineering-ml-studio/> by `.github/workflows/pages.yml`. The
workflow runs on every push to `main` (and on demand from the Actions tab), uploads the
checked-out repository root as the Pages artifact and deploys it. There is no build step and no
build artifact to produce: the repository root *is* the site (`.nojekyll` stops Jekyll
processing).

The repository must have **Settings → Pages → Build and deployment → Source: "GitHub Actions"**
selected for the workflow to publish.

The site is served from the `/engineering-ml-studio/` sub-path, so every asset reference must
stay relative (`./css/app.css`, `./js/lrs-worker.js`); a root-absolute `/css/...` would 404.

### Security headers on a static host

GitHub Pages serves files only — it cannot set custom response headers. That matters for one
directive in particular: **`frame-ancestors` works only as an HTTP header and is ignored in a
`<meta>` CSP**, so it is deliberately not listed in `index.html`. Clickjacking is instead handled
by `js/frame-guard.js`, which runs first in `<head>` and refuses to render the application inside a
frame. It is covered by tests 10 and 11 in `tests/smoke.spec.js`.

If the site ever moves to a host that can set headers (or sits behind a CDN or reverse proxy that
can), add `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY` there and
keep the script as a second layer.

Deploying elsewhere only requires serving the repository's static files from any web server or
static host.

The **primary supported distribution is this browser-based static web app.** The original Local
Regression Studio documentation mentioned packaged "editions" and per-OS launcher scripts; those
are **not part of this repository** and are not a current feature (see
[`../ROADMAP.md`](../ROADMAP.md)).

## What not to change in this stage

Per the current project stage, this baseline work must **not**:

- redesign the interface or change user-facing functionality;
- add a frontend framework, bundler, or build step;
- add runtime dependencies or server-side compute;
- modify the example datasets or `LICENSES.txt`.

See [`BASELINE_BEHAVIOUR.md`](BASELINE_BEHAVIOUR.md) for the behaviour these tests protect.
