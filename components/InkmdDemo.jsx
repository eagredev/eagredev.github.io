/* inkmd — live markdown → "PDF page" compile demo */
const { useState, useEffect, useRef, useMemo } = React;

const INKMD_SAMPLE = `# Quarterly Report

Compiled with **inkmd** — pure-Python, zero
dependencies, *byte-deterministic*.

## Highlights

- Render is ~6x faster than WeasyPrint
- Installs in under a second (~10 MB)
- Runs on Lambda, Alpine, ~~a Steam Deck~~ anything

> No Chrome binary. No \`apt-get\`. No system fonts.

| Metric        | inkmd  | Ratio       |
| ------------- | ------ | ----------- |
| Install size  | 10.5MB | 7.1x smaller|
| Cold render   | 132ms  | 6.2x faster |

\`\`\`python
import inkmd
pdf = inkmd.compile(md_text)
inkmd.render_file("in.md", "out.pdf")
\`\`\`

Same input → same bytes. Every platform, every run.
Docs at https://pypi.org/project/inkmd/
`;

function InkmdDemo({ active }) {
  const [src, setSrc] = useState(INKMD_SAMPLE);
  const [compiling, setCompiling] = useState(false);
  const [pages, setPages] = useState(1);
  const html = useMemo(() => window.renderMarkdown(src), [src]);
  const hash = useMemo(() => window.inkHash(src), [src]);
  const ms = useMemo(() => (118 + (src.length % 60)), [src]);
  const pageRef = useRef(null);

  useEffect(() => {
    if (pageRef.current) {
      const h = pageRef.current.scrollHeight;
      setPages(Math.max(1, Math.ceil(h / 560)));
    }
  }, [html]);

  function compile() {
    setCompiling(true);
    setTimeout(() => setCompiling(false), 620);
  }

  return (
    <div className="split">
      <div className="pane">
        <div className="pane-head">
          in.md
          <span className="tag">markdown</span>
        </div>
        <textarea
          className="editor"
          spellCheck={false}
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          aria-label="markdown source"
        />
      </div>
      <div className="pane">
        <div className="pane-head">
          out.pdf
          <span className="tag">{pages} page{pages > 1 ? "s" : ""} · {ms}ms</span>
        </div>
        <div className="pane-scroll" style={{ background: "#0a0c0f" }}>
          <div
            className="ink-page"
            ref={pageRef}
            style={{ transition: "filter .3s", filter: compiling ? "blur(2px) brightness(.9)" : "none" }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
        <div className="ctl">
          <button className="btn" onClick={compile}>
            {compiling ? "compiling…" : "▸ compile"}
          </button>
          <span className="chip" title="FNV hash standing in for inkmd's deterministic output">
            <b>sha:</b><span className="hash">{compiling ? "········" : hash}</span>
          </span>
          <span className="spacer" />
          <span className="chip"><span className="kbd">edit ↑</span>&nbsp;live</span>
        </div>
      </div>
    </div>
  );
}

window.InkmdDemo = InkmdDemo;
