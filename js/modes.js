// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 UK Research and Innovation (UKRI)
// Engineering ML Studio — mode/router layer (Phase 1 prototype).
//
// A tiny view switcher over the existing single-page application. It shows exactly
// one top-level "view" at a time (Home, Explore, Project, About) and keeps the top
// navigation, the mode indicator and the URL hash in sync. It deliberately does NOT
// touch the inherited Project-mode application state or logic; Project mode is simply
// one of the views it can show.
(function (global) {
  'use strict';

  var VIEWS = ['home', 'explore', 'project', 'learn', 'about'];
  var LABELS = { home: 'Home', explore: 'Explore', project: 'Project', learn: 'Learn', about: 'About' };

  function el(id) { return document.getElementById(id); }
  function viewEl(mode) { return el('view-' + mode); }

  function isValid(mode) { return VIEWS.indexOf(mode) !== -1; }

  // These are the only supported nested Explore routes.
  // Keeping this list here lets the router reject unknown URLs during startup,
  // before the Explore module has finished loading.
  var EXPLORE_EXAMPLE_KEYS = ['pipe', 'cooling', 'steel', 'orifice', 'nonlinear'];

  // Convert the current URL hash into a validated top-level route.
  function routeFromHash() {
    var raw = (global.location && global.location.hash || '').replace(/^#/, '').trim();
    var parts = raw.split('/');

    // Ordinary top-level routes, such as #home or #explore.
    if (parts.length === 1 && isValid(parts[0])) {
      return { mode: parts[0], exampleKey: null };
    }

    // Supported deep links, such as #explore/pipe.
    if (
      parts.length === 2 &&
      parts[0] === 'explore' &&
      EXPLORE_EXAMPLE_KEYS.indexOf(parts[1]) !== -1
    ) {
      return { mode: 'explore', exampleKey: parts[1] };
    }

    // Unknown or malformed routes return to Home.
    return { mode: 'home', exampleKey: null };
  }
  var current = null;

  function show(mode, options) {
    if (!isValid(mode)) mode = 'home';
    options = options || {};
    VIEWS.forEach(function (name) {
      var node = viewEl(name);
      if (node) node.classList.toggle('is-hidden', name !== mode);
    });
    // Reflect the active state in the primary navigation.
    var navLinks = document.querySelectorAll('.top-nav [data-nav]');
    navLinks.forEach(function (link) {
      var active = link.getAttribute('data-nav') === mode;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    var indicator = el('modeIndicator');
    if (indicator) indicator.textContent = LABELS[mode] ? LABELS[mode] + ' mode' : '';

    // Expose the current mode on <body> so the stylesheet can adapt chrome per view.
    // Project mode renders its own application top bar, so the global nav is hidden
    // there and the app top bar becomes the single header (see css/app.css).
    //
    // This must be a CLASS, not a data-mode attribute: onModeClick below resolves its
    // trigger with closest('[data-mode]'), so a data-mode on <body> would match every
    // click in the document and preventDefault() it — which silently stops radios and
    // checkboxes anywhere in the app from being selected.
    if (document.body) {
      VIEWS.forEach(function (name) {
        document.body.classList.toggle('is-mode-' + name, name === mode);
      });
    }

    // Keep the URL hash in sync without adding a second history entry per click.
    // Preserve a valid Explore example key when showing the Explore view.
    var route = routeFromHash();
    var nextHash = route.mode === mode && route.exampleKey
      ? '#explore/' + route.exampleKey
      : '#' + mode;

    if (global.location && nextHash !== global.location.hash) {
      try { global.history.replaceState(null, '', nextHash); }
      catch (_) { global.location.hash = nextHash.slice(1); }
    }

    var previous = current;
    current = mode;

    // Move keyboard focus to the newly shown view for accessibility, unless asked not to.
    if (!options.noFocus) {
      var node = viewEl(mode);
      if (node && typeof node.focus === 'function') {
        try { node.focus({ preventScroll: false }); } catch (_) { node.focus(); }
      }
    }

    // Let interested modules (e.g. Explore) react to being shown.
    if (previous !== mode) {
      try {
        document.dispatchEvent(new CustomEvent('ems:modechange', { detail: { mode: mode, previous: previous } }));
      } catch (_) { /* CustomEvent unsupported — ignore */ }
    }
    return mode;
  }

  function modeFromHash() {
    return routeFromHash().mode;
  }

  function onModeClick(event) {
    var trigger = event.target && event.target.closest ? event.target.closest('[data-mode]') : null;
    if (!trigger) return;
    // Belt and braces: data-mode marks a navigation control, never a container. If it ever
    // lands on <body>/<html> again, every click in the document would be preventDefault()ed
    // and no radio or checkbox anywhere in the app could be selected.
    if (trigger === document.body || trigger === document.documentElement) return;
    var mode = trigger.getAttribute('data-mode');
    if (!isValid(mode)) return;
    event.preventDefault();
    show(mode);
  }

  function init() {
    document.addEventListener('click', onModeClick);
    // Handle both hash changes and history traversal between pushState entries.
    function onLocationChange() {
      show(modeFromHash(), { noFocus: false });
    }
    global.addEventListener('hashchange', onLocationChange);
    global.addEventListener('popstate', onLocationChange);
    // Initial view: honour a deep link (e.g. #explore), default to Home.
    show(modeFromHash(), { noFocus: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.EMSModes = Object.freeze({
    show: show,
    get current() { return current; },
    views: VIEWS.slice()
  });
})(window);
