#!/usr/bin/env node
// Build step, run before staticrypt in the deploy workflow.
//
// content.json is the curated source of truth (kept in git for clean
// editing/diffing), but shipping it as a standalone file means anyone can
// fetch it directly and read every feature's content, bypassing the
// staticrypt password gate on the HTML entirely (the gate only encrypts
// the HTML file it's pointed at).
//
// This embeds each feature's content.json directly into that feature's
// index.html as an inline <script type="application/json">, then deletes
// the standalone content.json from the build output — so once staticrypt
// encrypts the HTML, the data travels inside the same ciphertext. Nothing
// sensitive is left as a separately-fetchable plain file.

import { readFileSync, writeFileSync, readdirSync, rmSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const FEATURES_DIR = 'features';

let count = 0;
for (const slug of readdirSync(FEATURES_DIR)) {
  const dir = join(FEATURES_DIR, slug);
  if (!statSync(dir).isDirectory()) continue;

  const contentPath = join(dir, 'content.json');
  const htmlPath = join(dir, 'index.html');
  if (!existsSync(contentPath) || !existsSync(htmlPath)) continue;

  const content = readFileSync(contentPath, 'utf8');
  JSON.parse(content); // fail loudly on invalid JSON rather than ship broken data

  let html = readFileSync(htmlPath, 'utf8');
  const dataScript = `<script type="application/json" id="feature-data">${content}</script>`;

  if (/<script type="application\/json" id="feature-data">[\s\S]*?<\/script>/.test(html)) {
    html = html.replace(/<script type="application\/json" id="feature-data">[\s\S]*?<\/script>/, dataScript);
  } else if (html.includes('</main>')) {
    html = html.replace('</main>', `  ${dataScript}\n</main>`);
  } else {
    throw new Error(`${htmlPath}: no </main> tag found to inject feature data before`);
  }

  writeFileSync(htmlPath, html);
  rmSync(contentPath);
  count += 1;
  console.log(`Inlined and removed ${contentPath}`);
}

console.log(`Done: ${count} feature page(s) processed.`);
