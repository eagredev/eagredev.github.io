#!/usr/bin/env node
/*
  build-seo.js — regenerate the machine-readable (crawler/LLM) content block
  in blog/index.html from blog/posts.js.

  It reuses the site's OWN Markdown renderer (js/markdown.js) so the embedded
  HTML matches what visitors actually see. The block is written between the
  <!-- SEO-BLOCK:START --> / <!-- SEO-BLOCK:END --> sentinels and is hidden
  from human visitors via the `hidden` attribute.

  Run locally:   node scripts/build-seo.js
  Or just push:  the GitHub Action (.github/workflows/seo.yml) runs it for you.
*/

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// The site's scripts assign to `window.*`; give them a browser-like global.
global.window = global.window || {};
eval(read("js/markdown.js"));   // -> window.renderMarkdown
eval(read("blog/posts.js"));    // -> window.POSTS
const render = window.renderMarkdown;
const posts = window.POSTS || [];

if (typeof render !== "function") {
  console.error("[build-seo] window.renderMarkdown not found — aborting.");
  process.exit(1);
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmtDate = (s) =>
  new Date(s + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const articles = posts
  .map((p) => {
    const tags = (p.tags || []).join(", ");
    const meta = `${fmtDate(p.date)} · ${p.mins} min read${tags ? " · " + tags : ""}`;
    const body = render(p.body)
      .split("\n")
      .map((l) => "      " + l)
      .join("\n");
    return `    <article>
      <h2>${esc(p.title)}</h2>
      <p><em>${esc(meta)}</em></p>
      <p>${esc(p.dek)}</p>
${body}
    </article>`;
  })
  .join("\n\n");

const block = `  <!-- SEO-BLOCK:START — generated from blog/posts.js by scripts/build-seo.js. Do not edit by hand; run \`node scripts/build-seo.js\` (or just push — the GitHub Action does it). -->
  <div id="seo-content" hidden>
    <p>Full text of the Upstream log — notes on building developer tooling and LLM agents by directing AI end to end, by Dylan Moir (Eagre).</p>

${articles}
  </div>
  <!-- SEO-BLOCK:END -->`;

const FILE = "blog/index.html";
let html = read(FILE);

const sentinelRe = /[ \t]*<!-- SEO-BLOCK:START[\s\S]*?<!-- SEO-BLOCK:END -->/;
if (sentinelRe.test(html)) {
  html = html.replace(sentinelRe, block);
} else if (html.includes('<body class="up">\n')) {
  html = html.replace('<body class="up">\n', '<body class="up">\n' + block + "\n\n");
} else {
  console.error('[build-seo] could not find sentinels or <body class="up"> — aborting.');
  process.exit(1);
}

fs.writeFileSync(path.join(ROOT, FILE), html);
console.log(`[build-seo] embedded ${posts.length} post(s) into ${FILE} (${html.length} bytes).`);
