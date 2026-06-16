#!/usr/bin/env node
// Build ug-columns/dist/index.html from src/ug-columns.js.
//
// Pipeline: read source -> light minify (strip line comments + collapse runs
// of whitespace, while preserving string literals and regex literals) ->
// URL-encode -> wrap as `javascript:(()=>{<min>})();void 0` -> inject into
// index.html as the draggable link's href and the copy-paste source block.
//
// No external deps. Modern browsers accept bookmarklets up to ~64KB; minified
// here we land at ~6KB.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const srcPath = join(here, 'src', 'ug-columns.js');
const distDir = join(here, 'dist');
const outPath = join(distDir, 'index.html');

const src = readFileSync(srcPath, 'utf8');

function minify(input) {
  // Walk char-by-char, preserving strings (', ", `), regex literals, and the
  // contents of // and /* */ comments are dropped. Then collapse whitespace
  // runs to a single space, and trim around punctuation that doesn't need it.
  let out = '';
  let i = 0;
  const n = input.length;
  // Track previous non-space, non-comment significant char to disambiguate
  // regex literals from division.
  let prevSig = '';
  // Chars after which `/` starts a regex (operator-ish or none).
  const regexStarters = new Set([
    '', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';',
    '+', '-', '*', '~', '<', '>', '^', '%', '/', '\n'
  ]);
  while (i < n) {
    const c = input[i];
    // Line comment
    if (c === '/' && input[i + 1] === '/') {
      while (i < n && input[i] !== '\n') i++;
      continue;
    }
    // Block comment
    if (c === '/' && input[i + 1] === '*') {
      i += 2;
      while (i < n && !(input[i] === '*' && input[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    // String literal
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += c;
      i++;
      while (i < n) {
        const ch = input[i];
        out += ch;
        i++;
        if (ch === '\\' && i < n) { out += input[i]; i++; continue; }
        if (ch === quote) break;
      }
      prevSig = quote;
      continue;
    }
    // Regex literal
    if (c === '/' && regexStarters.has(prevSig)) {
      out += c;
      i++;
      let inClass = false;
      while (i < n) {
        const ch = input[i];
        out += ch;
        i++;
        if (ch === '\\' && i < n) { out += input[i]; i++; continue; }
        if (ch === '[') inClass = true;
        else if (ch === ']') inClass = false;
        else if (ch === '/' && !inClass) break;
      }
      // Flags
      while (i < n && /[a-z]/.test(input[i])) { out += input[i]; i++; }
      prevSig = '/';
      continue;
    }
    out += c;
    if (!/\s/.test(c)) prevSig = c;
    i++;
  }
  // Collapse whitespace runs (outside strings/regex — already preserved).
  // Replace any whitespace sequence with a single space.
  let collapsed = out.replace(/[\s\n]+/g, ' ');
  // Trim spaces around punctuation that doesn't need adjacency to identifiers.
  // Conservative set; we keep spaces around `+`, `-`, `*`, `/` to avoid issues
  // (e.g. `a + +b` becoming `a++b`, `a - -b` becoming `a--b`).
  collapsed = collapsed.replace(/ ?([{}();,:=<>?!&|]) ?/g, '$1');
  return collapsed.trim();
}

const minified = minify(src);
const wrapped = '(() => { ' + minified + ' })();void 0';
const bookmarkletHref = 'javascript:' + encodeURIComponent(wrapped);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>UG Columns — bookmarklet</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.5 system-ui, -apple-system, Segoe UI, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
  h1 { font-size: 1.4rem; }
  .drag {
    display: inline-block; padding: 8px 14px; background: #1a1a1a; color: #fff;
    text-decoration: none; border-radius: 4px; font-weight: 600; cursor: grab;
    box-shadow: 0 1px 3px rgba(0,0,0,.2);
  }
  .drag:hover { background: #333; }
  pre { background: #f4f4f4; color: #111; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 11px; }
  @media (prefers-color-scheme: dark) {
    body { background: #111; color: #ddd; }
    pre { background: #1e1e1e; color: #ddd; }
    .drag { background: #fff; color: #000; }
    .drag:hover { background: #ccc; }
  }
  ol li { margin: 0.4rem 0; }
  code.k { background: rgba(127,127,127,.15); padding: 0 4px; border-radius: 2px; }
</style>
</head>
<body>

<h1>UG Columns</h1>

<p>A bookmarklet that re-flows Ultimate Guitar chord pages into multiple columns,
with chord+lyric pairs kept together. Settings are remembered per-tab in
<code class="k">localStorage</code>. No extension required.</p>

<h2>Install</h2>

<p>Drag this link to your bookmarks bar:</p>

<p><a class="drag" href="${bookmarkletHref}">UG&nbsp;Columns</a></p>

<h2>Use</h2>

<ol>
  <li>Open any chord page on <code class="k">ultimate-guitar.com</code>.</li>
  <li>Click the <strong>UG Columns</strong> bookmark.</li>
  <li>Use the action bar to adjust columns, width, font, and transpose.
      Tuning, key, and capo are shown for reference.</li>
  <li>Click <strong>×</strong> to reload the page (back to UG's normal view).</li>
</ol>

<h2>Console fallback</h2>

<p>If your browser strips bookmarklet URLs (some Safari profiles do), copy the
source below and paste it into the DevTools Console on the chord page:</p>

<pre><code id="src"></code></pre>

<script>
  // Inject the un-minified source for copy-paste — readable, easy to tweak.
  document.getElementById('src').textContent = ${JSON.stringify(src)};
</script>

</body>
</html>
`;

mkdirSync(distDir, { recursive: true });
writeFileSync(outPath, html, 'utf8');

console.log(
  'Built ' + outPath + '\n' +
  '  source:    ' + src.length + ' bytes\n' +
  '  minified:  ' + minified.length + ' bytes\n' +
  '  href len:  ' + bookmarkletHref.length + ' bytes (incl. javascript: + url-encoding)'
);
