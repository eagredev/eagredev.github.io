/* Page chrome + root app + Tweaks wiring */
const { useState, useEffect } = React;

function Tide({ on }) {
  if (!on) return null;
  return (
    <svg className="tide" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2].map((i) => (
        <path key={i} fill="none" stroke="var(--accent)" strokeOpacity={0.10 - i * 0.025} strokeWidth="1.5"
          d="M0,160 C240,100 480,220 720,160 C960,100 1200,220 1440,160">
          <animate attributeName="d" dur={`${9 + i * 3}s`} repeatCount="indefinite"
            values="M0,160 C240,100 480,220 720,160 C960,100 1200,220 1440,160;
                    M0,160 C240,220 480,100 720,160 C960,220 1200,100 1440,160;
                    M0,160 C240,100 480,220 720,160 C960,100 1200,220 1440,160" />
        </path>
      ))}
      <path fill="url(#tg)"
        d="M0,200 C240,150 480,250 720,200 C960,150 1200,250 1440,200 L1440,320 L0,320 Z">
        <animate attributeName="d" dur="12s" repeatCount="indefinite"
          values="M0,200 C240,150 480,250 720,200 C960,150 1200,250 1440,200 L1440,320 L0,320 Z;
                  M0,200 C240,250 480,150 720,200 C960,250 1200,150 1440,200 L1440,320 L0,320 Z;
                  M0,200 C240,150 480,250 720,200 C960,150 1200,250 1440,200 L1440,320 L0,320 Z" />
      </path>
    </svg>
  );
}

function Git() {
  return (<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.34c-2.23.49-2.7-1.07-2.7-1.07-.36-.93-.89-1.18-.89-1.18-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.23 1.87.87 2.33.67.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.01.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.11.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>);
}
function Mail() {
  return (<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1.5" y="3" width="13" height="10" rx="1.5"/><path d="m2 4 6 4.5L14 4"/></svg>);
}
function In() {
  return (<svg viewBox="0 0 16 16" fill="currentColor"><path d="M3.4 2A1.4 1.4 0 1 0 3.4 4.8 1.4 1.4 0 0 0 3.4 2ZM2.2 6h2.4v8H2.2V6Zm4 0h2.3v1.1h.03c.32-.6 1.1-1.23 2.27-1.23 2.43 0 2.88 1.6 2.88 3.68V14h-2.4v-3.77c0-.9-.02-2.06-1.26-2.06-1.26 0-1.45.98-1.45 2v3.83H6.2V6Z"/></svg>);
}

const ACCENTS = ["#35d6c8", "#7c9cff", "#c8b6ff", "#ffd166", "#ff8c69"];
const FONTS = ["Bricolage Grotesque", "Space Grotesk", "Spline Sans"];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#35d6c8",
  "displayFont": "Bricolage Grotesque",
  "grid": true,
  "tide": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty("--accent", t.accent);
    r.style.setProperty("--font-display", `'${t.displayFont}', system-ui, sans-serif`);
  }, [t.accent, t.displayFont]);

  return (
    <div className={"stage" + (t.grid ? "" : " no-grid")}>
      <Tide on={t.tide} />

      <header className="topbar">
        <div className="wordmark">
          <span className="logo">eagre<span className="dot">.</span></span>
          <span className="role">Dylan Moir · Python · LLM agents · dev tooling</span>
        </div>
        <div className="topright">
          <a className="nav-link" href="about.html">about</a>
          <a className="nav-link" href="blog/index.html">upstream</a>
          <span className="nav-div"></span>
          <a className="link-pill" href="https://github.com/eagredev" target="_blank" rel="noopener"><Git /> <span>github</span></a>
          <a className="link-pill" href="https://www.linkedin.com/in/dylanmoir/" target="_blank" rel="noopener"><In /> <span>linkedin</span></a>
          <a className="link-pill" href="mailto:eagre.dev@gmail.com"><Mail /> <span>email</span></a>
        </div>
      </header>

      <main className="centerwrap">
        <Workbench />
      </main>

      <footer className="botbar">
        <div className="bottomline">
          I architect the work, direct AI tooling to build it, and review every output. <em>eagre — the tidal bore: the wave that runs upstream against the current.</em>
        </div>
        <div className="bottomright"><a className="up-link" href="blog/index.html">read upstream ↗</a><br />the eagre log</div>
      </footer>

      <TweaksPanel>
        <TweakSection label="Accent" />
        <TweakColor label="Tide accent" value={t.accent} options={ACCENTS}
          onChange={(v) => setTweak("accent", v)} />
        <TweakSection label="Type" />
        <TweakSelect label="Display font" value={t.displayFont} options={FONTS}
          onChange={(v) => setTweak("displayFont", v)} />
        <TweakSection label="Texture" />
        <TweakToggle label="Grid field" value={t.grid} onChange={(v) => setTweak("grid", v)} />
        <TweakToggle label="Tide motion" value={t.tide} onChange={(v) => setTweak("tide", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
