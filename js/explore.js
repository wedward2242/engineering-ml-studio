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

  // --- Bundled examples (provenance and reuse terms documented per dataset). -------
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
      key: 'cooling',
      file: './examples/convective_cooling_sample.csv',
      engineering: true,
      title: 'Predict convective heat loss from a hot surface',
      short: 'Convective cooling',
      target: 'heat_dissipation_w',
      targetLabel: 'heat dissipation',
      unit: 'W',
      intro: 'A hot surface — an electronics enclosure, a pipe wall, a heat-sink base — loses heat to the surrounding air or liquid by convection. ' +
        'Here we predict the convective heat-transfer rate from the convection coefficient, the surface area and the surface-to-fluid temperature difference. ' +
        'In Newton’s law of cooling these three inputs <strong>multiply</strong> rather than add, so doubling any one of them doubles the heat loss. ' +
        'A straight-line model, which can only add weighted inputs, struggles with that; more flexible models do much better.',
      inputs: [
        { name: 'h_w_m2k', label: 'Convection coefficient', unit: 'W/m²K' },
        { name: 'area_m2', label: 'Surface area', unit: 'm²' },
        { name: 'delta_t_k', label: 'Temperature difference', unit: 'K' }
      ],
      features: ['h_w_m2k', 'area_m2', 'delta_t_k'],
      keyInputs: 'convection coefficient, surface area, temperature difference',
      trendText: 'Heat dissipation increases when the convection coefficient, surface area or temperature difference increases.',
      trends: [
        { feature: 'h_w_m2k', label: 'convection coefficient', direction: 'increase' },
        { feature: 'area_m2', label: 'surface area', direction: 'increase' },
        { feature: 'delta_t_k', label: 'temperature difference', direction: 'increase' }
      ],
      rangeText: 'The dataset has 500 rows. The convection coefficient spans 5–500 W/m²K (natural convection in air up to forced convection in liquids), so heat dissipation ranges from a few watts to roughly 20 kW.',
      disclaimer: 'This is a <strong>synthetic demonstration dataset</strong>, generated from Newton’s law of cooling with a fixed random seed and a small amount of added noise. It is not experimental, validated or safety-grade data, and must not be used for real design.',
      schematic: true,
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
      intro: 'Structural engineers need to understand how steel composition, grain size and processing conditions affect yield strength. ' +
        'Most of the variation here comes from grain size, through the Hall–Petch relationship: strength rises with one over the square root of grain size, ' +
        'so the effect is strongly curved and grows quickly for very fine grains. A straight-line model can capture the general trend, but a flexible model ' +
        'should do noticeably better. Real tensile tests also scatter from specimen to specimen, so no model can predict every value exactly. ' +
        'This synthetic example is not suitable for material selection or structural design.',
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
      rangeText: 'The dataset has 500 rows. Inputs cover carbon 0.02–0.12 wt%, manganese 0.30–1.60 wt%, silicon 0.05–0.50 wt%, grain size 2–50 µm, tempering temperature 200–650 °C and test temperature −20–100 °C. Yield strength ranges from roughly 140 to 590 MPa, with about 4% synthetic specimen-to-specimen scatter.',
      disclaimer: 'This is a <strong>synthetic demonstration dataset</strong>, generated from a simplified Hall–Petch and solid-solution strengthening relationship, with simplified temperature effects and added noise. It is not experimental, validated or safety-grade data, and predictions must not be used for real material selection, structural design or safety-critical qualification.',
      schematic: true,
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
      schematic: true,
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
      intro: 'This synthetic mathematical example shows what a harder, noisier prediction problem can look like, in contrast to the cleaner, physics-based engineering examples. It explores how a simple linear model can struggle with curved relationships, while a more flexible model may capture them better. It is <strong>not an engineering dataset</strong> and its results have no physical interpretation.',
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
      disclaimer: 'This is a <strong>synthetic mathematical demonstration</strong>, intended to illustrate model behaviour on a nonlinear, noisy relationship. Use it to compare modelling approaches, not to draw engineering conclusions or make real-world decisions.',
      schematic: true,
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

  // Schematics for the other examples, in the same style and palette as the pipe:
  // inline SVG, no external asset, each labelled with the example's own inputs.
  var COOLING_SCHEMATIC =
    '<svg class="explore-schematic" viewBox="0 0 320 146" role="img" ' +
        'aria-label="A hot surface of area A at temperature T_s with cooler fluid flowing over it at temperature T-infinity. ' +
        'Heat Q leaves the surface by convection with coefficient h, driven by the temperature difference delta T.">' +
      '<text x="160" y="14" text-anchor="middle" font-size="11" fill="#16202a">fluid at T<tspan baseline-shift="sub" font-size="8">&#8734;</tspan> flowing over the surface (convection coefficient h)</text>' +
      '<line x1="40" y1="28" x2="272" y2="28" stroke="#125f76" stroke-width="2" stroke-dasharray="6 6"></line>' +
      '<polygon points="272,22 284,28 272,34" fill="#125f76"></polygon>' +
      '<line x1="40" y1="44" x2="272" y2="44" stroke="#125f76" stroke-width="2" stroke-dasharray="6 6"></line>' +
      '<polygon points="272,38 284,44 272,50" fill="#125f76"></polygon>' +
      '<line x1="95" y1="84" x2="95" y2="60" stroke="#a52b2b" stroke-width="2"></line><polygon points="90,62 95,52 100,62" fill="#a52b2b"></polygon>' +
      '<line x1="135" y1="84" x2="135" y2="60" stroke="#a52b2b" stroke-width="2"></line><polygon points="130,62 135,52 140,62" fill="#a52b2b"></polygon>' +
      '<line x1="175" y1="84" x2="175" y2="60" stroke="#a52b2b" stroke-width="2"></line><polygon points="170,62 175,52 180,62" fill="#a52b2b"></polygon>' +
      '<line x1="215" y1="84" x2="215" y2="60" stroke="#a52b2b" stroke-width="2"></line><polygon points="210,62 215,52 220,62" fill="#a52b2b"></polygon>' +
      '<text x="232" y="72" font-size="12" fill="#a52b2b">heat Q</text>' +
      '<rect x="60" y="86" width="190" height="16" rx="2" fill="#f6dcd6" stroke="#a52b2b" stroke-width="2"></rect>' +
      '<text x="155" y="98" text-anchor="middle" font-size="11" fill="#16202a">hot surface at T<tspan baseline-shift="sub" font-size="8">s</tspan></text>' +
      '<line x1="60" y1="112" x2="250" y2="112" stroke="#16202a" stroke-width="1"></line>' +
      '<line x1="60" y1="108" x2="60" y2="116" stroke="#16202a" stroke-width="1"></line><line x1="250" y1="108" x2="250" y2="116" stroke="#16202a" stroke-width="1"></line>' +
      '<text x="155" y="126" text-anchor="middle" font-size="11" fill="#16202a">surface area A</text>' +
      '<text x="160" y="142" text-anchor="middle" font-size="11" fill="#a52b2b">temperature difference &#916;T = T<tspan baseline-shift="sub" font-size="8">s</tspan> &#8722; T<tspan baseline-shift="sub" font-size="8">&#8734;</tspan></text>' +
    '</svg>';

  var STEEL_SCHEMATIC =
    '<svg class="explore-schematic" viewBox="0 0 320 140" role="img" ' +
        'aria-label="A dog-bone steel tensile specimen pulled by force F at both ends. Inset: fine grains give higher strength than coarse grains. ' +
        'A stress-strain curve rises linearly and bends at the yield strength.">' +
      '<rect x="14" y="22" width="34" height="30" rx="3" fill="#e7f4f7" stroke="#125f76" stroke-width="2"></rect>' +
      '<rect x="48" y="30" width="84" height="14" fill="#e7f4f7" stroke="#125f76" stroke-width="2"></rect>' +
      '<rect x="132" y="22" width="34" height="30" rx="3" fill="#e7f4f7" stroke="#125f76" stroke-width="2"></rect>' +
      '<line x1="12" y1="37" x2="2" y2="37" stroke="#a52b2b" stroke-width="2"></line><polygon points="6,32 -2,37 6,42" fill="#a52b2b"></polygon>' +
      '<line x1="168" y1="37" x2="178" y2="37" stroke="#a52b2b" stroke-width="2"></line><polygon points="174,32 182,37 174,42" fill="#a52b2b"></polygon>' +
      '<text x="90" y="16" text-anchor="middle" font-size="11" fill="#16202a">tensile specimen, pulled by force F</text>' +
      '<g stroke="#125f76" stroke-width="1" fill="#f3f8fa">' +
        '<rect x="22" y="70" width="48" height="40"></rect>' +
        '<path d="M22 80 H70 M22 90 H70 M22 100 H70 M34 70 V110 M46 70 V110 M58 70 V110" fill="none"></path>' +
        '<rect x="104" y="70" width="48" height="40"></rect>' +
        '<path d="M104 90 H152 M128 70 V110" fill="none"></path>' +
      '</g>' +
      '<text x="87" y="66" text-anchor="middle" font-size="10" fill="#555">grain size d</text>' +
      '<text x="46" y="124" text-anchor="middle" font-size="11" fill="#16202a">fine grains</text>' +
      '<text x="46" y="136" text-anchor="middle" font-size="10" fill="#a52b2b">stronger</text>' +
      '<text x="128" y="124" text-anchor="middle" font-size="11" fill="#16202a">coarse grains</text>' +
      '<text x="128" y="136" text-anchor="middle" font-size="10" fill="#555">weaker</text>' +
      '<line x1="210" y1="112" x2="312" y2="112" stroke="#16202a" stroke-width="1.5"></line>' +
      '<line x1="210" y1="112" x2="210" y2="18" stroke="#16202a" stroke-width="1.5"></line>' +
      '<path d="M210 112 L236 46 Q242 34 256 32 L308 26" fill="none" stroke="#125f76" stroke-width="2.5"></path>' +
      '<circle cx="239" cy="40" r="4" fill="#a52b2b"></circle>' +
      '<text x="246" y="56" font-size="10" fill="#a52b2b">yield strength</text>' +
      '<text x="246" y="69" font-size="11" fill="#a52b2b">&#963;<tspan baseline-shift="sub" font-size="8">y</tspan></text>' +
      '<text x="261" y="128" text-anchor="middle" font-size="11" fill="#16202a">strain</text>' +
      '<text x="200" y="66" text-anchor="middle" transform="rotate(-90 200 66)" font-size="11" fill="#16202a">stress</text>' +
    '</svg>';

  var ORIFICE_SCHEMATIC =
    '<svg class="explore-schematic" viewBox="0 0 320 130" role="img" ' +
        'aria-label="Fluid of density rho flows left to right through a pipe and a thin plate with a circular hole of diameter d. ' +
        'Pressure taps before and after the plate show a pressure difference delta p, which drives the flow rate Q.">' +
      '<rect x="98" y="16" width="8" height="34" fill="#e7f4f7" stroke="#125f76" stroke-width="1.5"></rect>' +
      '<rect x="99.5" y="20" width="5" height="30" fill="#7fb6c6"></rect>' +
      '<rect x="210" y="16" width="8" height="34" fill="#e7f4f7" stroke="#125f76" stroke-width="1.5"></rect>' +
      '<rect x="211.5" y="36" width="5" height="14" fill="#7fb6c6"></rect>' +
      '<line x1="122" y1="20" x2="122" y2="36" stroke="#a52b2b" stroke-width="1.5"></line>' +
      '<polygon points="118,24 122,18 126,24" fill="#a52b2b"></polygon><polygon points="118,32 122,38 126,32" fill="#a52b2b"></polygon>' +
      '<text x="128" y="31" font-size="12" fill="#a52b2b">&#916;p</text>' +
      '<line x1="96" y1="20" x2="220" y2="20" stroke="#a52b2b" stroke-width="1" stroke-dasharray="3 3"></line>' +
      '<line x1="96" y1="36" x2="220" y2="36" stroke="#a52b2b" stroke-width="1" stroke-dasharray="3 3"></line>' +
      '<line x1="20" y1="50" x2="300" y2="50" stroke="#125f76" stroke-width="2"></line>' +
      '<line x1="20" y1="104" x2="300" y2="104" stroke="#125f76" stroke-width="2"></line>' +
      '<rect x="20" y="50" width="280" height="54" fill="#e7f4f7" opacity=".6"></rect>' +
      '<rect x="156" y="50" width="6" height="17" fill="#125f76"></rect>' +
      '<rect x="156" y="87" width="6" height="17" fill="#125f76"></rect>' +
      '<g fill="none" stroke="#125f76" stroke-width="1.5" stroke-dasharray="5 4">' +
        '<path d="M28 60 C110 60 140 71 159 72 C190 73 230 62 288 60"></path>' +
        '<path d="M28 77 L288 77"></path>' +
        '<path d="M28 94 C110 94 140 83 159 82 C190 81 230 92 288 94"></path>' +
      '</g>' +
      '<polygon points="288,72 298,77 288,82" fill="#125f76"></polygon>' +
      '<text x="40" y="118" font-size="11" fill="#16202a">fluid density &#961;</text>' +
      '<text x="238" y="118" font-size="11" fill="#16202a">flow rate Q &#8594;</text>' +
      '<line x1="170" y1="68" x2="170" y2="86" stroke="#16202a" stroke-width="1"></line>' +
      '<text x="174" y="80" font-size="11" fill="#16202a">d</text>' +
      '<text x="159" y="126" text-anchor="middle" font-size="10" fill="#555">orifice plate</text>' +
    '</svg>';

  var NONLINEAR_SCHEMATIC =
    '<svg class="explore-schematic" viewBox="0 0 320 120" role="img" ' +
        'aria-label="Noisy data points scattered around a wavy curve. A straight line through them misses the curvature.">' +
      '<line x1="36" y1="100" x2="304" y2="100" stroke="#16202a" stroke-width="1.5"></line>' +
      '<line x1="36" y1="100" x2="36" y2="8" stroke="#16202a" stroke-width="1.5"></line>' +
      '<polyline points="40.0,57.5 44.3,55.1 48.6,52.7 53.0,50.4 57.3,48.1 61.6,46.0 65.9,44.0 70.3,42.3 74.6,40.8 78.9,39.6 83.2,38.8 87.5,38.3 91.9,38.2 96.2,38.4 100.5,39.0 104.8,40.0 109.2,41.4 113.5,43.0 117.8,45.1 122.1,47.3 126.4,49.9 130.8,52.6 135.1,55.5 139.4,58.4 143.7,61.4 148.1,64.4 152.4,67.3 156.7,70.0 161.0,72.6 165.3,74.9 169.7,76.9 174.0,78.6 178.3,79.9 182.6,80.7 186.9,81.2 191.3,81.2 195.6,80.7 199.9,79.7 204.2,78.4 208.6,76.5 212.9,74.3 217.2,71.8 221.5,68.9 225.8,65.7 230.2,62.4 234.5,58.9 238.8,55.3 243.1,51.7 247.5,48.2 251.8,44.8 256.1,41.5 260.4,38.6 264.7,36.0 269.1,33.7 273.4,31.9 277.7,30.6 282.0,29.7 286.4,29.4 290.7,29.6 295.0,30.4" fill="none" stroke="#125f76" stroke-width="2" opacity=".5"></polyline>' +
      '<circle cx="40.0" cy="58.8" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="47.7" cy="50.5" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="55.5" cy="50.2" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="63.2" cy="46.9" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="70.9" cy="46.9" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="78.6" cy="40.8" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="86.4" cy="32.6" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="94.1" cy="36.0" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="101.8" cy="33.8" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="109.5" cy="40.2" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="117.3" cy="42.7" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="125.0" cy="48.0" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="132.7" cy="62.6" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="140.5" cy="54.7" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="148.2" cy="61.8" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="155.9" cy="66.9" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="163.6" cy="82.9" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="171.4" cy="86.8" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="179.1" cy="84.7" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="186.8" cy="83.6" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="194.5" cy="79.2" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="202.3" cy="79.3" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="210.0" cy="73.1" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="217.7" cy="74.8" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="225.5" cy="64.4" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="233.2" cy="57.9" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="240.9" cy="57.0" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="248.6" cy="38.2" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="256.4" cy="38.4" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="264.1" cy="30.1" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="271.8" cy="35.8" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="279.5" cy="34.0" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="287.3" cy="31.2" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<circle cx="295.0" cy="31.0" r="2.6" fill="#125f76" opacity=".75"></circle>' +
      '<line x1="40" y1="62" x2="295" y2="52" stroke="#a52b2b" stroke-width="2" stroke-dasharray="6 5"></line>' +
      '<text x="110" y="114" text-anchor="middle" font-size="11" fill="#16202a">input</text>' +
      '<text x="26" y="54" text-anchor="middle" transform="rotate(-90 26 54)" font-size="11" fill="#16202a">target</text>' +
      '<line x1="168" y1="110" x2="186" y2="110" stroke="#a52b2b" stroke-width="2" stroke-dasharray="6 5"></line>' +
      '<text x="190" y="114" font-size="10" fill="#a52b2b">straight-line fit</text>' +
    '</svg>';

  var SCHEMATICS = {
    pipe: PIPE_SCHEMATIC,
    cooling: COOLING_SCHEMATIC,
    steel: STEEL_SCHEMATIC,
    orifice: ORIFICE_SCHEMATIC,
    nonlinear: NONLINEAR_SCHEMATIC
  };

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

    var schematic = SCHEMATICS[ex.key] ? '<div class="explore-schematic-wrap">' + SCHEMATICS[ex.key] + '</div>' : '';

    syncExampleCopy(ex);

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

  // The Explore shell (page heading, stage headings, approach and stage guidance)
  // was written when pipe pressure drop was the only example. Keep every
  // example-specific phrase in step with the selected example, so steel never
  // shows a pipe heading or kPa. textContent only: titles and labels are plain.
  function syncExampleCopy(ex) {
    var heading = el('exploreHeading');
    if (heading) heading.textContent = ex.title;
    var stageHeading = el('exploreStage1Heading');
    if (stageHeading) stageHeading.textContent = 'Understand the problem: ' + ex.short.toLowerCase();
    var kind = el('exploreEyebrowKind');
    if (kind) kind.textContent = ex.engineering ? 'Guided engineering example' : 'Guided mathematical example';

    var copy = {
      target: ex.targetLabel,
      unitPhrase: ex.unit ? 'the target’s own units (' + ex.unit + ')' : 'the target’s original scale',
      unitSuffix: ex.unit ? ', in ' + ex.unit : '',
      stage4Look: ex.engineering
        ? 'sensible physical trends, errors in ' + (ex.unit || 'the target’s units') + ', and honest limits'
        : 'how the errors compare between approaches, and honest limits'
    };
    document.querySelectorAll('#view-explore [data-ex-copy]').forEach(function (node) {
      var key = node.getAttribute('data-ex-copy');
      if (Object.prototype.hasOwnProperty.call(copy, key)) node.textContent = copy[key];
    });
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
      // Manual selections create history entries so Back and Forward can restore them.
      input.addEventListener('change', function () {
        selectExample(input.value, { updateHistory: true });
      });
    });
  }

  function selectExample(key, options) {
    options = options || {};

    // Reject unsupported keys rather than allowing an invalid example into state.
    if (!EXAMPLES.some(function (ex) { return ex.key === key; })) return;

    if (state.exampleKey !== key) {
      state.exampleKey = key;
      state.dataset = null;
      resetResults();
      renderProblem();
    }

    // Only manual selections create history entries. URL restoration must not
    // create another entry, otherwise Back and Forward could become trapped.
    if (options.updateHistory && global.location && global.history) {
      var nextHash = '#explore/' + key;
      if (global.location.hash !== nextHash) {
        global.history.pushState(null, '', nextHash);
      }
    }

    // Preload in the background so training feels instant; ignore failures here.
    loadDataset(key).catch(function () {});
  }

  // Read a supported Explore example from the current URL.
  // Return null for ordinary routes such as #explore or unrelated routes.
  function exampleKeyFromHash() {
    var match = /^#explore\/([^/]+)$/.exec(global.location.hash || '');
    if (!match) return null;

    var key = match[1];
    return EXAMPLES.some(function (ex) { return ex.key === key; }) ? key : null;
  }

  // Apply a URL selection without creating another browser history entry.
  function applyExampleFromHash() {
    var key = exampleKeyFromHash();

    // Restore an explicitly requested example from a deep link.
    if (key) {
      selectExample(key);
      return;
    }

    // Plain #explore always means the default Pipe example, including
    // when the browser returns to it using Back or Forward.
    if (global.location.hash === '#explore') {
      selectExample('pipe');
    }
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
    var overfitPanel = el('exploreOverfitDemo');
    if (overfitPanel && state.approach !== 'compare') {
      overfitPanel.classList.add('is-hidden');
    }
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
    var tValidation = rawValidation.length ? ML.transformRows(rawValidation, pre, dataset.target, true) : null;
    var tt = ML.fitTargetTransform(tTrain.y, 'none');
    var yTrain = ML.applyTargetTransform(tTrain.y, tt);

    // The neural network benefits from a real validation set for honest early stopping.
    // Other models ignore these fields, so this stays a contained, model-specific addition.
    var fitParams = params;
    if (modelType === 'ann' && tValidation) {
      fitParams = Object.assign({}, params, {
        _validationX: tValidation.X,
        _validationY: ML.applyTargetTransform(tValidation.y, tt)
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
      var validationMetrics = tValidation
        ? ML.metrics(tValidation.y, ML.inverseTargetTransform(adapter.predict(model, tValidation.X), tt, true))
        : null;
      return {
        trainMetrics: ML.metrics(tTrain.y, predTrain),
        testMetrics: ML.metrics(tTest.y, predTest),
        validationMetrics: validationMetrics,
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
    resetResults();
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
      }, Promise.resolve()).then(function () {
        if (state.approach === 'compare') return runOverfitSweep(dataset);
      });
    }).then(function () {
      setBusy(false, '');
      state.focusModel = bestModel(types);
      renderComparison();
      renderOverfitDemo();
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
  // B2: a deliberate overfitting demonstration.
  //
  // The same existing model (a Decision Tree) is fitted at every depth in
  // OVERFIT_DEPTHS with one-row leaves, so depth is the only flexibility knob.
  // The sensible depth is the shallowest whose *validation* RMSE is within
  // OVERFIT_TOLERANCE of the best (prefer the simplest model that does about
  // as well); the too-flexible tree is the deepest. Both are then reported on
  // the same test rows, which played no part in choosing the depth.
  //
  // What this reliably shows on every bundled dataset is the train/test gap:
  // training error keeps falling with depth while validation error flattens,
  // so the deep tree's training score badly overstates its accuracy. With
  // ~75 validation and test rows, whether the deep tree is also *worse* on the
  // test rows is not reliable, so the copy states that comparison factually
  // rather than promising it. Nothing here changes the comparison table.
  var OVERFIT_DEPTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  var OVERFIT_TOLERANCE = 0.10;

  function overfitTreeParams(depth) {
    return { maxDepth: depth, minLeaf: 1, maxThresholds: 24, maxFeatures: 'all' };
  }

  function runOverfitSweep(dataset) {
    var sweep = [];
    return OVERFIT_DEPTHS.reduce(function (chain, depth) {
      return chain.then(function () {
        return runPipeline(dataset, 'tree', overfitTreeParams(depth)).then(function (res) {
          sweep.push({ depth: depth, result: res });
        });
      });
    }, Promise.resolve()).then(function () {
      var usable = sweep.filter(function (s) { return s.result.validationMetrics; });
      if (!usable.length) { state.overfitDemo = null; return; }
      var bestRmse = Math.min.apply(null, usable.map(function (s) { return s.result.validationMetrics.rmse; }));
      var sensible = usable.filter(function (s) {
        return s.result.validationMetrics.rmse <= (1 + OVERFIT_TOLERANCE) * bestRmse;
      })[0];
      state.overfitDemo = {
        sweep: sweep,
        sensible: sensible,
        flexible: sweep[sweep.length - 1]
      };
    });
  }

  function renderOverfitScatter(plotId, title, result) {
    var all = result.actual.concat(result.predicted).filter(function (v) { return isFinite(v); });
    var min = Math.min.apply(null, all);
    var max = Math.max.apply(null, all);
    if (!isFinite(min) || !isFinite(max) || min === max) { min -= 1; max += 1; }
    var unit = currentUnit();
    var target = exampleByKey(state.exampleKey).targetLabel + (unit ? ' (' + unit + ')' : '');
    global.Plotly.react(plotId, [
      {
        x: result.actual, y: result.predicted, mode: 'markers', type: 'scatter',
        name: 'Test rows', marker: { color: '#125f76', size: 7, opacity: 0.75 },
        hovertemplate: 'Actual %{x}<br>Predicted %{y}<extra></extra>'
      },
      {
        x: [min, max], y: [min, max], mode: 'lines', type: 'scatter',
        name: 'Perfect prediction', line: { dash: 'dash', color: '#a52b2b' }, hoverinfo: 'skip'
      }
    ], {
      title: { text: title, font: { size: 14 } },
      xaxis: { title: { text: 'Actual ' + target }, automargin: true },
      yaxis: { title: { text: 'Predicted ' + target }, automargin: true },
      showlegend: false,
      margin: { l: 60, r: 15, t: 40, b: 55 },
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)'
    }, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] });
  }

  function renderOverfitDemo() {
    var panel = el('exploreOverfitDemo');
    if (!panel) return;
    var demo = state.overfitDemo;
    if (state.approach !== 'compare' || !demo || !global.Plotly) {
      panel.classList.add('is-hidden');
      return;
    }
    panel.classList.remove('is-hidden');

    var unit = currentUnit();
    var unitSuffix = unit ? ' ' + unit : '';
    var depths = demo.sweep.map(function (s) { return s.depth; });

    global.Plotly.react('exploreOverfitCurvePlot', [
      {
        x: depths, y: demo.sweep.map(function (s) { return s.result.trainMetrics.rmse; }),
        mode: 'lines+markers', type: 'scatter', name: 'Training RMSE', line: { color: '#125f76' }
      },
      {
        x: depths, y: demo.sweep.map(function (s) { return s.result.validationMetrics ? s.result.validationMetrics.rmse : null; }),
        mode: 'lines+markers', type: 'scatter', name: 'Validation RMSE', line: { color: '#a52b2b' }
      }
    ], {
      xaxis: { title: { text: 'Tree depth (more flexible →)' }, dtick: 1, automargin: true },
      yaxis: { title: { text: 'RMSE' + unitSuffix }, rangemode: 'tozero', automargin: true },
      shapes: [{
        type: 'line', x0: demo.sensible.depth, x1: demo.sensible.depth, yref: 'paper', y0: 0, y1: 1,
        line: { dash: 'dot', color: '#555' }
      }],
      annotations: [{
        x: demo.sensible.depth, yref: 'paper', y: 1, text: 'sensible depth',
        showarrow: false, yanchor: 'bottom', font: { size: 11 }
      }],
      margin: { l: 65, r: 20, t: 30, b: 55 },
      legend: { orientation: 'h', y: -0.3 },
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)'
    }, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] });

    var s = demo.sensible, f = demo.flexible;
    el('exploreOverfitSensibleTitle').textContent = 'Sensible fit: depth ' + s.depth + ' (chosen using validation rows)';
    el('exploreOverfitFlexibleTitle').textContent = 'Too flexible: depth ' + f.depth;
    renderOverfitScatter('exploreOverfitSensiblePlot', 'Decision Tree, depth ' + s.depth, s.result);
    renderOverfitScatter('exploreOverfitFlexiblePlot', 'Decision Tree, depth ' + f.depth, f.result);

    function metricsText(result) {
      return 'Training RMSE: ' + fmt(result.trainMetrics.rmse) + unitSuffix +
        '. Test RMSE: ' + fmt(result.testMetrics.rmse) + unitSuffix + '.';
    }
    el('exploreOverfitSensibleMetrics').textContent = metricsText(s.result);
    el('exploreOverfitFlexibleMetrics').textContent = metricsText(f.result);

    var first = demo.sweep[0].result;
    var flexRatio = f.result.testMetrics.rmse / f.result.trainMetrics.rmse;
    var sensRatio = s.result.testMetrics.rmse / s.result.trainMetrics.rmse;
    var testComparison;
    if (f.result.testMetrics.rmse > s.result.testMetrics.rmse) {
      testComparison = 'On the unseen test rows the depth-' + f.depth + ' tree is also worse: ' +
        fmt(f.result.testMetrics.rmse) + unitSuffix + ' against ' + fmt(s.result.testMetrics.rmse) + unitSuffix + '.';
    } else {
      testComparison = 'On the unseen test rows the depth-' + f.depth + ' tree scores ' + fmt(f.result.testMetrics.rmse) + unitSuffix +
        ' against ' + fmt(s.result.testMetrics.rmse) + unitSuffix + ' for the depth-' + s.depth +
        ' tree — a far smaller difference than its training score suggests.';
    }
    var explanation = 'Training error falls at every depth, from ' + fmt(first.trainMetrics.rmse) + unitSuffix +
      ' at depth 1 to ' + fmt(f.result.trainMetrics.rmse) + unitSuffix + ' at depth ' + f.depth +
      ', because a deeper tree can carve out a region for ever fewer training rows. Validation error does not keep up: ' +
      'beyond depth ' + s.depth + ' it is never more than ' + Math.round(OVERFIT_TOLERANCE * 100) +
      '% better, so the extra flexibility is mostly fitting noise in these particular rows. ' +
      'That is overfitting, and the giveaway is the gap between training and test error: for the depth-' + f.depth +
      ' tree the test error is ' + flexRatio.toFixed(1) + ' times its training error, against ' + sensRatio.toFixed(1) +
      ' times for the depth-' + s.depth + ' tree. ' + testComparison +
      ' A training score always flatters a flexible model; judge models on data they have not seen.';
    el('exploreOverfitExplanation').textContent = explanation;
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
        ? ('Training stopped early at epoch ' + t.ranEpochs + ' of a maximum of ' + t.maxEpochs +
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
    var testR2 = res.testMetrics.r2;
    var testRmse = res.testMetrics.rmse;
    var testMae = res.testMetrics.mae;
    var trainRmse = res.trainMetrics.rmse;
    var of = overfitVerdict(trainRmse, testRmse);
    var cards = [];

    cards.push({
      title: 'Which approach is this? (' + MODEL_LABELS[modelType] + ')',
      body: modelExplanation(modelType)
    });

    // B1: each card leads with the user's own numbers, always visible. The generic
    // "what does this mean?" definition sits in a dismissible disclosure beneath it,
    // closed by default, so the explanation is there for those who want it without
    // hiding the result itself. Presentation only: no metric is recomputed.
    var nTest = res.counts.test;

    cards.push({
      title: 'How good is the fit? (R² = ' + fmtR2(testR2) + ')',
      body: (isFinite(testR2) && testR2 >= 0
        ? ('On the ' + nTest + ' test rows the model explains about ' + pct(testR2) + ' of the variation in ' +
           escapeHtml(target) + ' — a ' + r2Quality(testR2) + ' fit.')
        : ('On the ' + nTest + ' test rows the fit is ' + r2Quality(testR2) + ': worse than simply predicting the average ' +
           escapeHtml(target) + ' every time.')),
      explain: 'R² compares the model’s errors with the errors you would make by always predicting the average ' +
        escapeHtml(target) + '. A value of 1 is perfect; 0 means no better than predicting the average; a negative value is worse. ' +
        'Because it has no units, R² lets you compare very different problems — but it cannot tell you whether the errors are ' +
        'small enough for your engineering purpose. That is what RMSE and MAE are for.'
    });

    cards.push({
      title: 'How large are the typical errors? (RMSE ≈ ' + fmtU(testRmse) + ')',
      body: 'On the test rows the RMSE is ' + fmtU(testRmse) + '. On the training rows the model has already seen, the training RMSE was ' +
        fmtU(trainRmse) + '.',
      explain: 'RMSE (root-mean-square error) squares each prediction error, averages them, and takes the square root, so it is in the units of ' +
        escapeHtml(target) + (unit ? ' (' + escapeHtml(unit) + ')' : '') + '. ' +
        'Squaring means large errors count for much more than small ones: a few big misses raise RMSE sharply. ' +
        'Read it as “a typical error, with big misses weighted heavily”.'
    });

    var ratio = (isFinite(testRmse) && isFinite(testMae) && testMae > 0) ? testRmse / testMae : NaN;
    cards.push({
      title: 'What is the average absolute error? (MAE ≈ ' + fmtU(testMae) + ')',
      body: 'On average, a test prediction is off by about ' + fmtU(testMae) + ', too high or too low.' +
        (isFinite(ratio)
          ? (' Here RMSE is ' + ratio.toFixed(2) + ' times MAE' +
             (ratio > 1.4 ? ', so a few large errors account for much of the RMSE.' : ', so the errors are fairly evenly sized.'))
          : ''),
      explain: 'MAE (mean absolute error) is the average size of the errors, ignoring whether each prediction was too high or too low. ' +
        'Unlike RMSE it does not give extra weight to large errors, so it is never larger than RMSE. Comparing the two is useful: ' +
        'when RMSE is much larger than MAE, a handful of big misses dominate — worth finding out which rows they are.'
    });

    if (of) {
      var rmseGap = testRmse - trainRmse;
      cards.push({
        title: 'Is it overfitting?',
        body: of.text +
          ' In this result the test RMSE is ' + fmtU(testRmse) +
          ', compared with a training RMSE of ' + fmtU(trainRmse) +
          ': the test error is ' + fmtU(Math.abs(rmseGap)) +
          (rmseGap >= 0 ? ' higher' : ' lower') + ' than the training error.',
        explain: 'The training error is measured on rows the model learned from, so it is optimistic. The test error is measured on rows ' +
          'held back from training, so it is an honest estimate of performance on new data. A test error much larger than the training ' +
          'error means the model has learned quirks of its training rows that do not carry over — that is overfitting. ' +
          'A small gap is normal; the size of the gap is what matters.',
        level: of.level
      });
    }

    if (modelType === 'ann') {
      annInterpretationCards(res).forEach(function (c) { cards.push(c); });
    }

    cards.push({
      title: 'Reading the actual-vs-predicted plot',
      body: 'Each point is one test row. The horizontal axis is the true ' +
        escapeHtml(target) + (unit ? ' in ' + escapeHtml(unit) : '') +
        ' and the vertical axis is the model’s prediction. ' +
        'Points on the dashed diagonal are perfect predictions; points far above or below the line are larger errors. ' +
        'A tight cloud along the diagonal means accurate predictions.'
    });

    host.innerHTML = cards.map(function (c) {
      var cls = 'explore-insight' + (c.level ? ' level-' + c.level : '');
      return '<div class="' + cls + '"><h3>' + c.title + '</h3><p>' + c.body + '</p>' +
        (c.explain
          ? '<details class="explore-explainer"><summary>What does this mean?</summary><p>' + c.explain + '</p></details>'
          : '') +
        '</div>';
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
        convBody = 'Training stopped early at epoch ' + t.ranEpochs + ' of a maximum of ' + t.maxEpochs +
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
      var preds = predictRaw(res, [lowRow, highRow]); var delta = preds[1] - preds[0];
      var observedDirection = delta > 0  ? 'increase' : (delta < 0 ? 'decrease' : 'flat');
      var observed = delta > 0 ? 'increases' : (delta < 0 ? 'decreases' : 'stays flat');
      var matches = observedDirection === tr.direction;
      var verb = tr.direction === 'increase' ? 'increase' : 'decrease';

      trendItems.push('<li class="' + (matches ? 'trend-ok' : 'trend-warn') + '">' +
        'As <strong>' + escapeHtml(tr.label) + '</strong> increases, the predicted ' + escapeHtml(ex.targetLabel) +
        ' <strong>' + observed + '</strong> (by about ' + fmtU(Math.abs(delta)) + '). ' +
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
      html: '<p>For this example, negative predictions are not physically plausible. ' +
        (negatives === 0
         ? 'None of the ' + res.counts.test + ' test predictions are negative, which is consistent with the demonstrated conditions.'
          : '<strong>' + negatives + '</strong> of the ' + res.counts.test + ' test predictions are negative, which is a warning sign.') +
       '</p>'
    });

    cards.push({
      title: 'What does the error mean in practice?',
      html: '<p>The test RMSE is <strong>' + fmtU(res.testMetrics.rmse) +
        '</strong>. It summarises prediction error in the target’s units. ' +
        'Whether this error is acceptable depends on the engineering application and ' +
        'requires appropriate validation; these synthetic examples are for demonstration only.</p>'
    });

    cards.push({
    title: 'Is the model used inside its demonstrated range?',
    level: 'medium',
    html: '<p>The test predictions use held-out rows drawn from the bundled synthetic dataset. ' +
      'The trend checks vary one input between the 10th and 90th percentiles of the training data ' +
      'while holding the other inputs at typical values. Predictions for new inputs outside the ' +
      'training data range are extrapolation and can be unreliable. Machine learning does not ' +
      'replace engineering judgement or the underlying physics; treat these results as a demonstration only.</p>'
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
    state.overfitDemo = null;
    var overfitPanel = el('exploreOverfitDemo');
    if (overfitPanel) overfitPanel.classList.add('is-hidden');
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

    // Apply a deep link after wiring because the router loads before this module.
    applyExampleFromHash();

    // Browser history traversal must restore the example as well as the view.
    global.addEventListener('popstate', applyExampleFromHash);
    global.addEventListener('hashchange', applyExampleFromHash);

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
