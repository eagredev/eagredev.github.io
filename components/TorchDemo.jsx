/* TORCH — TorScript DSL ↔ Poryscript, with a live GBA preview.
   A toy of the real bidirectional compiler in the ROM-hacking IDE.
   - preview:   write real TorScript — alias / label / bare "strings" — and watch
                the scene step through in-game, with a gutter arrow on the running line.
   - decompile: the reverse — verbose vanilla .inc collapses back into TorScript. */
const { useState, useEffect, useMemo } = React;

const TORCH_SAMPLE = `@ object event: Player at 6,3, facing down
@ object event: Bram at 3,3, facing down
alias player Player
alias bram npc1

label Bram
    lock
    "The tide turned overnight."
    "The river's running backwards!"
    bram walk right 2
    player face left
    "Take this!"
    give ITEM_HM03
    release
    end`;

/* Decompile demo: real, verbose vanilla decomp Poryscript/.inc on the left,
   the terse TorScript it decompiles to on the right. The reduction badge is
   computed from these exact strings so it stays honest to what's on screen. */
const TORCH_DECOMPILE_IN = `@ data/maps/Eagre_Route/scripts.inc

Eagre_Route_EventScript_Bram::
\tlock
\tmsgbox Eagre_Route_Text_Bram1, MSGBOX_DEFAULT
\tmsgbox Eagre_Route_Text_Bram2, MSGBOX_DEFAULT
\tapplymovement LOCALID_BRAM, Eagre_Route_Movement_BramApproach
\twaitmovement 0
\tapplymovement LOCALID_PLAYER, Eagre_Route_Movement_PlayerTurn
\twaitmovement 0
\tmsgbox Eagre_Route_Text_Bram3, MSGBOX_DEFAULT
\tgiveitem ITEM_HM03
\tgoto_if_eq VAR_RESULT, FALSE, Eagre_Route_EventScript_BagFull
\tsetflag FLAG_RECEIVED_HM03_EAGRE
\trelease
\tend

Eagre_Route_EventScript_BagFull::
\tmsgbox Eagre_Route_Text_BagFull, MSGBOX_DEFAULT
\trelease
\tend

Eagre_Route_Movement_BramApproach:
\twalk_right
\twalk_right
\tstep_end

Eagre_Route_Movement_PlayerTurn:
\tface_left
\tstep_end

Eagre_Route_Text_Bram1:
\t.string "The tide turned overnight.$"

Eagre_Route_Text_Bram2:
\t.string "The river's running backwards!$"

Eagre_Route_Text_Bram3:
\t.string "Take this!$"

Eagre_Route_Text_BagFull:
\t.string "Your bag is full.$"`;

const TORCH_DECOMPILE_OUT = `alias bram LOCALID_BRAM
alias player LOCALID_PLAYER

label Bram
    lock
    "The tide turned overnight."
    "The river's running backwards!"
    bram walk right 2
    player face left
    "Take this!"
    give ITEM_HM03
    flag set FLAG_RECEIVED_HM03_EAGRE
    end`;

const DECOMP_V = TORCH_DECOMPILE_IN.trim().split("\n").length;
const DECOMP_T = TORCH_DECOMPILE_OUT.trim().split("\n").length;
const DECOMP_PCT = Math.round((1 - DECOMP_T / DECOMP_V) * 100);

const INC_KW = ["lock", "faceplayer", "copyobjectxytoperm", "msgbox", "applymovement", "waitmovement", "setvar", "release", "end", "goto_if_set", "goto_if_unset", "walk_left", "walk_right", "walk_up", "walk_down", "face_player", "step_end"];
const TOR_KW = ["alias", "label", "lock", "faceplayer", "walk", "face", "var", "set", "give", "release", "end"];

const DIR_ARROW = { up: "↑", down: "↓", left: "←", right: "→" };
const DIR_DELTA = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const snapshot = (pos) => {
  const out = {};
  for (const k in pos) out[k] = { x: pos[k].x, y: pos[k].y, face: pos[k].face };
  return out;
};
function faceToward(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.abs(dy) >= Math.abs(dx)) return dy >= 0 ? "down" : "up";
  return dx >= 0 ? "right" : "left";
}

