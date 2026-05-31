/* The Workbench — tactile device that hosts the three demos. */
const { useState } = React;

const PROJECTS = [
  { id: "inkmd",    nm: "inkmd",    ds: "markdown → pdf, deterministic",        spec: ["pure-python", "zero-dep", "788 tests"], repo: "https://github.com/eagredev/inkmd" },
  { id: "nightjar", nm: "Nightjar", ds: "email agent · human-in-the-loop",     spec: ["DMARC + HOTP", "drafts only", "24/7"],  repo: "https://github.com/eagredev/nightjar" },
  { id: "torch",    nm: "TORCH",    ds: "rom-hacking ide · TorScript \u2192 poryscript",          spec: ["140 modules", "custom dsl", "\u2192 poryscript"], repo: "https://github.com/eagredev/TORCH" },
];

function Workbench() {
  const [tab, setTab] = useState("inkmd");
  const proj = PROJECTS.find((p) => p.id === tab);

  return (
    <div className="workbench">
      <div className="wb-head">
        <span className="wb-led" />
        <span className="wb-title">eagre://<b>workbench</b> — live excerpts from real projects</span>
        <div className="wb-spec">
          {proj.spec.map((s, i) => <span key={i}>{i === 0 ? <b>{s}</b> : s}</span>)}
          <a className="link-pill" style={{ padding: "4px 11px" }} href={proj.repo} target="_blank" rel="noopener">repo ↗</a>
        </div>
      </div>

      <div className="wb-tabs" role="tablist">
        {PROJECTS.map((p) => (
          <button
            key={p.id}
            className="wb-tab"
            role="tab"
            aria-selected={tab === p.id}
            onClick={() => setTab(p.id)}
          >
            <span className="nm">{p.nm}</span>
            <span className="ds">{p.ds}</span>
          </button>
        ))}
      </div>

      <div className="wb-body">
        <div className={"demo " + (tab === "inkmd" ? "active" : "")}>
          {window.InkmdDemo ? <window.InkmdDemo active={tab === "inkmd"} /> : null}
        </div>
        <div className={"demo " + (tab === "nightjar" ? "active" : "")}>
          {window.NightjarDemo ? <window.NightjarDemo active={tab === "nightjar"} /> : null}
        </div>
        <div className={"demo " + (tab === "torch" ? "active" : "")}>
          {window.TorchDemo ? <window.TorchDemo active={tab === "torch"} /> : null}
        </div>
      </div>
    </div>
  );
}

window.Workbench = Workbench;
