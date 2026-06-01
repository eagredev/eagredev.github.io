/* The Workbench — tactile device that hosts the three demos. */
const { useState } = React;

const PROJECTS = [
  { id: "inkmd",    nm: "inkmd",    ds: "markdown → pdf, deterministic",        spec: ["pure-python", "zero-dep", "788 tests"], repo: "https://github.com/eagredev/inkmd",
    blurb: "A pure-Python, zero-dependency compiler that turns Markdown into a PDF. Most renderers drag in a headless browser and the system's fonts; inkmd installs in under a second and emits byte-identical output on every platform, every run." },
  { id: "nightjar", nm: "Nightjar", ds: "email agent · human-in-the-loop",     spec: ["DMARC + HOTP", "drafts only", "24/7"],  repo: "https://github.com/eagredev/nightjar",
    blurb: "An always-on email agent that reads the inbox and drafts replies — but never sends on its own. Every message clears DMARC, the principal signs with a one-time code, and inbound mail is treated as untrusted data. Authentication isn't authorization: a human approves before anything leaves." },
  { id: "torch",    nm: "TORCH",    ds: "rom-hacking ide · TorScript \u2192 poryscript",          spec: ["140 modules", "custom dsl", "\u2192 poryscript"], repo: "https://github.com/eagredev/TORCH",
    blurb: "A ROM-hacking IDE built around a terse scripting language for Game Boy Advance events. Write compact TorScript and watch the scene play live, or decompile verbose vanilla scripts back into something half the size — names validated against your project's real headers." },
];

/* The cover that wraps each demo: project name, what it is, the problem it
   solves, and a button to unwrap the live demo behind it. */
function DemoCover({ proj, onOpen, lifting }) {
  return (
    <div className={"cover" + (lifting ? " cover--lift" : "")}>
      <div className="cover-inner">
        <div className="cover-kick"><span className="wb-led" />live · interactive demo</div>
        <h3 className="cover-title">{proj.nm}</h3>
        <div className="cover-tag">{proj.ds}</div>
        <p className="cover-blurb">{proj.blurb}</p>
        <div className="cover-specs">
          {proj.spec.map((s, i) => <span className="cover-spec" key={i}>{s}</span>)}
        </div>
        <div className="cover-actions">
          <button className="btn cover-open" onClick={onOpen}>
            <span className="cover-open-ic">▸</span> open the live demo
          </button>
          <a className="cover-repo" href={proj.repo} target="_blank" rel="noopener">view repo ↗</a>
        </div>
        <div className="cover-foot">runs entirely in your browser — nothing is sent anywhere</div>
      </div>
    </div>
  );
}

/* One demo cell: holds the cover until the visitor unwraps it, then reveals
   the live demo behind. State is per-cell, so an opened tab stays open. */
function DemoCell({ proj, active, children }) {
  const [phase, setPhase] = useState("cover"); // cover → lifting → open

  function open() {
    if (phase !== "cover") return;
    setPhase("lifting");
    setTimeout(() => setPhase("open"), 480);
  }

  return (
    <div className={"demo" + (active ? " active" : "")}>
      {phase !== "cover" && <div className="demo-live">{children}</div>}
      {phase !== "open" && (
        <DemoCover proj={proj} onOpen={open} lifting={phase === "lifting"} />
      )}
    </div>
  );
}

function Workbench() {
  const [tab, setTab] = useState("inkmd");
  // bumping a project's key remounts its cell, bringing the cover back
  const [coverKeys, setCoverKeys] = useState({ inkmd: 0, nightjar: 0, torch: 0 });
  const proj = PROJECTS.find((p) => p.id === tab);

  function pickTab(id) {
    if (id === tab) {
      // re-clicking the active tab re-wraps its demo
      setCoverKeys((k) => ({ ...k, [id]: (k[id] || 0) + 1 }));
    } else {
      setTab(id);
    }
  }

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
            onClick={() => pickTab(p.id)}
          >
            <span className="nm">{p.nm}</span>
            <span className="ds">{p.ds}</span>
          </button>
        ))}
      </div>

      <div className="wb-body">
        <DemoCell key={"inkmd-" + coverKeys.inkmd} proj={PROJECTS[0]} active={tab === "inkmd"}>
          {window.InkmdDemo ? <window.InkmdDemo active={tab === "inkmd"} /> : null}
        </DemoCell>
        <DemoCell key={"nightjar-" + coverKeys.nightjar} proj={PROJECTS[1]} active={tab === "nightjar"}>
          {window.NightjarDemo ? <window.NightjarDemo active={tab === "nightjar"} /> : null}
        </DemoCell>
        <DemoCell key={"torch-" + coverKeys.torch} proj={PROJECTS[2]} active={tab === "torch"}>
          {window.TorchDemo ? <window.TorchDemo active={tab === "torch"} /> : null}
        </DemoCell>
      </div>
    </div>
  );
}

window.Workbench = Workbench;