/* Known project constants — a small, honest stand-in for the real compiler's
   validation, which checks names against the project's actual header files.
   (The browser demo can't read your headers; this illustrates the behaviour.) */
const KNOWN_ITEMS = new Set(["ITEM_POTION", "ITEM_SUPER_POTION", "ITEM_HYPER_POTION", "ITEM_MAX_POTION", "ITEM_FULL_RESTORE", "ITEM_REVIVE", "ITEM_RARE_CANDY", "ITEM_POKE_BALL", "ITEM_GREAT_BALL", "ITEM_ULTRA_BALL", "ITEM_MASTER_BALL", "ITEM_ANTIDOTE", "ITEM_AWAKENING", "ITEM_ESCAPE_ROPE", "ITEM_REPEL", "ITEM_NUGGET", "ITEM_EXP_SHARE", "ITEM_AMULET_COIN", "ITEM_LEFTOVERS", "ITEM_OLD_ROD", "ITEM_GOOD_ROD", "ITEM_SUPER_ROD", "ITEM_HM01", "ITEM_HM02", "ITEM_HM03", "ITEM_HM04", "ITEM_HM05", "ITEM_HM06", "ITEM_HM07", "ITEM_HM08", "ITEM_TM01", "ITEM_TM26", "ITEM_TM50"]);
const KNOWN_FLAGS = new Set(["FLAG_RECEIVED_HM03_EAGRE", "FLAG_RECEIVED_RUNNING_SHOES", "FLAG_SYS_POKEDEX_GET", "FLAG_BADGE01_GET", "FLAG_BADGE02_GET", "FLAG_HIDE_MOSSDEEP_GUARD", "FLAG_TEMP_1", "FLAG_TEMP_2", "FLAG_TEMP_3"]);

function editDist(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return dp[m][n];
}
function suggestName(word, set) {
  let best = null, bd = Infinity;
  for (const c of set) { const d = editDist(word, c); if (d < bd) { bd = d; best = c; } }
  return best && bd <= Math.max(2, Math.ceil(word.length * 0.34)) ? best : null;
}

/* Parse real TorScript into a placed cast + an ordered playback timeline.
   Each timeline frame carries the source line it came from (for the gutter
   arrow) and a snapshot of every actor's position/facing at that moment. */
