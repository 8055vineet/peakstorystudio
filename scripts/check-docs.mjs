#!/usr/bin/env node
// Verifies the docs stay consistent with the codebase.
// Run: npm run check:docs
//
// Checks:
//   1. every required doc exists
//   2. every component in src/components is mentioned in docs/COMPONENTS.md
//   3. every src/... path cited in any doc actually exists
//   4. every relative markdown link resolves

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const errors = [];
const fail = (msg) => errors.push(msg);

const REQUIRED_DOCS = [
  'README.md',
  'CLAUDE.md',
  'docs/ARCHITECTURE.md',
  'docs/COMPONENTS.md',
  'docs/DATA-MODEL.md',
  'docs/DESIGN-SYSTEM.md',
  'docs/ROADMAP.md',
  'docs/KNOWN-ISSUES.md',
];

for (const doc of REQUIRED_DOCS) {
  if (!existsSync(join(ROOT, doc))) fail(`missing required doc: ${doc}`);
}

function walkMarkdown(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkMarkdown(full, out);
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

const markdownFiles = [
  ...['README.md', 'CLAUDE.md'].map((f) => join(ROOT, f)).filter((f) => existsSync(f)),
  ...walkMarkdown(join(ROOT, 'docs')),
];

// Check 2: every component documented
const componentsDoc = join(ROOT, 'docs/COMPONENTS.md');
if (existsSync(componentsDoc)) {
  const text = readFileSync(componentsDoc, 'utf8');
  const components = readdirSync(join(ROOT, 'src/components'))
    .filter((f) => f.endsWith('.jsx'))
    .map((f) => f.replace(/\.jsx$/, ''));
  for (const name of components) {
    if (!text.includes(name)) fail(`COMPONENTS.md does not document: ${name}`);
  }
}

// Check 3: cited source paths exist
const SRC_PATH = /\b(src\/[A-Za-z0-9_\-./]+\.(?:jsx?|css))/g;
for (const file of markdownFiles) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(SRC_PATH)) {
    if (!existsSync(join(ROOT, match[1]))) {
      fail(`${relative(ROOT, file)} cites a missing source path: ${match[1]}`);
    }
  }
}

// Check 4: relative markdown links resolve
const MD_LINK = /\[[^\]]*\]\(([^)]+)\)/g;
for (const file of markdownFiles) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(MD_LINK)) {
    const raw = match[1].trim();
    if (/^(https?:|mailto:|tel:|#)/.test(raw)) continue;
    const target = raw.split('#')[0];
    if (!target) continue;
    if (!existsSync(resolve(dirname(file), target))) {
      fail(`${relative(ROOT, file)} has a broken link: ${raw}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`check:docs FAILED — ${errors.length} problem(s)`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`check:docs passed — ${markdownFiles.length} markdown file(s) checked`);
