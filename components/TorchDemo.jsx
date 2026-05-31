/* TORCH — TorScript DSL → live GBA screen + compiled bytecode.
   Edit the script; the NPC, facing, and dialogue update. A toy of the
   real bidirectional compiler in the ROM-hacking IDE. */
const { useState, useEffect, useMemo } = React;

const TORCH_SAMPLE = `npc Brendan at 3,2
face down
say "The tide turned overnight."
say "The river's running backwards!"
walk 6,4
give HM03 Surf`;

const DIRS = { up: "↑", down: "↓", left: "←", right: "→" };
const OPC = { npc: "1A", face: "21", say: "6C", walk: "44", give: "8E" };

function compileTorScript(src) {
  const lines = src.split("\n");
  const errors = [];
  const prog = { name: "NPC", x: 4, y: 3, face: "down", says: [], path: null, item: null };
  const bytes = [];

  lines.forEach((raw, n) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    let m;
    if ((m = line.match(/^npc\s+(\w+)\s+at\s+(\d+)\s*,\s*(\d+)$/i))) {
      prog.name = m[1];
      prog.x = Math.min(9, +m[2]); prog.y = Math.min(6, +m[3]);
      bytes.push(OPC.npc, hex(prog.x), hex(prog.y));
    } else if ((m = line.match(/^face\s+(up|down|left|right)$/i))) {
      prog.face = m[1].toLowerCase();
      bytes.push(OPC.face, hex(["up", "down", "left", "right"].indexOf(prog.face)));
    } else if ((m = line.match(/^say\s+"([^"]*)"$/i))) {
      prog.says.push(m[1]);
      bytes.push(OPC.say, hex(prog.says.length - 1), hex(m[1].length));
    } else if ((m = line.match(/^walk\s+(\d+)\s*,\s*(\d+)$/i))) {
      prog.path = { x: Math.min(9, +m[1]), y: Math.min(6, +m[2]) };
      bytes.push(OPC.walk, hex(prog.path.x), hex(prog.path.y));
    } else if ((m = line.match(/^give\s+(\w+)(?:\s+(\w+))?$/i))) {
      prog.item = (m[1] + (m[2] ? " " + m[2] : "")).toUpperCase();
      bytes.push(OPC.give, hex(prog.name.length));
    } else {
      errors.push({ n: n + 1, line });
    }
  });

  bytes.push("00"); // FF? end -> use 00 end-of-script
  return { prog, bytes, errors };
}

function hex(n) { return ("0" + (n & 0xff).toString(16)).slice(-2).toUpperCase(); }

function TorchDemo({ active }) {
  const [src, setSrc] = useState(TORCH_SAMPLE);
  const { prog, bytes, errors } = useMemo(() => compileTorScript(src), [src]);

  // walk animation: alternate between start and path target
  const [atPath, setAtPath] = useState(false);
  useEffect(() => {
    if (!prog.path) { setAtPath(false); return; }
    const id = setInterval(() => setAtPath((v) => !v), 1400);
    return () => clearInterval(id);
  }, [prog.path && prog.path.x, prog.path && prog.path.y, prog.x, prog.y]);

  const px = (atPath && prog.path) ? prog.path.x : prog.x;
  const py = (atPath && prog.path) ? prog.path.y : prog.y;

  // dialogue cycling
  const [sayIdx, setSayIdx] = useState(0);
  useEffect(() => {
    setSayIdx(0);
    if (prog.says.length <= 1) return;
    const id = setInterval(() => setSayIdx((i) => (i + 1) % prog.says.length), 2600);
    return () => clearInterval(id);
  }, [prog.says.join("|")]);

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

  return (
    <div className="split torch">
      <div className="pane">
        <div className="pane-head">scene.tor<span className="tag">TorScript</span></div>
        <textarea
          className="editor"
          spellCheck={false}
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          aria-label="TorScript source"
        />
        <div className="tor-bytes">
          <span style={{ color: "var(--text-mute)" }}>compiled → </span>
          {bytes.map((b, i) => (
            <span key={i} className={Object.values(OPC).includes(b) ? "b" : ""}>{b} </span>
          ))}
        </div>
      </div>
      <div className="pane">
        <div className="pane-head">
          ROM preview
          <span className="tag">{errors.length ? errors.length + " unparsed" : "bidirectional"}</span>
        </div>
        <div className="gba">
          <div className="gba-screen">
            <div className="gba-map">
              {tiles}
              <div className="gba-npc" style={{
                left: "calc(8px + " + (px / 10) * 100 + "% )",
                top: "calc(8px + " + (py / 7) * 100 + "% )"
              }}>{DIRS[prog.face]}</div>
            </div>
            {prog.says.length > 0 && (
              <div className="gba-box">
                <div className="who">{prog.name}{prog.item ? " · received " + prog.item : ""}</div>
                <div key={sayIdx} style={{ animation: "fadein .3s" }}>{prog.says[sayIdx]}</div>
                <span className="tri" />
              </div>
            )}
          </div>
        </div>
        {errors.length > 0 && (
          <div className="tor-err">⚠ line {errors[0].n}: couldn't parse "{errors[0].line.slice(0, 28)}"</div>
        )}
      </div>
    </div>
  );
}

window.TorchDemo = TorchDemo;