function compileTorScript(src) {
  const rawLines = src.split("\n");
  const errors = [];
  const actors = {};   // lowercased name -> { name, x, y, face }
  const order = [];    // placement order (lowercased keys)

  // pass 1 — placements (object-event data lives in comments, not the script)
  rawLines.forEach((raw) => {
    const line = raw.trim();
    const m = line.match(/^@\s*object event:\s*(\w+)\s+at\s+(\d+)\s*,\s*(\d+)\s*,\s*facing\s+(up|down|left|right)\b/i);
    if (m) {
      const key = m[1].toLowerCase();
      if (!actors[key]) order.push(key);
      actors[key] = { name: m[1], x: clamp(+m[2], 0, 9), y: clamp(+m[3], 0, 6), face: m[4].toLowerCase() };
    }
  });

  const playerKey = order.find((k) => /^(player|you)$/i.test(actors[k].name)) || null;

  // pass 2 — statements -> timeline
  const timeline = [];
  let walker = null;
  let currentLabel = null;
  const pos = {};
  order.forEach((k) => { pos[k] = { x: actors[k].x, y: actors[k].y, face: actors[k].face }; });

  rawLines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;
    const srcLine = idx + 1;
    let m;

    if (/^@/.test(line) || /^(#|\/\/)/.test(line)) return;          // comments
    if (/^alias\s+\w+\s+\w+$/i.test(line)) return;                  // alias defs
    if ((m = line.match(/^label\s+(\w+)$/i))) { currentLabel = m[1]; return; }  // dialogue is scoped to this actor
    if (/^(end|lock|release)$/i.test(line)) return;                // recognised no-ops
    if (/^faceplayer$/i.test(line)) return;                        // bare no-op

    // bare quoted string -> a dialogue line, spoken by the current label's actor
    if ((m = line.match(/^"([^"]*)"$/))) {
      const spKey = currentLabel ? currentLabel.toLowerCase() : null;
      const speaker = (spKey && actors[spKey]) ? actors[spKey].name : currentLabel;
      timeline.push({ kind: "say", srcLine, snap: snapshot(pos), text: m[1], speaker });
      return;
    }

    // <actor> faceplayer  -> turn toward the player
    if ((m = line.match(/^(\w+)\s+faceplayer$/i))) {
      const who = m[1].toLowerCase();
      if (pos[who] && playerKey && pos[playerKey]) pos[who].face = faceToward(pos[who], pos[playerKey]);
      timeline.push({ kind: "turn", srcLine, who, snap: snapshot(pos) });
      return;
    }

    // <actor> walk <dir> <dir>…   or   <actor> walk <dir> <count>
    if ((m = line.match(/^(\w+)\s+walk\s+(.+)$/i))) {
      const who = m[1].toLowerCase();
      const toks = m[2].split(/[\s,]+/).filter(Boolean).map((t) => t.toLowerCase());
      let dirs;
      if (toks.length === 2 && DIR_DELTA[toks[0]] && /^\d+$/.test(toks[1])) {
        dirs = Array(clamp(+toks[1], 0, 20)).fill(toks[0]);
      } else {
        const bad = toks.find((d) => !DIR_DELTA[d]);
        if (bad) { errors.push({ n: srcLine, line, why: `unknown direction "${bad}"` }); return; }
        dirs = toks;
      }
      if (!walker) walker = who;
      dirs.forEach((d) => {
        if (pos[who]) {
          const [dx, dy] = DIR_DELTA[d];
          pos[who] = { x: clamp(pos[who].x + dx, 0, 9), y: clamp(pos[who].y + dy, 0, 6), face: d };
        }
        timeline.push({ kind: "move", srcLine, who, snap: snapshot(pos) });
      });
      return;
    }

    // <actor> face <dir|player>
    if ((m = line.match(/^(\w+)\s+face\s+(up|down|left|right|player)$/i))) {
      const who = m[1].toLowerCase();
      const f = m[2].toLowerCase();
      if (pos[who]) {
        if (f === "player" && playerKey && pos[playerKey]) pos[who].face = faceToward(pos[who], pos[playerKey]);
        else if (f !== "player") pos[who].face = f;
      }
      timeline.push({ kind: "turn", srcLine, who, snap: snapshot(pos) });
      return;
    }

    // flag set FLAG_*  — validated against the known flags (no preview effect)
    if ((m = line.match(/^flag\s+set\s+(\w+)$/i))) {
      const fl = m[1].toUpperCase();
      if (!KNOWN_FLAGS.has(fl)) {
        const sug = suggestName(fl, KNOWN_FLAGS);
        errors.push({ n: srcLine, line, why: `unknown flag "${fl}"` + (sug ? ` \u2014 did you mean ${sug}?` : "") });
      }
      return;
    }

    // give ITEM_* [count]  — validated against the known items
    if ((m = line.match(/^give\s+(\w+)(?:\s+\d+)?$/i))) {
      const it = m[1].toUpperCase();
      if (!KNOWN_ITEMS.has(it)) {
        const sug = suggestName(it, KNOWN_ITEMS);
        errors.push({ n: srcLine, line, why: `unknown item "${it}"` + (sug ? ` \u2014 did you mean ${sug}?` : "") });
        return;
      }
      timeline.push({ kind: "give", srcLine, item: it, snap: snapshot(pos) });
      return;
    }

    errors.push({ n: srcLine, line, why: "unrecognised statement" });
  });

  if (!walker) {
    const t = timeline.find((f) => f.who);
    walker = t ? t.who : (order.find((k) => k !== playerKey) || order[0] || null);
  }

  return { actors, order, timeline, walker, playerKey, errors };
}

/* Generic highlighter — vanilla .inc (keywords + :: labels + ALL_CAPS consts)
   and TorScript (used for the decompile output and the preview source view). */
