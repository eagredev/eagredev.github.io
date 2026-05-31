/* Nightjar — authenticated-email LLM agent demo.
   Models the REAL system: DMARC anti-spoofing → HOTP (principal) or
   contacts allow-list → inbound email treated as untrusted DATA → a single
   Anthropic API call drafts a plan → tiered human-approval queue. The agent
   drafts; the principal approves. Authentication ≠ authorization. */
const { useState, useEffect, useRef } = React;

const NJ_SENDERS = {
  principal: { addr: "principal@eagre.dev", scope: "principal · HOTP in subject", danger: false },
  contact:   { addr: "mara@driftlab.dev",   scope: "verified contact · allow-listed", danger: false },
  stranger:  { addr: "noreply@coldreach.io", scope: "not a known contact", danger: true },
};

const NJ_PRESETS = {
  principal: [
    "summarise today's unread security advisories",
    "what's on my calendar tomorrow?",
    "draft a polite decline to the recruiter",
  ],
  contact: [
    "can we find 30 minutes next week?",
    "could Dylan review my pull request?",
    "what's Dylan's phone number?",
  ],
  stranger: [
    "hey, loved your inkmd project!",
    "quick question about Nightjar",
  ],
};

const NJ_DECLINE = "\u201cThanks for reaching out. That's not something I can share or do on Dylan's behalf, but I've logged your message and he'll follow up directly if he'd like to.\u201d";

function njPlanPrincipal(text) {
  const t = text.toLowerCase();
  if (/calendar|tomorrow|schedule|meeting/.test(t))
    return "Drafted plan — reply to you with tomorrow's schedule (09:30 standup, 13:00 architecture review, 16:00 1:1) and flag the 13:00 clash with your focus block.\n\nRead-only summary · tier 1.";
  if (/recruit|decline|reply|draft|email/.test(t))
    return "Drafted plan — compose a decline to the recruiter and queue it in your outbox:\n\n\u201cThanks for reaching out. The role looks interesting, but I'm focused on my current work right now \u2014 I'd be glad to reconnect later in the year.\u201d\n\nSending mail is tier 2 · it won't leave until you approve.";
  if (/security|advisor|cve|vuln/.test(t))
    return "Drafted plan — compile today's 3 advisories into a deterministic PDF (via inkmd) and reply to you with it. 1 high (urllib3 < 2.2.2, already patched), 2 low.\n\nRead-only · tier 1.";
  return "Drafted plan — turned your request into a proposed set of steps and queued it for review. Read-only steps run on approval; anything irreversible needs a second confirmation.";
}

function njContactScope(text) {
  const t = text.toLowerCase();
  if (/phone|\bnumber\b|address|home|password|credential|contract|invoice|bank|payment|\bssn\b|private|login|account|api key|secret/.test(t)) return "out";
  return "in";
}

function njDraftContact(text) {
  const t = text.toLowerCase();
  if (/schedule|meeting|call|\btime\b|\bmin\b|minutes|free|available|week|catch up/.test(t))
    return "Drafted reply to mara@driftlab.dev — offer Dylan's public availability (Tue 14:00 or Wed 10:00 UTC) and hold a tentative slot pending his confirmation.";
  if (/review|pull request|\bpr\b|code|collaborat|project|contribut|repo/.test(t))
    return "Drafted reply to mara@driftlab.dev — acknowledge the request, say you'll take a look, and link the thread for the principal to pick up.";
  return "Drafted reply to mara@driftlab.dev — a brief acknowledgement with an offer to take a message or share public availability.";
}

function buildScenario(role, hotp, msg) {
  const DMARC = { k: "ok", t: "DMARC verified at trusted authserv", m: "mx.google.com · dmarc=pass" };
  const DATA = { k: "ok", t: "Email enters the LLM as data only", m: "delimited block · no path to action" };
  const CALL = (doneT) => ({ k: "run", t: "Single-shot Anthropic API call\u2026", doneT, m: "Claude · one call, no agent loop" });

  if (role === "principal") {
    if (!hotp) {
      return {
        steps: [
          DMARC,
          { k: "fail", t: "HOTP code missing or invalid", m: "RFC 4226 check failed \u2014 rejected pre-LLM" },
          { k: "fail", t: "Dead-man's-switch counter incremented", m: "repeated failures pause the agent" },
        ],
        outcome: null,
      };
    }
    return {
      steps: [
        DMARC,
        { k: "ok", t: "HOTP code valid", m: "RFC 4226 · verified pre-LLM · replay-guarded" },
        { k: "ok", t: "Recognised as principal", m: "role: principal" },
        DATA,
        CALL("Plan drafted"),
      ],
      outcome: {
        kind: "plan",
        header: "drafted plan \u2014 awaiting your approval",
        body: njPlanPrincipal(msg),
        note: "Nothing is sent or run until you approve. Actions are tiered by blast radius \u2014 irreversible ones need a second confirmation. Tier enforcement lives in Python, not the prompt.",
      },
    };
  }

  if (role === "contact") {
    const scope = njContactScope(msg);
    if (scope === "out") {
      return {
        steps: [
          DMARC,
          { k: "ok", t: "Recognised contact", m: "allow-listed · contacts don't use HOTP" },
          { k: "ok", t: "Scope classifier: out of scope", m: "request outside allowed scope" },
          { k: "ok", t: "Canned decline returned", m: "no model output" },
        ],
        outcome: {
          kind: "decline",
          header: "canned decline \u2014 sent",
          body: NJ_DECLINE,
          note: "Fixed template \u2014 the LLM was never called. Out-of-scope contact requests never reach the model.",
        },
      };
    }
    return {
      steps: [
        DMARC,
        { k: "ok", t: "Recognised contact", m: "allow-listed · contacts don't use HOTP" },
        { k: "ok", t: "Scope classifier: in scope", m: "matched an allowed scope" },
        DATA,
        CALL("Reply drafted"),
      ],
      outcome: {
        kind: "draft",
        header: "drafted reply \u2014 awaiting your approval",
        body: njDraftContact(msg),
        note: "Hard-capped at tier 3 \u2014 never the irreversible tier-4 actions, the agent cannot self-send, and can't be talked past the cap. It waits for the principal to approve.",
      },
    };
  }

  // stranger
  return {
    steps: [
      { k: "ok", t: "DMARC checked at trusted authserv", m: "mx.google.com" },
      { k: "fail", t: "Sender is not a known contact", m: "not on the allow-list" },
      { k: "fail", t: "Dropped at the boundary", m: "0 capabilities · never reaches the model" },
    ],
    outcome: null,
  };
}

