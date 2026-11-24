// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 UK Research and Innovation (UKRI)

// Use Playwright's existing test runner for documentation checks.
const { test, expect } = require('@playwright/test');

// Read the repository documentation directly from the project root.
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.join(__dirname, '..');
const readmePath = path.join(repositoryRoot, 'README.md');
const courseMaterialsPath = path.join(repositoryRoot, 'docs', 'COURSE_MATERIALS.md');

test('README links to the course materials boundary guidance', () => {
  // Read the README so the test checks the actual published entry point.
  const readme = fs.readFileSync(readmePath, 'utf8');

  expect(readme).toContain(
    '[Course Materials and Repository Boundary](docs/COURSE_MATERIALS.md)'
  );
});

test('boundary guidance distinguishes public platform resources from private course materials', () => {
  // Read the guidance rather than relying on a copied or hard-coded summary.
  const guidance = fs.readFileSync(courseMaterialsPath, 'utf8');

  // Check that both repository responsibilities are documented.
  expect(guidance).toContain('## What belongs in this repository');
  expect(guidance).toContain('## What belongs in the private course repository');

  // Check that reusable platform learning resources remain public.
  expect(guidance).toContain('Reusable engineering examples and datasets');
  expect(guidance).toContain('notebooks/');
  expect(guidance).toContain('it belongs in the public platform repository');

  // Check that course-specific teaching and assessment materials are separate.
  expect(guidance).toContain('Course curricula, syllabuses and lesson plans');
  expect(guidance).toContain('Exercise solutions, assessment questions');
  expect(guidance).toMatch(/it belongs\s+in the private course repository/);
});