function highlightCode(code, keywords) {
  const kw = new RegExp("\\b(" + keywords.join("|") + ")\\b", "g");
  return code.split("\n").map((line) => {
    let s = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (/^\s*@/.test(s)) return '<span class="c">' + s + "</span>";
    const strings = [];
    s = s.replace(/"[^"]*"/g, (m) => { strings.push(m); return "\uE000"; });
    s = s.replace(/(^\s*)(\.\w+)/, '$1<span class="k">$2</span>');
    s = s.replace(/^(\w+)(::?)/, '<span class="n">$1</span>$2');
    s = s.replace(kw, '<span class="k">$1</span>');
    s = s.replace(/\b([A-Z][A-Z0-9_]{2,})\b/g, '<span class="n">$1</span>');
    s = s.replace(/\b(\d+)\b/g, '<span class="n">$1</span>');
    let k = 0;
    s = s.replace(/\uE000/g, () => '<span class="s">' + strings[k++] + "</span>");
    return s;
  }).join("\n");
}

function TorchDemo() {
  const [src, setSrc] = useState(TORCH_SAMPLE);
  const [view, setView] = useState("preview");
  const [editing, setEditing] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const [instant, setInstant] = useState(true);

  const { actors, order, timeline, walker, playerKey, errors } = useMemo(() => compileTorScript(src), [src]);
  const timelineKey = useMemo(() => timeline.map((f) => f.kind + f.srcLine + (f.text || "") + (f.item || "")).join("|"), [timeline]);

  // sequential, step-driven playback: each frame plays for a kind-dependent
  // duration, then advances; a longer hold on the final frame before looping.
  useEffect(() => {
    if (editing || view !== "preview" || timeline.length === 0) return;
    let i = 0;
    let t;
    setFrameIdx(0);
    setInstant(true);
    const durOf = (f) => f.kind === "say" ? 1900 : f.kind === "give" ? 1600 : f.kind === "move" ? 660 : 600;
    const run = () => {
      const extra = i === timeline.length - 1 ? 1100 : 0;
      t = setTimeout(() => {
        const next = (i + 1) % timeline.length;
        setInstant(next === 0);   // looping back to the start teleports — no slide-back
        i = next;
        setFrameIdx(i);
        run();
      }, durOf(timeline[i]) + extra);
    };
    run();
    return () => clearTimeout(t);
  }, [editing, view, timelineKey]);

  const cur = (!editing && view === "preview" && timeline.length) ? timeline[Math.min(frameIdx, timeline.length - 1)] : null;
  const arrowLine = cur ? cur.srcLine : -1;
  const srcLines = src.split("\n");

  const posOf = (key) => (cur && cur.snap && cur.snap[key]) ? cur.snap[key] : (actors[key] || { x: 4, y: 3, face: "down" });

  // dialogue box content, driven by the current step
  let boxWho = null, boxText = null, boxSys = false;
  if (cur && cur.kind === "say") {
    boxWho = cur.speaker || (actors[walker] && actors[walker].name) || "NPC";
    boxText = cur.text;
  } else if (cur && cur.kind === "give") {
    const pn = playerKey && actors[playerKey] ? actors[playerKey].name : "Player";
    boxText = `${pn} received ${cur.item.replace(/^ITEM_/, "")}!`;
    boxSys = true;
  }

  const tiles = [];
  for (let r = 0; r < 7; r++) for (let c = 0; c < 10; c++) {
    const water = r >= 4;
    tiles.push(
      <div key={r + "-" + c} className="gba-tile" style={{
        background: water
          ? "color-mix(in oklab, var(--accent) " + (8 + ((r + c) % 3) * 4) + "%, #0b1614)"
          : "color-mix(in oklab, #1c2a26 " + (60 + ((r * c) % 4) * 8) + "%, #11201d)"
      }} />
    );
  }

  const decompile = view === "decompile";

  return (
    <div className="split torch">
      {/* LEFT — stepping source / editor (preview) or read-only .inc (decompile) */}
      <div className="pane">
        {decompile ? (
          <React.Fragment>
            <div className="pane-head">vanilla.inc<span className="tag">Poryscript · read-only</span></div>
            <pre className="tor-pory" dangerouslySetInnerHTML={{ __html: highlightCode(TORCH_DECOMPILE_IN, INC_KW) }} />
          </React.Fragment>
        ) : (
          <React.Fragment>
            <div className="pane-head">
              scene.tor
              <button className="tor-edit" onClick={() => setEditing((e) => !e)}>{editing ? "▸ play" : "edit"}</button>
            </div>
            {editing ? (
              <textarea
                className="editor"
                spellCheck={false}
                value={src}
                onChange={(e) => setSrc(e.target.value)}
                aria-label="TorScript source"
              />
            ) : (
              <div className="tor-run" aria-label="TorScript playback">
                {srcLines.map((ln, i) => (
                  <div className="tor-row" key={i}>
                    <span className="tor-gutter">{i + 1 === arrowLine ? "▸" : ""}</span>
                    <span className="tor-code" dangerouslySetInnerHTML={{ __html: highlightCode(ln, TOR_KW) || "&nbsp;" }} />
                  </div>
                ))}
              </div>
            )}
            {editing && (
              <div className="tor-ref">
                <h5>TorScript reference</h5>
                <div className="tor-ref-grid">
                  <code>{"@ object event: <Name> at x,y, facing <dir>"}</code><span>spawn tile + initial facing (from map data)</span>
                  <code>{"alias <name> <ref>"}</code><span>name an actor (object event / npcN)</span>
                  <code>{"label <Name> … end"}</code><span>a script block</span>
                  <code>{'"dialogue line"'}</code><span>a line of text → msgbox</span>
                  <code>{"<actor> walk <dir> <dir>…"}</code><span>movement (or: walk &lt;dir&gt; &lt;count&gt;)</span>
                  <code>{"<actor> face <dir|player>"}</code><span>turn to face</span>
                  <code>{"give ITEM_* [n]"}</code><span>give an item</span>
                </div>
              </div>
            )}
          </React.Fragment>
        )}
      </div>

      {/* RIGHT — preview / decompiled TorScript */}
      <div className="pane">
        <div className="pane-head">
          {view === "preview" ? "ROM preview" : "decompiled · TorScript"}
          {decompile && <span className="tag">{DECOMP_V} → {DECOMP_T} lines · {DECOMP_PCT}% smaller</span>}
          <div className="tor-seg">
            <button aria-pressed={view === "preview"} onClick={() => setView("preview")}>preview</button>
            <button aria-pressed={view === "decompile"} onClick={() => setView("decompile")}>decompile</button>
          </div>
        </div>

        {view === "preview" && (
          <div className="gba">
            <div className="gba-screen">
              <div className="gba-map">
                {tiles}
                <div className="gba-actors">
                  {order.map((key) => {
                    const p = posOf(key);
                    return (
                      <div key={key} className={"gba-npc" + (key === walker ? "" : " player")} style={{
                        left: ((p.x + 0.5) / 10 * 100) + "%",
                        top: ((p.y + 0.5) / 7 * 100) + "%",
                        transition: instant ? "none" : undefined
                      }}>{DIR_ARROW[p.face]}</div>
                    );
                  })}
                </div>
              </div>
              {boxText && (
                <div className="gba-box">
                  {boxWho && <div className="gba-who"><span className="who">{boxWho}</span></div>}
                  <div key={frameIdx} className={boxSys ? "sys" : ""} style={{ animation: "fadein .3s" }}>{boxText}</div>
                  <span className="tri" />
                </div>
              )}
            </div>
          </div>
        )}

        {view === "decompile" && (
          <React.Fragment>
            <pre className="tor-pory" dangerouslySetInnerHTML={{ __html: highlightCode(TORCH_DECOMPILE_OUT, TOR_KW) }} />
            <div className="tor-cap">
              The decompiler reads existing <b>.pory / .inc</b> scripts — control flow, movement blocks, trainer battles, inlined text — and hands back editable TorScript. Even this short event sheds over half its lines; a full vanilla map script drops far more.
            </div>
          </React.Fragment>
        )}

        {!decompile && errors.length > 0 && (
          <div className="tor-err">⚠ line {errors[0].n}: {errors[0].why}</div>
        )}
      </div>
    </div>
  );
}

window.TorchDemo = TorchDemo;
