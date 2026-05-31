/* Nightjar — authenticated-email LLM agent demo.
   Type a request, watch the defence-in-depth pipeline run, get a signed reply.
   Toggle the signature off to see it rejected. */
const { useState, useEffect, useRef } = React;

const NJ_PRESETS = [
  "summarise today's unread security advisories",
  "what's on my calendar tomorrow?",
  "draft a polite decline to the recruiter",
];

function njReply(text) {
  const t = text.toLowerCase();
  if (/calendar|tomorrow|schedule|meeting/.test(t))
    return "Tomorrow you have 3 items: 09:30 standup, 13:00 architecture review (TORCH build pipeline), 16:00 1:1. The 13:00 conflicts with your focus block — want me to move it?";
  if (/recruit|decline|reply|draft|email/.test(t))
    return "Draft ready:\n\n\u201cThanks for reaching out. The role looks interesting, but I'm focused on my current work right now. I'd be glad to reconnect later in the year.\u201d\n\nSend it, or want a warmer tone?";
  if (/security|advisor|cve|vuln/.test(t))
    return "3 advisories matched your stack. 1 high (urllib3 < 2.2.2, you're patched), 2 low. Nothing actionable today. Full digest attached as a deterministic PDF via inkmd.";
  return "Understood. I've queued that and will follow up over this same channel once it's done. Nothing leaves the authenticated boundary.";
}

function NightjarDemo({ active }) {
  const [signed, setSigned] = useState(true);
  const [msg, setMsg] = useState(NJ_PRESETS[0]);
  const [steps, setSteps] = useState([]);
  const [reply, setReply] = useState(null);
  const [running, setRunning] = useState(false);
  const timers = useRef([]);

  function clearTimers() { timers.current.forEach(clearTimeout); timers.current = []; }
  useEffect(() => () => clearTimers(), []);

  function send() {
    if (running || !msg.trim()) return;
    clearTimers();
    setReply(null);
    setRunning(true);

    const ok = signed;
    const pipeline = ok
      ? [
          { k: "ok", t: "Ed25519 signature verified", m: "from: principal@" },
          { k: "ok", t: "Sender on allow-list", m: "policy: trusted" },
          { k: "ok", t: "Intent within capability scope", m: "scope: read+draft" },
          { k: "run", t: "Agent reasoning…", m: "model: local" },
        ]
      : [
          { k: "fail", t: "Signature verification FAILED", m: "no valid Ed25519 sig" },
          { k: "fail", t: "Request dropped at boundary", m: "0 capabilities granted" },
        ];

    setSteps(pipeline.map((s) => ({ ...s, show: false })));
    pipeline.forEach((_, idx) => {
      timers.current.push(setTimeout(() => {
        setSteps((prev) => prev.map((s, i) => i === idx ? { ...s, show: true } : s));
      }, 360 * (idx + 1)));
    });

    const after = 360 * (pipeline.length + 1);
    timers.current.push(setTimeout(() => {
      if (ok) {
        setSteps((prev) => prev.map((s) => s.k === "run" ? { ...s, k: "ok", t: "Reply composed & signed" } : s));
        setReply({ text: njReply(msg), sig: njSig(msg) });
      }
      setRunning(false);
    }, after));
  }

  return (
    <div className="nj">
      <div className="nj-wrap">
        <div className="nj-compose">
          <div className="nj-field">
            <label>to</label><span className="val">agent@nightjar</span>
          </div>
          <div className="nj-field">
            <label>from</label><span className="val">principal@eagre.dev</span>
            <span
              className={"nj-sign " + (signed ? "on" : "off")}
              onClick={() => setSigned((s) => !s)}
              title="Toggle the cryptographic signature"
            >
              {signed ? "🔒 signed" : "⚠ unsigned"}
            </span>
          </div>
          <textarea
            className="editor"
            style={{ fontSize: "12.5px" }}
            spellCheck={false}
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="write to the agent…"
          />
          <div className="nj-presets">
            {NJ_PRESETS.map((p, k) => (
              <button key={k} className="nj-preset" onClick={() => setMsg(p)}>{p.length > 30 ? p.slice(0, 30) + "…" : p}</button>
            ))}
          </div>
          <div className="ctl">
            <button className="btn" onClick={send} disabled={running}>
              {running ? "sending…" : "✉ send"}
            </button>
            <span className="spacer" />
            <span className="chip">defence-in-depth</span>
          </div>
        </div>

        <div className="nj-body">
          <div className="pane-head">channel log<span className="tag">cryptographically authenticated</span></div>
          <div className="nj-log">
            {steps.length === 0 && (
              <div style={{ color: "var(--text-mute)", fontSize: "12px", lineHeight: 1.6 }}>
                A 24/7 autonomous agent reachable only over a signed email channel.
                Send a request — or flip the signature off and watch it get refused at the boundary.
              </div>
            )}
            {steps.map((s, i) => (
              <div key={i} className={"nj-step " + (s.show ? "show " : "") + s.k}>
                <span className="ic">{s.k === "fail" ? "✕" : s.k === "run" ? "•" : "✓"}</span>
                <span>{s.t}<br /><span className="mono" style={{ fontSize: "10.5px", color: "var(--text-mute)" }}>{s.m}</span></span>
              </div>
            ))}
            {reply && (
              <div className={"nj-reply show"}>
                <div className="from">↩ agent@nightjar · re: your request</div>
                {reply.text.split("\n").map((ln, k) => <div key={k} style={{ minHeight: ln ? 0 : "0.6em" }}>{ln}</div>)}
                <div className="sig">signed · {reply.sig}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function njSig(s) {
  const h = window.inkHash(s + "nightjar");
  const h2 = window.inkHash(h + s);
  return ("ed25519:" + h + h2).slice(0, 34) + "…";
}

window.NightjarDemo = NightjarDemo;
