// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 UK Research and Innovation (UKRI)
// Engineering ML Studio — Explore mode controller (Phase 1 prototype).
//
// A guided, beginner-friendly, four-stage regression workflow built around
// concrete engineering and mathematical examples:
//
//   1. Understand the engineering or mathematical problem
//   2. Choose an approach (simple trend → flexible relationship → compare)
//   3. Train and compare predictions
//   4. Interpret the engineering meaning where applicable
//
// The journey starts from the engineering problem, not from model names. Model
// names (Linear Regression, Decision Tree, Random Forest) are kept visible but
// secondary, introduced gradually as "approaches".
//
// It reuses the SAME computation the full Project mode uses — CSV parsing
// (window.CSVEngine), column inference / splitting / preprocessing / metrics
// (window.MLCore), the model adapter (window.LRSPlatform.getModelAdapter) and
// plotting (window.Plotly). No machine-learning maths is duplicated here; this
// module only orchestrates those existing functions and renders a simple UI.
//
// All processing runs locally in the browser. The only network requests are
// same-origin fetches of the bundled example CSV files.
(function (global) {
  'use strict';

  // --- Bundled examples (provenance documented & confirmed MIT-reusable). -------
  // See examples/README.md. The bundled examples include several synthetic engineering
  // datasets plus a generic nonlinear mathematical demonstration. The pipe pressure-drop 
  // dataset remains the primary, default example.
  var EXAMPLES = [
    {
      key: 'pipe',
      file: './examples/pipe_pressure_drop_sample.csv',
      engineering: true,
      title: 'Predict pressure drop in a pipe',
      short: 'Pressure drop in a pipe',
      target: 'pressure_drop_kpa',
      targetLabel: 'pressure drop',
      unit: 'kPa',
      intro: 'A fluid flowing through a pipe loses pressure to friction along the pipe wall. ' +
        'Mechanical and thermal engineers need to estimate this pressure drop to size pumps, ' +
        'choose pipe diameters and check whether a flow system will work. Here we predict the ' +
        'pressure drop from a few properties of the pipe and the fluid.',
      inputs: [
        { name: 'flow_velocity_m_s', label: 'Mean flow velocity', unit: 'm/s' },
        { name: 'pipe_length_m', label: 'Pipe length', unit: 'm' },
        { name: 'pipe_diameter_m', label: 'Internal pipe diameter', unit: 'm' },
        { name: 'fluid_density_kg_m3', label: 'Fluid density', unit: 'kg/m³' },
        { name: 'dynamic_viscosity_pa_s', label: 'Dynamic viscosity', unit: 'Pa·s' }
      ],
      features: ['pipe_length_m', 'pipe_diameter_m', 'flow_velocity_m_s', 'fluid_density_kg_m3', 'dynamic_viscosity_pa_s'],
      keyInputs: 'flow velocity, pipe length, diameter, fluid density, viscosity',
      trendText: 'Pressure drop generally increases when flow velocity or pipe length increases, ' +
        'and decreases when the pipe diameter increases.',
      // Structured trends used for the deterministic engineering checks in stage 4.
      trends: [
        { feature: 'flow_velocity_m_s', label: 'flow velocity', direction: 'increase' },
        { feature: 'pipe_length_m', label: 'pipe length', direction: 'increase' },
        { feature: 'pipe_diameter_m', label: 'pipe diameter', direction: 'decrease' }
      ],
      rangeText: 'The dataset has 500 rows. Pressure drop ranges from roughly 0.1 kPa to just over ' +
        '200 kPa across the sampled conditions, and every row is in turbulent flow.',
      disclaimer: 'This is a <strong>synthetic demonstration dataset</strong>, generated from a documented ' +
        'engineering equation (Darcy–Weisbach) with a fixed random seed and a small amount of added noise. ' +
        'It is not experimental, validated or safety-grade data, and must not be used for real design.',
      schematic: true,
      approxRows: 500
    },
    {
      key: 'fin',
      file: './examples/fin_heat_dissipation_sample.csv',
      engineering: true,
      title: 'Predict heat dissipation from a fin',
      short: 'Heat dissipation from a fin',
      target: 'heat_dissipation_w',
      targetLabel: 'heat dissipation',
      unit: 'W',
      intro: 'A fin increases the surface area available for convective heat transfer. Here we predict heat dissipation from the convection coefficient, fin area and temperature difference.',
      inputs: [
        { name: 'h_w_m2k', label: 'Convection coefficient', unit: 'W/m²K' },
        { name: 'area_m2', label: 'Fin area', unit: 'm²' },
        { name: 'delta_t_k', label: 'Temperature difference', unit: 'K' }
      ],
      features: ['h_w_m2k', 'area_m2', 'delta_t_k'],
      keyInputs: 'convection coefficient, fin area, temperature difference',
      trendText: 'Heat dissipation generally increases when the convection coefficient, fin area or temperature difference increases.',
      trends: [
        { feature: 'h_w_m2k', label: 'convection coefficient', direction: 'increase' },
        { feature: 'area_m2', label: 'fin area', direction: 'increase' },
        { feature: 'delta_t_k', label: 'temperature difference', direction: 'increase' }
      ],
      rangeText: 'The dataset has 500 rows. Heat dissipation ranges from a few watts to roughly 20 kW across the sampled synthetic conditions.',
      disclaimer: 'This is a <strong>synthetic demonstration dataset</strong>, generated from Newton’s law of cooling with a fixed random seed and a small amount of added noise. It is not experimental, validated or safety-grade data, and must not be used for real design.',
      schematic: false,
      approxRows: 500
    },
    {
      key: 'steel',
      file: './examples/steel_tensile_strength_sample.csv',
      engineering: true,
      title: 'Predict steel yield strength',
      short: 'Steel yield strength',
      target: 'yield_strength_mpa',
      targetLabel: 'yield strength',
      unit: 'MPa',
      intro: 'Structural engineers need to understand how steel composition, grain size and processing conditions affect yield strength. This synthetic example explores how these factors relate to yielding, but it is not suitable for material selection or structural design.',
      inputs: [
        { name: 'carbon_wt_pct', label: 'Carbon content', unit: 'wt%' },
        { name: 'manganese_wt_pct', label: 'Manganese content', unit: 'wt%' },
        { name: 'silicon_wt_pct', label: 'Silicon content', unit: 'wt%' },
        { name: 'grain_size_um', label: 'Grain size', unit: 'µm' },
        { name: 'tempering_temperature_c', label: 'Tempering temperature', unit: '°C' },
        { name: 'test_temperature_c', label: 'Test temperature', unit: '°C' }
      ],
      features: ['carbon_wt_pct', 'manganese_wt_pct', 'silicon_wt_pct', 'grain_size_um', 'tempering_temperature_c', 'test_temperature_c'],
      keyInputs: 'carbon content, manganese content, silicon content, grain size, tempering temperature, test temperature',
      trendText: 'Yield strength generally increases with carbon, manganese and silicon content, and decreases as grain size, tempering temperature or test temperature increases, according to this dataset’s simplified model.',
      trends: [
        { feature: 'carbon_wt_pct', label: 'carbon content', direction: 'increase' },
        { feature: 'manganese_wt_pct', label: 'manganese content', direction: 'increase' },
        { feature: 'silicon_wt_pct', label: 'silicon content', direction: 'increase' },
        { feature: 'grain_size_um', label: 'grain size', direction: 'decrease' },
        { feature: 'tempering_temperature_c', label: 'tempering temperature', direction: 'decrease' },
        { feature: 'test_temperature_c', label: 'test temperature', direction: 'decrease' }
      ],
      rangeText: 'The dataset has 500 rows. Inputs cover carbon 0.02–0.12 wt%, manganese 0.30–1.60 wt%, silicon 0.05–0.50 wt%, grain size 5–50 µm, tempering temperature 200–650 °C and test temperature −20–100 °C. Yield strength is expressed in MPa.',
      disclaimer: 'This is a <strong>synthetic demonstration dataset</strong>, generated from a simplified Hall–Petch and solid-solution strengthening relationship, with simplified temperature effects and added noise. It is not experimental, validated or safety-grade data, and predictions must not be used for real material selection, structural design or safety-critical qualification.',
      schematic: false,
      approxRows: 500
    },
    {
      key: 'orifice',
      file: './examples/orifice_flow_sample.csv',
      engineering: true,
      title: 'Predict flow rate through an orifice',
      short: 'Orifice flow rate',
      target: 'flow_rate_m3_s',
      targetLabel: 'flow rate',
      unit: 'm³/s',
      intro: 'Flow through an orifice can be estimated from the pressure difference, orifice diameter, fluid density and discharge coefficient. Here we predict flow rate from these synthetic flow-measurement inputs.',
      inputs: [
        { name: 'pressure_difference_pa', label: 'Pressure difference', unit: 'Pa' },
        { name: 'orifice_diameter_m', label: 'Orifice diameter', unit: 'm' },
        { name: 'fluid_density_kg_m3', label: 'Fluid density', unit: 'kg/m³' },
        { name: 'discharge_coefficient', label: 'Discharge coefficient', unit: '' }
      ],
      features: [
        'pressure_difference_pa',
        'orifice_diameter_m',
        'fluid_density_kg_m3',
        'discharge_coefficient'
      ],
      keyInputs: 'pressure difference, orifice diameter, fluid density, discharge coefficient',
      trendText: 'Flow rate generally increases when pressure difference, orifice diameter or discharge coefficient increases, and decreases when fluid density increases.',
      trends: [
        { feature: 'pressure_difference_pa', label: 'pressure difference', direction: 'increase' },
        { feature: 'orifice_diameter_m', label: 'orifice diameter', direction: 'increase' },
        { feature: 'fluid_density_kg_m3', label: 'fluid density', direction: 'decrease' },
        { feature: 'discharge_coefficient', label: 'discharge coefficient', direction: 'increase' }
      ],
      rangeText: 'The dataset has 500 rows of synthetic orifice-flow conditions. Flow rate is expressed in m³/s across the demonstrated pressure, diameter, density and discharge-coefficient ranges.',
      disclaimer: 'This is a <strong>synthetic demonstration dataset</strong>, generated from a simplified orifice-flow relationship with a fixed random seed and a small amount of added noise. The discharge coefficient is an effective synthetic parameter for this dataset. It is not experimental, validated or safety-grade data, and must not be used for real flow-system design.',
      schematic: false,
      approxRows: 500
    },
    {
      key: 'nonlinear',
      file: './examples/nonlinear_regression_sample.csv',
      engineering: false,
      title: 'Explore a generic nonlinear relationship',
      short: 'Generic nonlinear signal',
      target: 'target',
      targetLabel: 'target',
      unit: '',
      intro: 'This is a purely mathematical dataset in which the target varies non-linearly with a ' +
        'few input variables. It is <strong>not an engineering dataset</strong>. It is included only to ' +
        'show clearly why a simple linear model struggles with curved relationships, and why a more ' +
        'flexible model can do better.',
      inputs: [
        { name: 'x1', label: 'Input x1', unit: '' },
        { name: 'x2', label: 'Input x2', unit: '' },
        { name: 'time', label: 'Time index', unit: '' },
        { name: 'source', label: 'Source group', unit: '' },
        { name: 'regime', label: 'Regime label', unit: '' }
      ],
      features: ['time', 'x1', 'x2', 'source', 'regime'],
      keyInputs: 'x1, x2, time, source, regime',
      trendText: '',
      trends: [],
      rangeText: 'A synthetic mathematical dataset of a few hundred rows spanning two continuous inputs.',
      disclaimer: 'This is a <strong>mathematical demonstration</strong>, not an engineering dataset. Use it to ' +
        'understand model behaviour, not to draw any engineering conclusion.',
      schematic: false,
      approxRows: 360
    }
  ];

  var MODEL_LABELS = { linear: 'Linear Regression', tree: 'Decision Tree', forest: 'Random Forest', ann: 'Neural Network' };

  // Approaches are the beginner-facing choice; model names are the secondary detail.
  // The neural network is offered as an *advanced* flexible option, never the default.
  var APPROACHES = {
    simple:   { models: ['linear'] },
    flexible: { models: ['forest'] },
    advanced: { models: ['ann'] },
    compare:  { models: ['linear', 'tree', 'forest', 'ann'] }
  };
  var COMPARE_ORDER = ['linear', 'tree', 'forest', 'ann'];

  // Neural-network Explore presets. Explore exposes safe presets, not free architecture
  // editing (full configuration lives in Project mode). Every value is documented in
  // docs/NEURAL_NETWORK_DEMO.md. The underlying model is the inherited browser network
  // in js/advanced-core.js, reached through the standard model adapter.
  var ANN_ARCH_PRESETS = {
    // Small: one hidden layer of 16 units — conceptually (16,).
    small:  { hidden1: 16, hidden2: 0,  label: 'Small network (one hidden layer, 16 neurons)' },
    // Medium: two hidden layers, 32 then 16 — conceptually (32, 16).
    medium: { hidden1: 32, hidden2: 16, label: 'Medium network (two hidden layers, 32 → 16 neurons)' }
  };
  // Training length maps to a documented maximum number of epochs (early stopping may end sooner).
  var ANN_TRAINING_PRESETS = { quick: 150, standard: 300, longer: 600 };
  // Fixed, safe defaults for everything Explore does not expose.
  var ANN_SAFE_DEFAULTS = {
    activation: 'relu', optimizer: 'adam', batchSize: 32,
    l2: 0.0005, dropout: 0, patience: 25, minDelta: 1e-5,
    earlyStopping: true, ensembleSize: 1
  };
  var ANN_LR_DEFAULT = 0.01; // higher than Project's 0.001 default because Explore caps epochs for speed

  // Deterministic, sensible defaults shared with Project mode.
  var PREPROCESS = {
    numericScaling: 'standard', numericMissing: 'mean',
    categoricalEncoding: 'onehot', categoricalMissing: 'mode',
    dropFirstCategory: false, maxCategories: 50
  };
  var SEED = 42;
  var SPLIT = { seed: SEED, percentages: { training: 70, validation: 15, test: 15 } };

  var state = {
    wired: false,
    exampleKey: EXAMPLES[0].key,
    dataset: null,       // { key, rows, headers, profiles, target, features }
    approach: 'simple',
    focusModel: 'linear',// the model currently shown in the plot / interpretation
    stage: 1,
    results: {},         // modelType -> pipeline result
    busy: false
  };

  function el(id) { return document.getElementById(id); }

  function globalsReady() {
    return !!(global.MLCore && global.LRSPlatform && global.CSVEngine);
  }

  function fmt(x) {
    if (x == null || !isFinite(x)) return '—';
    var a = Math.abs(x);
    if (a >= 100) return x.toFixed(1);
    if (a >= 1) return x.toFixed(2);
    return x.toFixed(4);
  }
  function fmtR2(x) { return (x == null || !isFinite(x)) ? '—' : x.toFixed(3); }
  function pct(x) { return (x == null || !isFinite(x)) ? '—' : Math.round(x * 100) + '%'; }
  // Format a value with the current example's physical unit, when it has one.
  function fmtU(x) {
    var u = currentUnit();
    return u ? (fmt(x) + ' ' + u) : fmt(x);
  }
  function currentUnit() {
    var ex = exampleByKey(state.exampleKey);
    return ex && ex.unit ? ex.unit : '';
  }
  function escapeHtml(v) {
    return String(v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function exampleByKey(key) {
    for (var i = 0; i < EXAMPLES.length; i++) if (EXAMPLES[i].key === key) return EXAMPLES[i];
    return EXAMPLES[0];
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  // --- Stage 1: understand the problem ------------------------------------------
  // Lightweight inline SVG schematic — no external assets, no network.
  var PIPE_SCHEMATIC =
    '<svg class="explore-schematic" viewBox="0 0 320 96" role="img" ' +
        'aria-label="A fluid flowing left to right through a horizontal pipe of length L and diameter D, ' +
        'with higher pressure at the inlet than the outlet.">' +
      '<rect x="20" y="34" width="280" height="28" rx="3" fill="#e7f4f7" stroke="#125f76" stroke-width="2"></rect>' +
      '<line x1="20" y1="48" x2="292" y2="48" stroke="#125f76" stroke-width="2" stroke-dasharray="6 6"></line>' +
      '<polygon points="292,42 304,48 292,54" fill="#125f76"></polygon>' +
      '<text x="150" y="26" text-anchor="middle" font-size="12" fill="#16202a">flow velocity v &#8594;</text>' +
      '<text x="150" y="84" text-anchor="middle" font-size="12" fill="#16202a">length L</text>' +
      '<text x="9" y="52" text-anchor="middle" font-size="12" fill="#16202a">D</text>' +
      '<text x="40" y="52" font-size="11" fill="#a52b2b">high p</text>' +
      '<text x="252" y="52" font-size="11" fill="#a52b2b">low p</text>' +
    '</svg>';

  function renderProblem() {
    var host = el('exploreProblem');
    if (!host) return;
    var ex = exampleByKey(state.exampleKey);

    var inputRows = ex.inputs.map(function (inp) {
      return '<li><strong>' + escapeHtml(inp.label) + '</strong>' +
        (inp.unit ? ' <span class="explore-unit">(' + escapeHtml(inp.unit) + ')</span>' : '') + '</li>';
    }).join('');

    var trendBlock = ex.trendText
      ? '<div class="info-box compact-box"><strong>Expected trend:</strong> ' + escapeHtml(ex.trendText) + '</div>'
      : '';

    var schematic = ex.schematic ? '<div class="explore-schematic-wrap">' + PIPE_SCHEMATIC + '</div>' : '';

    host.innerHTML =
      '<p class="explore-problem-intro">' + ex.intro + '</p>' +
      schematic +
      '<div class="explore-problem-grid">' +
        '<div class="explore-problem-card">' +
          '<h3>Inputs</h3><ul class="explore-input-list">' + inputRows + '</ul>' +
        '</div>' +
        '<div class="explore-problem-card">' +
          '<h3>What we predict</h3>' +
          '<p class="explore-target">' + escapeHtml(cap(ex.targetLabel)) +
            (ex.unit ? ' <span class="explore-unit">(' + escapeHtml(ex.unit) + ')</span>' : '') + '</p>' +
          '<p class="fine-print">' + escapeHtml(ex.rangeText) + '</p>' +
        '</div>' +
      '</div>' +
      trendBlock +
      '<div class="warning-box explore-disclaimer">' + ex.disclaimer + '</div>';

    renderExampleSwitch();
  }

  // A clearly-secondary switch so the pipe problem stays the default focus.
  function renderExampleSwitch() {
    var host = el('exploreExampleSwitch');
    if (!host) return;
    host.innerHTML = EXAMPLES.map(function (ex) {
      var checked = ex.key === state.exampleKey ? ' checked' : '';
      var tag = ex.engineering ? 'Engineering example' : 'Maths demonstration';
      return '<label class="explore-switch-option">' +
        '<input type="radio" name="exploreExample" value="' + ex.key + '"' + checked + '>' +
        '<span><strong>' + escapeHtml(ex.short) + '</strong>' +
        '<small>' + tag + '</small></span></label>';
    }).join('');
    host.querySelectorAll('input[name="exploreExample"]').forEach(function (input) {
      input.addEventListener('change', function () { selectExample(input.value); });
    });
  }

  function selectExample(key) {
    if (state.exampleKey !== key) {
      state.exampleKey = key;
      state.dataset = null;
      resetResults();
      renderProblem();
    }
    // Preload in the background so training feels instant; ignore failures here.
    loadDataset(key).catch(function () {});
  }

  function loadDataset(key) {
    var ex = exampleByKey(key);
    if (state.dataset && state.dataset.key === key) return Promise.resolve(state.dataset);
    if (!globalsReady()) return Promise.reject(new Error('The application is still loading. Please try again in a moment.'));
    return fetch(ex.file).then(function (response) {
      if (!response.ok) throw new Error('Could not load the example dataset (' + response.status + ').');
      return response.text();
    }).then(function (text) {
      var parsed = global.CSVEngine.parse(text, { header: true, skipEmptyLines: true });
      var rows = (parsed.data || []).filter(function (row) {
        return row && Object.keys(row).some(function (k) { return String(row[k] == null ? '' : row[k]).trim() !== ''; });
      });
      var headers = (parsed.meta && parsed.meta.fields) ? parsed.meta.fields : (rows[0] ? Object.keys(rows[0]) : []);
      var features = ex.features.filter(function (f) { return headers.indexOf(f) !== -1; });
      var dataset = {
        key: key, rows: rows, headers: headers,
        // The raw CSV text is retained so "Continue in Project mode" can hand the very
        // same file to Project mode without a second fetch (see continueInProject).
        text: text, fileName: ex.file.split('/').pop(),
        profiles: global.MLCore.inferColumns(rows, headers),
        target: ex.target, features: features
      };
      state.dataset = dataset;
      return dataset;
    });
  }

  // --- Stage 2: choose an approach ----------------------------------------------
  function selectedApproach() {
    var checked = document.querySelector('input[name="exploreApproach"]:checked');
    return checked ? checked.value : 'simple';
  }

  function modelsForApproach(approach) {
    return (APPROACHES[approach] || APPROACHES.simple).models.slice();
  }

  function updateApproachControls() {
    state.approach = selectedApproach();
    // Tree/forest controls are only relevant when a flexible tree-based model is involved.
    var usesTrees = state.approach === 'flexible' || state.approach === 'compare';
    // Neural-network preset controls appear for the advanced approach (and in compare).
    var usesAnn = state.approach === 'advanced' || state.approach === 'compare';
    var depth = el('exploreDepthField');
    var trees = el('exploreTreesField');
    if (depth) depth.classList.toggle('is-hidden', !usesTrees);
    if (trees) trees.classList.toggle('is-hidden', !usesTrees);
    var annControls = el('exploreAnnControls');
    if (annControls) annControls.classList.toggle('is-hidden', !usesAnn);
    var controls = el('exploreControls');
    if (controls) controls.classList.toggle('is-hidden', !usesTrees && !usesAnn);
  }

  // Read the selected neural-network preset values (with safe fallbacks).
  function selectedAnnPreset() {
    var arch = document.querySelector('input[name="exploreAnnArch"]:checked');
    var archKey = arch && ANN_ARCH_PRESETS[arch.value] ? arch.value : 'small';
    var lengthSel = el('exploreAnnTraining');
    var lengthKey = lengthSel && ANN_TRAINING_PRESETS[lengthSel.value] ? lengthSel.value : 'standard';
    return { archKey: archKey, lengthKey: lengthKey };
  }

  function clampInt(value, min, max, fallback) {
    var n = Math.round(Number(value));
    if (!isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function paramsFor(modelType) {
    if (modelType === 'tree') {
      return { maxDepth: clampInt(el('exploreMaxDepth') && el('exploreMaxDepth').value, 2, 15, 8), minLeaf: 5, maxThresholds: 24, maxFeatures: 'all' };
    }
    if (modelType === 'forest') {
      return {
        nTrees: clampInt(el('exploreNTrees') && el('exploreNTrees').value, 10, 120, 40),
        maxDepth: clampInt(el('exploreMaxDepth') && el('exploreMaxDepth').value, 2, 15, 8),
        minLeaf: 5, sampleRate: 0.8, maxThresholds: 20, maxFeatures: 'sqrt', maxRowsPerTree: 20000
      };
    }
    if (modelType === 'ann') {
      var preset = selectedAnnPreset();
      var arch = ANN_ARCH_PRESETS[preset.archKey];
      var lr = ANN_LR_DEFAULT;
      var lrField = el('exploreAnnLearningRate');
      if (lrField && lrField.value !== '' && isFinite(Number(lrField.value))) {
        lr = Math.max(0.0001, Math.min(0.5, Number(lrField.value)));
      }
      return Object.assign({}, ANN_SAFE_DEFAULTS, {
        hidden1: arch.hidden1, hidden2: arch.hidden2, hidden3: 0,
        epochs: ANN_TRAINING_PRESETS[preset.lengthKey],
        learningRate: lr,
        // Record which presets produced this run, for the interpretation text.
        _archKey: preset.archKey, _lengthKey: preset.lengthKey
      });
    }
    return {}; // linear
  }

  // --- Stage 3: the shared training pipeline (reuses MLCore + LRSPlatform) --------
  function runPipeline(dataset, modelType, params) {
    var ML = global.MLCore;
    var split = ML.splitRows(dataset.rows, dataset.target, SPLIT);
    var rawTrain = split.training.map(function (e) { return e.row; });
    var rawValidation = (split.validation || []).map(function (e) { return e.row; });
    var rawTest = split.test.map(function (e) { return e.row; });
    var pre = ML.fitPreprocessor(rawTrain, dataset.features, PREPROCESS, dataset.profiles);
    if (!pre.outputNames.length) throw new Error('No usable features remain for this example.');
    var tTrain = ML.transformRows(rawTrain, pre, dataset.target, true);
    var tTest = ML.transformRows(rawTest, pre, dataset.target, true);
    var tt = ML.fitTargetTransform(tTrain.y, 'none');
    var yTrain = ML.applyTargetTransform(tTrain.y, tt);

    // The neural network benefits from a real validation set for honest early stopping.
    // Other models ignore these fields, so this stays a contained, model-specific addition.
    var fitParams = params;
    if (modelType === 'ann' && rawValidation.length) {
      var tVal = ML.transformRows(rawValidation, pre, dataset.target, true);
      fitParams = Object.assign({}, params, {
        _validationX: tVal.X,
        _validationY: ML.applyTargetTransform(tVal.y, tt)
      });
    }

    var adapter = global.LRSPlatform.getModelAdapter(modelType);
    var startedAt = (global.performance && global.performance.now) ? global.performance.now() : null;
    return Promise.resolve(adapter.fit(tTrain.X, yTrain, fitParams, SEED)).then(function (model) {
      var trainingMs = (startedAt != null && global.performance && global.performance.now)
        ? (global.performance.now() - startedAt) : null;
      ML.fitSmearing(tt, yTrain, adapter.predict(model, tTrain.X));
      var predTrain = ML.inverseTargetTransform(adapter.predict(model, tTrain.X), tt, true);
      var predTest = ML.inverseTargetTransform(adapter.predict(model, tTest.X), tt, true);
      return {
        trainMetrics: ML.metrics(tTrain.y, predTrain),
        testMetrics: ML.metrics(tTest.y, predTest),
        actual: tTest.y.slice(),
        predicted: predTest.slice(),
        params: params,
        counts: { training: tTrain.y.length, validation: rawValidation.length, test: tTest.y.length },
        // Iterative-training diagnostics (neural network / other iterative models).
        training: summariseTraining(model, params, trainingMs),
        // Kept for the deterministic engineering checks in stage 4.
        model: model, adapter: adapter, pre: pre, tt: tt,
        rawTrain: rawTrain, features: dataset.features, target: dataset.target
      };
    });
  }

  // Extract a compact, honest training summary from an iterative model (e.g. the ANN).
  // Returns null for non-iterative models so callers can simply test for its presence.
  function summariseTraining(model, params, trainingMs) {
    var history = model && model.trainingHistory;
    if (!history || !history.length || !isFinite(Number(history[0].epoch))) return null;
    var maxEpochs = Number((params && params.epochs)) || history[history.length - 1].epoch;
    var ranEpochs = history[history.length - 1].epoch;
    var bestEpoch = Number(model.bestEpoch) || ranEpochs;
    return {
      history: history.map(function (h) {
        return { epoch: h.epoch, trainLoss: h.trainLoss, validationLoss: h.validationLoss };
      }),
      maxEpochs: maxEpochs,
      ranEpochs: ranEpochs,
      bestEpoch: bestEpoch,
      // Early stopping fired if training halted before the configured maximum.
      earlyStopped: ranEpochs < maxEpochs,
      finalTrainLoss: history[history.length - 1].trainLoss,
      finalValidationLoss: history[history.length - 1].validationLoss,
      trainingMs: trainingMs
    };
  }

  function setBusy(busy, message) {
    state.busy = busy;
    var status = el('exploreTrainStatus');
    if (status) {
      status.classList.toggle('is-hidden', !busy && !message);
      status.textContent = message || '';
    }
    var b = el('exploreTrainBtn'); if (b) b.disabled = busy;
  }

  function bestModel(types) {
    var best = null, bestR2 = -Infinity;
    types.forEach(function (t) {
      var r = state.results[t];
      if (r && isFinite(r.testMetrics.r2) && r.testMetrics.r2 > bestR2) { bestR2 = r.testMetrics.r2; best = t; }
    });
    return best || types[0];
  }

  function train() {
    if (state.busy) return Promise.resolve();
    updateApproachControls();
    var types = modelsForApproach(state.approach);
    setBusy(true, 'Training locally…');
    return loadDataset(state.exampleKey).then(function (dataset) {
      state.results = {};
      // Sequential to keep the UI responsive and results deterministic.
      return types.reduce(function (chain, modelType) {
        return chain.then(function () {
          return runPipeline(dataset, modelType, paramsFor(modelType)).then(function (res) {
            state.results[modelType] = res;
          });
        });
      }, Promise.resolve());
    }).then(function () {
      setBusy(false, '');
      state.focusModel = bestModel(types);
      renderComparison();
      renderFocusSelector();
      renderPlot(state.focusModel);
      renderLossCurve(state.focusModel);
      renderInterpretation(state.focusModel);
      renderEngineering(state.focusModel);
      var next = el('exploreToStage4');
      if (next) next.disabled = false;
    }).catch(function (error) {
      setBusy(false, '');
      var status = el('exploreTrainStatus');
      if (status) { status.classList.remove('is-hidden'); status.textContent = error.message || 'Training failed.'; }
    });
  }

  function trainedTypes() {
    return COMPARE_ORDER.filter(function (k) { return state.results[k]; });
  }

  function renderComparison() {
    var table = el('exploreComparison');
    var wrap = el('exploreComparisonWrap');
    if (!table) return;
    var trained = trainedTypes();
    if (!trained.length) { if (wrap) wrap.classList.add('is-hidden'); return; }
    var unitSuffix = currentUnit() ? ' (' + currentUnit() + ')' : '';
    var body = trained.map(function (k) {
      var r = state.results[k];
      var sel = k === state.focusModel ? ' class="is-selected"' : '';
      return '<tr' + sel + '><td>' + MODEL_LABELS[k] + '</td>' +
        '<td>' + fmt(r.testMetrics.rmse) + '</td>' +
        '<td>' + fmtR2(r.testMetrics.r2) + '</td>' +
        '<td>' + fmt(r.trainMetrics.rmse) + '</td></tr>';
    }).join('');
    table.innerHTML = '<thead><tr><th>Approach</th><th>Test RMSE' + unitSuffix + '</th>' +
      '<th>Test R²</th><th>Training RMSE' + unitSuffix + '</th></tr></thead><tbody>' + body + '</tbody>';
    if (wrap) wrap.classList.remove('is-hidden');
  }

  // When comparing, let the user pick which approach's plot/explanation to view.
  function renderFocusSelector() {
    var wrap = el('exploreFocusWrap');
    var sel = el('exploreFocusModel');
    if (!wrap || !sel) return;
    var trained = trainedTypes();
    if (trained.length < 2) { wrap.classList.add('is-hidden'); return; }
    sel.innerHTML = trained.map(function (k) {
      var s = k === state.focusModel ? ' selected' : '';
      return '<option value="' + k + '"' + s + '>' + MODEL_LABELS[k] + '</option>';
    }).join('');
    wrap.classList.remove('is-hidden');
  }

  function renderPlot(modelType) {
    var res = state.results[modelType];
    var card = el('explorePlotCard');
    if (!res || !global.Plotly) { if (card) card.classList.add('is-hidden'); return; }
    if (card) card.classList.remove('is-hidden');
    var ex = exampleByKey(state.exampleKey);
    var unit = currentUnit();
    var label = ex.targetLabel + (unit ? ' (' + unit + ')' : '');
    var all = res.actual.concat(res.predicted).filter(function (v) { return isFinite(v); });
    var min = Math.min.apply(null, all), max = Math.max.apply(null, all);
    if (!isFinite(min) || !isFinite(max) || min === max) { min = min - 1; max = max + 1; }
    var traces = [
      { x: res.actual, y: res.predicted, mode: 'markers', type: 'scatter', name: 'Test rows',
        marker: { color: '#125f76', size: 8, opacity: 0.75 },
        hovertemplate: 'Actual %{x}<br>Predicted %{y}<extra></extra>' },
      { x: [min, max], y: [min, max], mode: 'lines', type: 'scatter', name: 'Perfect prediction',
        line: { dash: 'dash', color: '#a52b2b' }, hoverinfo: 'skip' }
    ];
    var layout = {
      title: { text: MODEL_LABELS[modelType] + ': actual vs predicted (test data)', font: { size: 15 } },
      xaxis: { title: { text: 'Actual ' + label }, automargin: true },
      yaxis: { title: { text: 'Predicted ' + label }, automargin: true },
      margin: { l: 60, r: 20, t: 50, b: 55 }, legend: { orientation: 'h', y: -0.22 },
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', hovermode: 'closest'
    };
    global.Plotly.react('explorePlot', traces, layout, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] });
  }

  // Advanced diagnostic: the neural-network training (loss) curve. This is deliberately
  // secondary to the main result — it lives in a collapsed card and only appears for the ANN.
  // The curve is never fabricated: it is drawn only from the model's recorded trainingHistory.
  function renderLossCurve(modelType) {
    var card = el('exploreLossCard');
    if (!card) return;
    var res = state.results[modelType];
    var t = res && res.training;
    if (modelType !== 'ann' || !t || !t.history || !t.history.length || !global.Plotly) {
      card.classList.add('is-hidden');
      return;
    }
    card.classList.remove('is-hidden');
    var epochs = t.history.map(function (h) { return h.epoch; });
    var traces = [
      { x: epochs, y: t.history.map(function (h) { return h.trainLoss; }),
        mode: 'lines', type: 'scatter', name: 'Training loss', line: { color: '#125f76' } }
    ];
    var hasVal = t.history.some(function (h) { return isFinite(h.validationLoss); });
    if (hasVal) {
      traces.push({ x: epochs, y: t.history.map(function (h) { return h.validationLoss; }),
        mode: 'lines', type: 'scatter', name: 'Validation loss', line: { color: '#a52b2b', dash: 'dot' } });
    }
    var layout = {
      title: { text: 'Training loss per epoch', font: { size: 15 } },
      xaxis: { title: { text: 'Epoch' }, automargin: true },
      yaxis: { title: { text: 'Loss (scaled units)' }, automargin: true, rangemode: 'tozero' },
      margin: { l: 60, r: 20, t: 50, b: 55 }, legend: { orientation: 'h', y: -0.25 },
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', hovermode: 'closest'
    };
    global.Plotly.react('exploreLossPlot', traces, layout, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] });
    var note = el('exploreLossNote');
    if (note) {
      note.textContent = t.earlyStopped
        ? ('Training stopped early at epoch ' + t.bestEpoch + ' of a maximum of ' + t.maxEpochs +
           ' because the validation loss stopped improving. A falling curve that flattens out is the sign of convergence.')
        : ('Training ran for the full ' + t.maxEpochs + ' epochs. If the curve is still falling at the right-hand edge, a longer training length may help; if it has flattened, the network has effectively converged.');
    }
  }

  // --- Stage 4: deterministic, rule-based interpretation -------------------------
  function r2Quality(r2) {
    if (!isFinite(r2)) return 'could not be computed';
    if (r2 < 0) return 'worse than simply predicting the average';
    if (r2 < 0.25) return 'very weak';
    if (r2 < 0.5) return 'weak';
    if (r2 < 0.75) return 'moderate';
    if (r2 < 0.9) return 'good';
    return 'strong';
  }

  function overfitVerdict(trainRmse, testRmse) {
    if (!isFinite(trainRmse) || !isFinite(testRmse)) return null;
    if (trainRmse <= 1e-9) {
      return testRmse > 1e-6
        ? { level: 'high', text: 'The model is almost perfect on training data but has real error on test data. That is a classic sign of overfitting.' }
        : { level: 'low', text: 'Training and test errors are both essentially zero for this simple example.' };
    }
    var ratio = testRmse / trainRmse;
    if (ratio > 1.5) return { level: 'high', text: 'Test error is much larger than training error (about ' + ratio.toFixed(1) + '×). This suggests overfitting: the model has partly memorised the training data, so a low training error alone is not enough — the test error is what matters.' };
    if (ratio > 1.2) return { level: 'medium', text: 'Test error is somewhat larger than training error (about ' + ratio.toFixed(1) + '×). There may be mild overfitting, so judge the model by its test error, not its training error.' };
    return { level: 'low', text: 'Training and test errors are similar, which suggests the model generalises reasonably to unseen rows. Note that a low training error on its own is never enough — the test error is what shows real performance.' };
  }

  function renderInterpretation(modelType) {
    var host = el('exploreInterpretation');
    if (!host) return;
    var res = state.results[modelType];
    if (!res) { host.innerHTML = '<p class="fine-print">Train a model to see an explanation of the results.</p>'; return; }
    var ex = exampleByKey(state.exampleKey);
    var target = ex.targetLabel;
    var unit = currentUnit();
    var testR2 = res.testMetrics.r2, testRmse = res.testMetrics.rmse, trainRmse = res.trainMetrics.rmse;
    var of = overfitVerdict(trainRmse, testRmse);
    var cards = [];

    cards.push({
      title: 'Which approach is this? (' + MODEL_LABELS[modelType] + ')',
      body: modelExplanation(modelType)
    });

    cards.push({
      title: 'How good is the fit? (R² = ' + fmtR2(testR2) + ')',
      body: 'R² measures how much of the variation in ' + escapeHtml(target) + ' the model explains on test data. ' +
        (isFinite(testR2) && testR2 >= 0 ? ('Here it explains about ' + pct(testR2) + ', which is a ' + r2Quality(testR2) + ' fit.')
          : ('Here the fit is ' + r2Quality(testR2) + '.')) +
        ' A value of 1 is perfect; 0 means no better than predicting the average.'
    });

    cards.push({
      title: 'How large are the errors? (Test RMSE ≈ ' + fmtU(testRmse) + ')',
      body: 'RMSE is the typical size of the prediction error, in the units of ' + escapeHtml(target) +
        (unit ? ' (' + escapeHtml(unit) + ')' : '') + '. ' +
        'On average, predictions on the ' + res.counts.test + ' test rows are off by about ' + fmtU(testRmse) + '. ' +
        'For comparison, the training error was about ' + fmtU(trainRmse) + '.'
    });

    if (of) {
      cards.push({ title: 'Is it overfitting?', body: of.text, level: of.level });
    }

    if (modelType === 'ann') {
      annInterpretationCards(res).forEach(function (c) { cards.push(c); });
    }

    cards.push({
      title: 'Reading the actual-vs-predicted plot',
      body: 'Each point is one test row. The horizontal axis is the true ' + escapeHtml(target) +
        (unit ? ' in ' + escapeHtml(unit) : '') + ' and the vertical axis is the model\'s prediction. ' +
        'Points on the dashed diagonal are perfect predictions; points far above or below the line are larger errors. ' +
        'A tight cloud along the diagonal means accurate predictions.'
    });

    host.innerHTML = cards.map(function (c) {
      var cls = 'explore-insight' + (c.level ? ' level-' + c.level : '');
      return '<div class="' + cls + '"><h3>' + c.title + '</h3><p>' + c.body + '</p></div>';
    }).join('');
  }

  // Deterministic, rule-based interpretation specific to the neural network (Stage 4).
  // No external service is used; every statement is derived from the measured numbers.
  function annInterpretationCards(res) {
    var cards = [];
    var t = res.training;
    var preset = res.params || {};
    var archLabel = (ANN_ARCH_PRESETS[preset._archKey] || {}).label || 'the selected architecture';

    // Convergence / training-length feedback.
    if (t) {
      var convBody, convLevel = null;
      if (t.earlyStopped) {
        convBody = 'Training stopped early at epoch ' + t.bestEpoch + ' of a maximum of ' + t.maxEpochs +
          ' because the validation loss stopped improving. That is the expected, healthy outcome: the network ' +
          'settled rather than training needlessly.';
      } else {
        convBody = 'Training ran for the full ' + t.maxEpochs + ' epochs without early stopping. If the validation ' +
          'loss was still falling at the end, a longer training length may help a little; if it had flattened, the ' +
          'network has effectively converged.';
        convLevel = 'medium';
      }
      if (isFinite(t.trainingMs)) {
        convBody += ' Training took about ' + (t.trainingMs / 1000).toFixed(1) + ' s in your browser (' +
          archLabel.toLowerCase() + ').';
      }
      cards.push({ title: 'Did the neural network converge?', body: convBody, level: convLevel });
    }

    // Did it improve on the simple trend? (Only when Linear Regression was also trained.)
    var linear = state.results.linear;
    if (linear && isFinite(linear.testMetrics.r2) && isFinite(res.testMetrics.r2)) {
      var dR2 = res.testMetrics.r2 - linear.testMetrics.r2;
      var better = dR2 > 0.02, worse = dR2 < -0.02;
      cards.push({
        title: 'Did it beat the simple trend?',
        body: better
          ? ('On test data the neural network explains more of the variation than Linear Regression (test R² ' +
             fmtR2(res.testMetrics.r2) + ' vs ' + fmtR2(linear.testMetrics.r2) + '), so it is capturing nonlinear ' +
             'behaviour the straight-line model cannot.')
          : (worse
             ? ('On test data the neural network does <strong>not</strong> beat Linear Regression (test R² ' +
                fmtR2(res.testMetrics.r2) + ' vs ' + fmtR2(linear.testMetrics.r2) + '). A more complex model is not ' +
                'automatically better — here the extra flexibility did not pay off.')
             : ('The neural network performs about the same as Linear Regression on test data (test R² ' +
                fmtR2(res.testMetrics.r2) + ' vs ' + fmtR2(linear.testMetrics.r2) + '), so the added complexity ' +
                'brought little benefit here.')),
        level: worse ? 'medium' : null
      });
    }

    // Was the extra complexity worthwhile versus the tree ensemble? (Only when Forest was trained.)
    var forest = state.results.forest;
    if (forest && isFinite(forest.testMetrics.r2) && isFinite(res.testMetrics.r2)) {
      var vsForest = res.testMetrics.r2 - forest.testMetrics.r2;
      cards.push({
        title: 'Is the neural network better than the tree ensemble?',
        level: 'medium',
        body: (vsForest > 0.02
          ? 'Here the neural network edges ahead of the Random Forest on test data'
          : (vsForest < -0.02
            ? 'Here the Random Forest actually does better than the neural network on test data'
            : 'Here the neural network and the Random Forest perform about the same on test data')) +
          ' (test R² ' + fmtR2(res.testMetrics.r2) + ' vs ' + fmtR2(forest.testMetrics.r2) + '). ' +
          'On small tabular engineering datasets like this one, well-tuned tree-based methods are often as good as, ' +
          'or better than, a neural network. Good performance here does not establish that neural networks are ' +
          'superior in general.'
      });
    }

    // Fixed cautions that always apply.
    cards.push({
      title: 'What this result does — and does not — show',
      level: 'medium',
      body: 'This is one synthetic dataset with a fixed random seed. The numbers show what happened here; they do ' +
        'not prove one model is best in general. As with every model in this tool, predictions outside the ' +
        'demonstrated data range are extrapolation and can be unreliable, and physical validation and engineering ' +
        'judgement are still required — a neural network does not change that.'
    });
    return cards;
  }

  // Beginner-friendly, deterministic model descriptions (see docs/EXPLORE_MODE.md).
  function modelExplanation(modelType) {
    if (modelType === 'linear') {
      return 'Linear Regression learns a weighted relationship: each input is multiplied by a number and the ' +
        'results are added up. It is easy to interpret, but because it combines the inputs in a straight-line ' +
        'way it can struggle when the true relationship is curved.';
    }
    if (modelType === 'tree') {
      return 'A Decision Tree divides the input conditions into regions with a series of yes/no questions and ' +
        'predicts a value for each region. It can capture nonlinear behaviour, but a deep tree may overfit by ' +
        'memorising the training rows.';
    }
    if (modelType === 'forest') {
      return 'A Random Forest combines many decision trees and averages them, which makes it more stable than a ' +
        'single tree. It handles nonlinear relationships well, but it is less transparent than a straight-line ' +
        'model and it may extrapolate poorly beyond the range of the training data.';
    }
    if (modelType === 'ann') {
      return 'A Neural Network combines layers of simple mathematical units to learn complex nonlinear ' +
        'relationships. It can be powerful, but it normally needs scaled data, careful tuning and sufficient ' +
        'training data. It has more settings, trains more slowly, and can overfit more easily than the simpler ' +
        'models — and a more complex model is not automatically more accurate or more suitable for engineering use.';
    }
    return '';
  }

  // Predict the target for a set of raw feature rows using an already-fitted result.
  function predictRaw(res, rows) {
    var ML = global.MLCore;
    var t = ML.transformRows(rows, res.pre, null, false);
    var pred = res.adapter.predict(res.model, t.X);
    return ML.inverseTargetTransform(pred, res.tt, true);
  }

  // Build a baseline row from the median of each feature in the training data.
  function baselineRow(res) {
    var ML = global.MLCore;
    var row = {};
    res.features.forEach(function (f) {
      var nums = res.rawTrain.map(function (r) { return ML.toNumber(r[f]); }).filter(function (v) { return isFinite(v); });
      if (nums.length) row[f] = ML.median(nums);
      else {
        // Categorical: use the most common raw value.
        var counts = {};
        res.rawTrain.forEach(function (r) { var v = r[f]; if (v != null && v !== '') counts[v] = (counts[v] || 0) + 1; });
        var bestVal = '', bestN = -1;
        Object.keys(counts).forEach(function (k) { if (counts[k] > bestN) { bestN = counts[k]; bestVal = k; } });
        row[f] = bestVal;
      }
    });
    return row;
  }

  function featureQuantiles(res, feature) {
    var ML = global.MLCore;
    var nums = res.rawTrain.map(function (r) { return ML.toNumber(r[feature]); }).filter(function (v) { return isFinite(v); });
    if (!nums.length) return null;
    return { low: ML.quantile(nums, 0.1), high: ML.quantile(nums, 0.9) };
  }

  // Deterministic engineering checks: does the model reproduce the expected trends,
  // are its predictions physically plausible, and is it being used inside its range?
  function renderEngineering(modelType) {
    var host = el('exploreEngineering');
    if (!host) return;
    var ex = exampleByKey(state.exampleKey);
    var res = state.results[modelType];
    if (!res) { host.innerHTML = ''; return; }

    if (!ex.engineering || !ex.trends.length) {
      host.innerHTML = '<h3 class="explore-engineering-title">Engineering interpretation</h3>' +
        '<div class="explore-insight"><h3>Not an engineering dataset</h3>' +
        '<p>This example is a mathematical demonstration, so there are no physical trend checks. ' +
        'Switch to an engineering example to see engineering-specific interpretation.</p></div>';
      return;
    }

    var base = baselineRow(res);
    var cards = [];
    var trendItems = [];

    ex.trends.forEach(function (tr) {
      var q = featureQuantiles(res, tr.feature);
      if (!q) return;
      var lowRow = Object.assign({}, base); lowRow[tr.feature] = q.low;
      var highRow = Object.assign({}, base); highRow[tr.feature] = q.high;
      var preds = predictRaw(res, [lowRow, highRow]);
      var delta = preds[1] - preds[0];
      var observed = delta > 0 ? 'increase' : (delta < 0 ? 'decrease' : 'stay flat');
      var matches = observed === tr.direction;
      var verb = tr.direction === 'increase' ? 'increase' : 'decrease';
      trendItems.push('<li class="' + (matches ? 'trend-ok' : 'trend-warn') + '">' +
        'As <strong>' + escapeHtml(tr.label) + '</strong> increases, the predicted ' + escapeHtml(ex.targetLabel) +
        ' <strong>' + observed + 's</strong> (by about ' + fmtU(Math.abs(delta)) + '). ' +
        (matches
          ? 'This matches the expected physical trend (it should ' + verb + ').'
          : 'This does <strong>not</strong> match the expected physical trend (it should ' + verb + ') — a warning sign for this model.') +
        '</li>');
    });

    cards.push({
      title: 'Does the model follow the expected physical trends?',
      html: '<p>Holding the other inputs at typical (median) values and varying one input across its usual range:</p>' +
        '<ul class="explore-trend-list">' + trendItems.join('') + '</ul>' +
        '<p class="fine-print">These are simple one-at-a-time trend checks within the demonstrated data range. ' +
        'They indicate whether the model behaves sensibly, but they do not prove the model obeys the underlying physics.</p>'
    });

    var negatives = res.predicted.filter(function (v) { return v < 0; }).length;
    cards.push({
      title: 'Are the predictions physically plausible?',
      level: negatives === 0 ? null : 'high',
      html: '<p>Predictions cannot be negative. ' +
        (negatives === 0
          ? 'None of the ' + res.counts.test + ' test predictions are negative, which is physically sensible.'
          : '<strong>' + negatives + '</strong> of the ' + res.counts.test + ' test predictions are negative, which is not physically possible and is a warning sign.') +
        '</p>'
    });

    cards.push({
      title: 'What does the error mean in practice?',
      html: '<p>A typical prediction is off by about <strong>' + fmtU(res.testMetrics.rmse) + '</strong>. ' +
        'Whether that is acceptable depends entirely on the engineering use: it may be fine for a rough sizing ' +
        'estimate but far too large for a precise calculation.</p>'
    });

    cards.push({
      title: 'Is the model used inside its demonstrated range?',
      level: 'medium',
      html: '<p>Every prediction here is made within the range of the synthetic training data. ' +
        'Using the model outside that range is extrapolation and can be unreliable. ' +
        'Machine learning does not replace engineering judgement or the underlying physics; ' +
        'treat these results as a demonstration only.</p>'
    });

    host.innerHTML = '<h3 class="explore-engineering-title">Engineering interpretation</h3>' +
      cards.map(function (c) {
        var cls = 'explore-insight' + (c.level ? ' level-' + c.level : '');
        return '<div class="' + cls + '"><h3>' + c.title + '</h3>' + (c.html || ('<p>' + c.body + '</p>')) + '</div>';
      }).join('');
  }

  // --- Stage navigation ----------------------------------------------------------
  function goToStage(n) {
    n = Math.max(1, Math.min(4, n));
    state.stage = n;
    for (var i = 1; i <= 4; i++) {
      var sec = el('explore-stage-' + i);
      if (sec) sec.classList.toggle('is-hidden', i !== n);
    }
    var steps = el('exploreSteps');
    if (steps) {
      steps.querySelectorAll('li').forEach(function (li) {
        var stage = Number(li.getAttribute('data-stage'));
        li.classList.toggle('is-current', stage === n);
        li.classList.toggle('is-done', stage < n);
      });
    }
    var heading = el('exploreStage' + n + 'Heading');
    if (heading && typeof heading.focus === 'function') {
      heading.setAttribute('tabindex', '-1');
      try { heading.focus({ preventScroll: false }); } catch (_) { heading.focus(); }
    }
    if (n === 3) { loadDataset(state.exampleKey).catch(function () {}); }
  }

  function resetResults() {
    state.results = {};
    var wrap = el('exploreComparisonWrap'); if (wrap) wrap.classList.add('is-hidden');
    var focus = el('exploreFocusWrap'); if (focus) focus.classList.add('is-hidden');
    var card = el('explorePlotCard'); if (card) card.classList.add('is-hidden');
    var lossCard = el('exploreLossCard'); if (lossCard) { lossCard.classList.add('is-hidden'); lossCard.open = false; }
    var next = el('exploreToStage4'); if (next) next.disabled = true;
    var interp = el('exploreInterpretation'); if (interp) interp.innerHTML = '';
    var eng = el('exploreEngineering'); if (eng) eng.innerHTML = '';
  }

  function restart() {
    resetResults();
    state.exampleKey = EXAMPLES[0].key;
    state.dataset = null;
    state.approach = 'simple';
    var simple = document.querySelector('input[name="exploreApproach"][value="simple"]');
    if (simple) simple.checked = true;
    updateApproachControls();
    renderProblem();
    goToStage(1);
    selectExample(state.exampleKey);
  }

  // --- Continue in Project mode ---------------------------------------------------
  // Carry the Explore activity into Project mode so a learner who has just trained and
  // interpreted a model does not land on an empty "Drop a CSV here".
  //
  // Everything below is driven through Project mode's OWN controls and change events —
  // exactly as if the engineer had chosen the file, the target, the inputs and the model
  // by hand. No Project state is written directly, no panel is unlocked from here, and
  // nothing is trained automatically: the engineer still presses "Train and evaluate".

  function waitFor(test, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var deadline = Date.now() + (timeoutMs || 8000);
      (function poll() {
        var value;
        try { value = test(); } catch (e) { value = null; }
        if (value) return resolve(value);
        if (Date.now() > deadline) return reject(new Error('Timed out preparing Project mode.'));
        setTimeout(poll, 50);
      })();
    });
  }

  function fire(node, type) {
    node.dispatchEvent(new Event(type, { bubbles: true }));
  }

  // Build a File from the already-fetched CSV text and feed it to Project mode's own
  // hidden file input, so the inherited load path (validation, fingerprint, profiling,
  // panel unlocking) runs unchanged.
  function handOverDataset(dataset) {
    var input = el('csvFile');
    if (!input) throw new Error('Project mode is not available.');
    var file = new File([dataset.text], dataset.fileName || 'explore-example.csv', { type: 'text/csv' });
    var transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    fire(input, 'change');
  }

  function handOverTarget(target) {
    var select = el('targetColumn');
    if (!select) return;
    select.value = target;
    if (select.value !== target) return; // target column absent — leave the choice open
    fire(select, 'change');
  }

  function handOverFeatures(features) {
    var boxes = document.querySelectorAll('#featureList input[data-feature]');
    Array.prototype.forEach.call(boxes, function (box) {
      var wanted = features.indexOf(box.dataset.feature) !== -1;
      if (box.checked !== wanted) { box.checked = wanted; fire(box, 'change'); }
    });
  }

  function handOverModel(modelType) {
    var radio = document.querySelector('input[name="modelType"][value="' + modelType + '"]');
    if (!radio || radio.checked) return;
    radio.checked = true;
    fire(radio, 'change');
  }

  // A short, dismissible note so the carried-over choices are visible rather than magic.
  function showHandoverNote(ex, modelLabel) {
    var host = el('alertRegion');
    if (!host) return;
    var note = document.createElement('div');
    note.className = 'alert success';
    note.textContent = 'Carried over from Explore: ' + ex.short + ' — ' + ex.features.length +
      ' inputs, predicting ' + ex.target + ', starting model ' + modelLabel +
      '. Review every choice, then train when you are ready. Nothing has been trained yet.';
    host.appendChild(note);
  }

  function continueInProject() {
    var ex = exampleByKey(state.exampleKey);
    var modelType = state.focusModel || 'linear';
    return loadDataset(state.exampleKey).then(function (dataset) {
      if (global.EMSModes) global.EMSModes.show('project');
      handOverDataset(dataset);
      // populateColumnControls() fills the target select once the CSV has parsed.
      return waitFor(function () {
        var select = el('targetColumn');
        return select && select.querySelector('option[value="' + dataset.target + '"]');
      }).then(function () {
        handOverTarget(dataset.target);
        return waitFor(function () {
          return document.querySelectorAll('#featureList input[data-feature]').length;
        });
      }).then(function () {
        handOverFeatures(dataset.features);
        handOverModel(modelType);
        // Land on "Choose and train" if the inherited lock cascade has opened it;
        // goToPanel refuses locked targets, so this can never skip a required stage.
        if (global.EMSProjectShell) global.EMSProjectShell.goToPanel('step-model');
        showHandoverNote(ex, MODEL_LABELS[modelType] || modelType);
      });
    }).catch(function (error) {
      var host = el('alertRegion');
      if (host) {
        var note = document.createElement('div');
        note.className = 'alert error';
        note.textContent = 'Could not carry the Explore example over automatically (' +
          error.message + '). You can still load the dataset yourself.';
        host.appendChild(note);
      }
    });
  }

  // --- Wiring --------------------------------------------------------------------
  function wire() {
    if (state.wired) return;
    if (!el('view-explore')) return;
    state.wired = true;

    renderProblem();

    var toStage2 = el('exploreToStage2'); if (toStage2) toStage2.addEventListener('click', function () { goToStage(2); });
    var toStage3 = el('exploreToStage3'); if (toStage3) toStage3.addEventListener('click', function () { updateApproachControls(); goToStage(3); });
    var toStage4 = el('exploreToStage4'); if (toStage4) toStage4.addEventListener('click', function () { goToStage(4); });
    var back1 = el('exploreBackTo1'); if (back1) back1.addEventListener('click', function () { goToStage(1); });
    var back2 = el('exploreBackTo2'); if (back2) back2.addEventListener('click', function () { goToStage(2); });
    var back3 = el('exploreBackTo3'); if (back3) back3.addEventListener('click', function () { goToStage(3); });

    document.querySelectorAll('input[name="exploreApproach"]').forEach(function (input) {
      input.addEventListener('change', updateApproachControls);
    });

    var focus = el('exploreFocusModel');
    if (focus) focus.addEventListener('change', function () {
      state.focusModel = focus.value;
      renderComparison();
      renderPlot(state.focusModel);
      renderLossCurve(state.focusModel);
      renderInterpretation(state.focusModel);
      renderEngineering(state.focusModel);
    });

    var trainBtn = el('exploreTrainBtn'); if (trainBtn) trainBtn.addEventListener('click', function () { train(); });
    var restartBtn = el('exploreRestart'); if (restartBtn) restartBtn.addEventListener('click', restart);
    var toProject = el('exploreToProjectBtn');
    if (toProject) toProject.addEventListener('click', function () { continueInProject(); });

    updateApproachControls();
    goToStage(1);
    // Preload the default example so the first train is instant (best-effort).
    selectExample(state.exampleKey);
  }

  // Initialise once the DOM is ready; (re)ensure wiring when Explore is first shown.
  function init() {
    wire();
    document.addEventListener('ems:modechange', function (event) {
      if (event.detail && event.detail.mode === 'explore') wire();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.EMSExplore = Object.freeze({
    state: state,
    train: function () { return train(); },
    goToStage: goToStage,
    loadDataset: loadDataset,
    selectExample: selectExample,
    continueInProject: continueInProject
  });
})(window);