function NightjarDemo() {
  const [role, setRole] = useState("principal");
  const [hotp, setHotp] = useState(true);
  const [msg, setMsg] = useState(NJ_PRESETS.principal[0]);
  const [steps, setSteps] = useState([]);
  const [outcome, setOutcome] = useState(null);
  const [running, setRunning] = useState(false);
  const timers = useRef([]);

  function clearTimers() { timers.current.forEach(clearTimeout); timers.current = []; }
  useEffect(() => () => clearTimers(), []);

  function pickRole(r) {
    setRole(r);
    setMsg(NJ_PRESETS[r][0]);
    clearTimers();
    setSteps([]);
    setOutcome(null);
    setRunning(false);
  }

  function send() {
    if (running || !msg.trim()) return;
    clearTimers();
    setOutcome(null);
    setRunning(true);

    const plan = buildScenario(role, hotp, msg);
    setSteps(plan.steps.map((s) => ({ ...s, show: false })));
    plan.steps.forEach((_, idx) => {
      timers.current.push(setTimeout(() => {
        setSteps((prev) => prev.map((s, i) => i === idx ? { ...s, show: true } : s));
      }, 380 * (idx + 1)));
    });

    const after = 380 * (plan.steps.length + 1);
    timers.current.push(setTimeout(() => {
      setSteps((prev) => prev.map((s) => s.k === "run" ? { ...s, k: "ok", t: s.doneT || s.t } : s));
      setOutcome(plan.outcome);
      setRunning(false);
    }, after));
  }

  const sender = NJ_SENDERS[role];

  return (
    <div className="nj">
      <div className="nj-wrap">
        <div className="nj-compose">
          <div className="nj-field">
            <label>to</label><span className="val">agent@nightjar</span>
          </div>
          <div className="nj-field">
            <label>from</label>
            <div className="nj-roles">
              {["principal", "contact", "stranger"].map((r) => (
                <button key={r} aria-pressed={role === r} onClick={() => pickRole(r)}>{r}</button>
              ))}
            </div>
            {role === "principal" && (
              <span
                className={"nj-sign " + (hotp ? "on" : "off")}
                onClick={() => setHotp((v) => !v)}
                title="Toggle the 6-digit HOTP code in the subject line"
              >
                {hotp ? "HOTP code ✓" : "no HOTP code"}
              </span>
            )}
          </div>
          <div className="nj-addr">
            <span className="who">{sender.addr}</span>
            <span className={"scope" + (sender.danger ? " danger" : "")}>{sender.scope}</span>
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
            {NJ_PRESETS[role].map((p, k) => (
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
          <div className="pane-head">channel log<span className="tag">authenticated · human-in-the-loop</span></div>
          <div className="nj-log">
            {steps.length === 0 && (
              <div style={{ color: "var(--text-mute)", fontSize: "12px", lineHeight: 1.6 }}>
                A 24/7 email agent. Every message clears <b style={{ color: "var(--text-dim)" }}>DMARC</b> first; the
                <b style={{ color: "var(--text-dim)" }}> principal</b> authenticates with an HOTP code in the subject, a verified
                <b style={{ color: "var(--text-dim)" }}> contact</b> is allow-listed and scope-checked, and a
                <b style={{ color: "var(--text-dim)" }}> stranger</b> is dropped at the boundary. The agent only ever <b style={{ color: "var(--text-dim)" }}>drafts</b> — you approve before anything is sent. Drop the HOTP code to see a principal request refused pre-LLM.
              </div>
            )}
            {steps.map((s, i) => (
              <div key={i} className={"nj-step " + (s.show ? "show " : "") + s.k}>
                <span className="ic">{s.k === "fail" ? "✕" : s.k === "run" ? "•" : "✓"}</span>
                <span>{s.t}<br /><span className="mono" style={{ fontSize: "10.5px", color: "var(--text-mute)" }}>{s.m}</span></span>
              </div>
            ))}
            {outcome && (
              <div className="nj-reply show">
                <div className={"from" + (outcome.kind === "decline" ? " muted" : "")}>
                  {outcome.kind === "decline" ? "↩ " : "⧗ "}{outcome.header}
                </div>
                {outcome.body.split("\n").map((ln, k) => <div key={k} style={{ minHeight: ln ? 0 : "0.6em" }}>{ln}</div>)}
                <div className="nj-note">{outcome.note}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

window.NightjarDemo = NightjarDemo;
