/* Minimal CommonMark-ish renderer for the inkmd demo.
   Not the real engine — a faithful-enough JS approximation so the
   live preview behaves like inkmd's output. Exposed as window.renderMarkdown. */
(function () {
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function inline(s) {
    // escape first
    s = esc(s);
    // code spans
    s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
    // images -> skip to alt (demo)
    s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1");
    // links
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
      (_, t, u) => `<a href="${u}">${t}</a>`);
    // bold
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    // italic
    s = s.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, "$1<em>$2</em>");
    s = s.replace(/(^|[^_])_([^_\s][^_]*?)_/g, "$1<em>$2</em>");
    // strikethrough
    s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    // autolink bare urls
    s = s.replace(/(^|[\s(])((?:https?:\/\/|www\.)[^\s<)]+)/g,
      (m, pre, u) => `${pre}<a href="${u}">${u}</a>`);
    return s;
  }

  function renderMarkdown(src) {
    const lines = src.replace(/\r\n/g, "\n").split("\n");
    let out = [];
    let i = 0;

    function flushTable(start) {
      // start points at header row, start+1 is delimiter
      const rows = [];
      let j = start;
      while (j < lines.length && /\|/.test(lines[j]) && lines[j].trim() !== "") {
        rows.push(lines[j]);
        j++;
      }
      if (rows.length < 2 || !/^[\s|:-]+$/.test(rows[1])) return null;
      const split = (r) => r.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map(c => c.trim());
      const head = split(rows[0]);
      const aligns = split(rows[1]).map(c => {
        const l = c.startsWith(":"), r = c.endsWith(":");
        return l && r ? "center" : r ? "right" : l ? "left" : "left";
      });
      let html = "<table><thead><tr>";
      head.forEach((h, k) => html += `<th style="text-align:${aligns[k]||"left"}">${inline(h)}</th>`);
      html += "</tr></thead><tbody>";
      for (let k = 2; k < rows.length; k++) {
        const cells = split(rows[k]);
        html += "<tr>";
        cells.forEach((c, ci) => html += `<td style="text-align:${aligns[ci]||"left"}">${inline(c)}</td>`);
        html += "</tr>";
      }
      html += "</tbody></table>";
      return { html, next: j };
    }

    while (i < lines.length) {
      let line = lines[i];

      // blank
      if (line.trim() === "") { i++; continue; }

      // fenced code
      const fence = line.match(/^```(\w*)/);
      if (fence) {
        let code = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
        i++; // closing fence
        out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
        continue;
      }

      // heading
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        const lvl = Math.min(h[1].length, 6);
        out.push(`<h${lvl}>${inline(h[2].replace(/\s*#+\s*$/, ""))}</h${lvl}>`);
        i++; continue;
      }

      // hr
      if (/^(\s*[-*_]){3,}\s*$/.test(line)) { out.push("<hr>"); i++; continue; }

      // table
      if (/\|/.test(line) && i + 1 < lines.length && /^[\s|:-]+$/.test(lines[i + 1])) {
        const t = flushTable(i);
        if (t) { out.push(t.html); i = t.next; continue; }
      }

      // blockquote
      if (/^\s*>/.test(line)) {
        let q = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) {
          q.push(lines[i].replace(/^\s*>\s?/, "")); i++;
        }
        out.push(`<blockquote>${renderMarkdown(q.join("\n"))}</blockquote>`);
        continue;
      }

      // lists
      if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
        const ordered = /^\s*\d+\./.test(line);
        let items = [];
        while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
          let item = lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, "");
          // task list
          const task = item.match(/^\[([ xX])\]\s+(.*)$/);
          if (task) {
            const checked = task[1].toLowerCase() === "x";
            item = `<span style="display:inline-block;width:11px;height:11px;border:1px solid #9b998f;border-radius:3px;margin-right:6px;vertical-align:-1px;${checked ? "background:#1a52c4;border-color:#1a52c4;" : ""}"></span>${inline(task[2])}`;
            items.push(`<li style="list-style:none;margin-left:-1.1em">${item}</li>`);
          } else {
            items.push(`<li>${inline(item)}</li>`);
          }
          i++;
        }
        const tag = ordered ? "ol" : "ul";
        out.push(`<${tag}>${items.join("")}</${tag}>`);
        continue;
      }

      // paragraph (gather until blank / block start)
      let para = [];
      while (i < lines.length && lines[i].trim() !== "" &&
             !/^(#{1,6}\s|```|\s*>|\s*([-*+]|\d+\.)\s)/.test(lines[i]) &&
             !/^(\s*[-*_]){3,}\s*$/.test(lines[i])) {
        para.push(lines[i]); i++;
      }
      if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    }

    return out.join("\n");
  }

  // tiny deterministic hash (FNV-1a) so the "byte-identical" chip is stable per input
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let k = 0; k < str.length; k++) {
      h ^= str.charCodeAt(k);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ("00000000" + h.toString(16)).slice(-8);
  }

  window.renderMarkdown = renderMarkdown;
  window.inkHash = fnv1a;
})();
