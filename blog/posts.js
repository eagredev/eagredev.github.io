/* Upstream — post store.
   Each post is plain Markdown, rendered on the page by the inkmd engine
   (js/markdown.js). Newest first. Replace these starter drafts with your
   own writing — just edit the `body` strings (or add new entries). */
window.POSTS = [
  {
    slug: "zero-dependencies-on-purpose",
    title: "Zero dependencies, on purpose",
    date: "2026-05-31",
    tags: ["inkmd", "python", "pdf"],
    mins: 8,
    dek: "Markdown-to-PDF is a solved problem in theory and a minefield in practice. inkmd is the version that survives the trip into a locked-down container.",
    body: `Every markdown-to-PDF tool I reached for wanted something from the system. Chrome headless wants 200MB and a five-second cold start. WeasyPrint wants Pango, cairo, and GObject — half a gigabyte of packages that quietly break on Alpine and Windows. Pandoc wants a LaTeX install measured in gigabytes. wkhtmltopdf has been deprecated since 2023 and carries unpatched CVEs.

None of that survives the trip into an Alpine container, a Lambda function, or a CI runner without admin rights. The whole category had quietly agreed that "convert markdown to a PDF" was allowed to mean "install a browser." So I wrote the one I wished existed.

## The constraint *is* the feature

\`inkmd\` is a single pure-Python wheel. No native extensions, no system libraries, no fonts to install. It installs in under a second and runs anywhere Python runs — macOS, Linux, Windows, Alpine, Lambda, a Steam Deck.

\`\`\`
pip install inkmd
inkmd in.md -o out.pdf
\`\`\`

That's the whole install. The public API is two functions: a CLI, and a \`compile()\` you can call directly from Python. An LLM agent that needs to hand back a PDF — a CV, a report, a summary — can call it in-process. No subprocess, no shell-out, no browser to cold-start. There's also a single-file zipapp of around 300KB you can drop onto any machine with Python 3.9+ and run without installing anything at all.

Refusing dependencies isn't austerity for its own sake. Every dependency is a thing that can break on a platform you didn't test, a license you have to honour, a CVE you have to track. Zero of them is a number that stays true.

## Four layers, nothing circular

The inside is a strict pipeline. Four layers, each sitting above the last, and the rule that holds the whole thing together is that **no layer imports a higher one**:

1. **\`parser\`** — a single-pass, container-aware block parser plus a CommonMark inline tokeniser, producing a frozen-dataclass AST.
2. **\`render\`** — lowers AST blocks to records with runs, spacing, indent, and decorations, carrying font and link state through inline nesting.
3. **\`layout\`** — wraps runs into pages and positions every glyph run against the page coordinate system: code-block backgrounds, blockquote rules, link underlines, strikethrough bars.
4. **\`pdf\`** — serialises pages to PDF bytes. Text via the kerning operators, graphics via fills and rectangles, links via per-page annotation arrays.

That's roughly 9,600 lines of pure-Python logic, plus another 4,700 lines of generated font-metric tables. The layering constraint sounds like bureaucracy until you realise it's the thing that lets you reason about any single stage in isolation — and the kind of invariant a model will happily violate the moment a human stops enforcing it.

## Byte-identical output

The part I care about most: the same markdown produces the same PDF *bytes*, on every platform, every Python version, every run. No real-time clocks. No random object IDs. No platform-dependent iteration order.

> Hash the markdown, hash the PDF, and the relationship is stable forever.

Most renderers can't promise this, because they're wrapping something they don't control, and that something reaches for the clock. Determinism turns a PDF into something you can put under version control, sign, or drop into an audit trail — where "the same input produced the same output" is the entire point.

## The font problem nobody warns you about

PDF guarantees fourteen base fonts — Helvetica, Times, Courier and their variants — are present in every conforming reader. inkmd uses those, which is why it ships no font files and stays tiny. The catch is that the *exact* glyph shapes depend on which Helvetica the reader's system provides: macOS ships the real thing, Linux usually substitutes Nimbus Sans.

The trick is that the advance widths are published in the standard AFM metrics, and inkmd emits them as real kerning via the PDF text operators. So line wrapping, page breaks, and paragraph flow are *identical* across systems — only the precise glyph outline inside each fixed-width box varies. Layout is deterministic even when rendering isn't. Color emoji are the one exception I bundle a font for: single glyphs, flags, skin tones, and family ZWJ sequences all render as colour, inline and in table cells, from Noto Color Emoji.

## The numbers

Measured against \`WeasyPrint + markdown\` — the closest pure-Python alternative — on the same documents, on the same machine:

| Metric | inkmd | WeasyPrint | Ratio |
| --- | --- | --- | --- |
| Install size | 10.5 MB | 74.6 MB | 7.1x smaller |
| Cold render, ~1 page | 132 ms | 814 ms | 6.2x faster |
| Cold render, ~11 pages | 174 ms | 1.40 s | 8.0x faster |
| Peak memory, ~11 pages | 19 MB | 122 MB | 6.4x lower |

The full methodology and the benchmark script live in the repo, so you can reproduce it rather than trust me.

## Where it loses

I'm not going to pretend it wins everywhere. WeasyPrint compresses content streams, so for long documents its PDFs come out smaller. It supports full Unicode, page-splitting CSS, and a styling model inkmd has no intention of growing. If you need CJK or Cyrillic text today, inkmd renders it as \`?\` until text-font embedding lands in a later release.

The trade is deliberate, and the honest framing is "the right tool depends on your input and your environment." inkmd is the one for the environment where installing a 200MB browser isn't an option — the tool you'd write yourself over a free weekend if you refused to take that dependency, and then kept polishing until the kerning was right.`,
  },
  {
    slug: "directing-the-build",
    title: "Directing the build",
    date: "2026-05-18",
    tags: ["workflow", "ai", "torch"],
    mins: 7,
    dek: "140 modules, one developer, zero dependencies. What it actually means to build software by directing AI tooling end to end.",
    body: `People hear "built with AI" and picture a prompt and a shrug. That's not the job. The job is architecture, decomposition, and review — the model is the hands, not the head. The interesting question isn't whether AI can write code. It obviously can. The question is what a developer has to be *good at* for the result to be something you'd put your name on.

TORCH is my honest answer to that. It's a self-hosted IDE for ROM hacking: a 140-module, zero-dependency Python codebase with a custom domain-specific language, a bidirectional compiler, a web GUI, and a full ROM build pipeline. I built it solo, by orchestrating AI development across hundreds of focused work streams. Here's the part that isn't magic.

## I own the architecture

Before any code gets written, the shape of the system exists — in my head and on paper. Where the boundaries are, what each module is allowed to know about, which way the dependencies point.

The four-layer pipeline in \`inkmd\` — parser, render, layout, pdf, each strictly above the last — is a decision I made, not one a model stumbled into. A constraint like *no layer imports a higher one* keeps a codebase honest for years, and it only holds if someone is enforcing it. Hand the architecture to the model and you get something that runs today and is a swamp in three months: every file importing every other, no seams, nowhere to stand. Architecture is the part that doesn't show up in a single prompt, which is exactly why it's the part a human has to own.

## I break the work into streams

A 140-module project is not one conversation. It's hundreds of small, well-scoped tasks, each with clear inputs, clear outputs, and a test I can point at. The decomposition *is* the skill.

Take TORCH's compiler. "Build a bidirectional compiler" is not a work stream — it's a wish. But "parse this TorScript statement into this AST node," "lower that node back to the original source," "round-trip a fixture file and assert it's byte-stable" — those are streams. Each one is something a model can nail in a single focused pass. The NPC editor, the trainer editor, the encounter tables, the ROM build step: separate streams, separate contracts, assembled against an architecture that already had a slot for each of them.

Get the decomposition right and the work almost schedules itself. Get it wrong and you spend the afternoon untangling output that technically satisfied a vague request and solved the wrong problem.

## I review the output

\`\`\`
inkmd: 788 tests across 33 files. Stdlib-only. Python 3.9+.
\`\`\`

Tests are the contract a stream is held to, and they're the first reviewer — but not the last. I read what comes back. Not as a formality: the model is fast, tireless, and *occasionally confidently wrong*, and a passing test suite doesn't catch a design that's subtly the wrong shape. The only defence against confident wrongness is someone who understands the system well enough to see it. That's the job that doesn't get automated.

> Directing AI well is not the absence of engineering. It's engineering with a faster, more literal pair of hands — and the same responsibility for the result.

## Why it's still engineering

The skeptical read is that this is just prompting with extra steps. I'd argue the opposite: it concentrates the work onto the parts that were always the hard parts. You can no longer hide a weak mental model behind the hours it takes to type. If you can't say what the system should look like, can't break it into pieces with crisp contracts, and can't tell good output from plausible-looking output, the tooling won't save you — it'll just help you build the wrong thing faster.

The output looks the same as any other well-built project, because that's the point. The method should be invisible in the result.`,
  },
  {
    slug: "a-locked-door-for-an-agent",
    title: "A locked door for an autonomous agent",
    date: "2026-04-29",
    tags: ["security", "agents", "nightjar"],
    mins: 6,
    dek: "Nightjar is an LLM agent reachable 24/7 over email. The interesting engineering isn't the agent — it's the boundary around it.",
    body: `An autonomous agent that anyone can reach is an autonomous agent anyone can abuse. Nightjar is reachable around the clock over an email channel, runs daily in personal production, and the part I spent the most time on is the part that says *no*.

The agent itself is the easy half. Wiring a model up to a mailbox is an afternoon. Making it safe to leave running, unattended, reachable by the entire internet — that's the half that's actually engineering.

## The channel is the threat model

Email is a wonderful interface for an assistant: asynchronous, universal, already on every device I own, no app to build. It is also a terrible medium for trust. The \`From\` header is a suggestion — anyone can put any address in it. SMTP was designed in a more innocent decade and it shows.

So the channel isn't "email." It's a **cryptographically authenticated** email channel that happens to ride on top of email. The transport is the friendly, universal part. The trust comes from somewhere SMTP can't touch.

\`\`\`
1. Ed25519 signature verified
2. Sender on allow-list
3. Intent within capability scope
4. Agent reasoning
5. Reply composed and signed
\`\`\`

Every inbound message runs that gauntlet before a single token of reasoning happens. No valid signature, no work done — the request is dropped at the boundary with zero capabilities granted. It never reaches the model at all. The expensive, unpredictable part of the system only ever sees input that already cleared the cheap, predictable checks.

## Defence in depth, because one layer fails

Signature verification is the front door, but a front door is not a security model. The layers behind it are deliberately *independent*:

- The **signature** proves the message wasn't forged or tampered with in transit.
- The **allow-list** is checked separately — a valid signature from an unknown key still goes nowhere.
- The **capability scope** is independent of both. Even a fully authenticated, allow-listed sender can only invoke what that sender is permitted to invoke. Authentication is not authorisation.

Layers exist precisely because any single one can fail. If the allow-list logic has a bug, the signature still held. If a key is mishandled, the scope still bounds the blast radius. You assume each control will eventually be the one that breaks, and you make sure it isn't the only thing standing between an attacker and the action.

> The most important thing an autonomous agent can do is refuse cleanly.

A refusal that's quiet, total, and early is a feature, not a failure. Most of Nightjar's value as a *safe* system is in the requests it never acts on.

## I prior-art-reviewed the design

Security architecture is the one place where "I'll figure it out as I go" is malpractice. The failure modes are adversarial, not random — someone is actively looking for the gap you didn't think about — and your own cleverness is the least trustworthy thing in the room.

So I designed the defence-in-depth model deliberately and reviewed it against prior art before trusting it with a live mailbox: how other people authenticate machine-to-machine channels, where comparable systems have been broken, which mistakes are common enough to have names. Originality is a liability here. You want to be boring in exactly the ways that are already known to work.

## Running it on myself

Nightjar isn't a demo that lives in a branch. It runs daily, in production, acting on my behalf — which means the blast radius of getting this wrong is *my* inbox, *my* calendar, *my* accounts. An agent you let run unattended is a system you are fully accountable for, so the boundary around it gets the same rigour as anything that ships to someone else. Arguably more, because there's no one downstream to catch it.`,
  },
];
