#!/usr/bin/env node
// Build step, run before staticrypt in the deploy workflow.
//
// content.json is the curated source of truth (kept in git for clean
// editing/diffing), but shipping it as a standalone file means anyone can
// fetch it directly and read the real content, bypassing whatever password
// gate protects the HTML page entirely — the gate only encrypts the HTML
// file it's pointed at, never a separate file the page happens to fetch.
//
// This embeds each page's content.json directly into that page's index.html
// as an inline <script type="application/json">, then deletes the
// standalone content.json from the build output — so once staticrypt
// encrypts the HTML, the data travels inside the same ciphertext. Nothing
// sensitive is left as a separately-fetchable plain file, anywhere under
// features/, briefing/, or blog/.
//
// Two area shapes:
//   nested — <area>/<slug>/{index.html,content.json}  (features, blog/<date>)
//   single — <area>/{index.html,content.json}          (briefing, blog index)

import { readFileSync, writeFileSync, readdirSync, rmSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const AREAS = [
  { dir: 'features', shape: 'nested' },
  { dir: 'briefing', shape: 'single' },
  { dir: 'blog', shape: 'single' }, // the blog index page itself (list of dates)
  { dir: 'blog', shape: 'nested' }, // each blog/<date>/ archive entry
];

function inlineOne(dir) {
  const contentPath = join(dir, 'content.json');
  const htmlPath = join(dir, 'index.html');
  if (!existsSync(contentPath) || !existsSync(htmlPath)) return false;

  const content = readFileSync(contentPath, 'utf8');
  JSON.parse(content); // fail loudly on invalid JSON rather than ship broken data

  let html = readFileSync(htmlPath, 'utf8');
  const dataScript = `<script type="application/json" id="page-data">${content}</script>`;

  if (/<script type="application\/json" id="page-data">[\s\S]*?<\/script>/.test(html)) {
    html = html.replace(/<script type="application\/json" id="page-data">[\s\S]*?<\/script>/, dataScript);
  } else if (html.includes('</main>')) {
    html = html.replace('</main>', `  ${dataScript}\n</main>`);
  } else {
    throw new Error(`${htmlPath}: no </main> tag found to inject page data before`);
  }

  writeFileSync(htmlPath, html);
  rmSync(contentPath);
  return true;
}

let count = 0;
for (const { dir, shape } of AREAS) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;

  if (shape === 'single') {
    if (inlineOne(dir)) { count += 1; console.log(`Inlined and removed ${join(dir, 'content.json')}`); }
    continue;
  }

  // nested: each immediate subdirectory is its own page
  for (const slug of readdirSync(dir)) {
    const sub = join(dir, slug);
    if (!statSync(sub).isDirectory()) continue;
    if (inlineOne(sub)) { count += 1; console.log(`Inlined and removed ${join(sub, 'content.json')}`); }
  }
}

console.log(`Done: ${count} page(s) processed.`);
