# CDS Mode (Chen's DS)

> **A multi-agent development mode for DeepSeek Harness.**
>
> You talk to one persona — **Chen**. It dispatches **56 personas** that hand work to each other directly, then reports back in a single voice.

**Language:** **English** · [简体中文](README.zh.md) · [日本語](README.ja.md)

---

## 1. What this is

Most AI coding assistants work like this: **you ask, it answers.**

CDS mode is different. You face one persona — **Chen**. It doesn't start writing immediately. It asks first, then splits the work, assigns it, verifies the result, and gives you an account of what happened.

In one sentence: **it turns "one person working" into "a team working, but only one of them talks to you."**

| The trouble you may have hit | What CDS does |
|---|---|
| The AI starts writing before the requirement is clear, and the direction turns out wrong | Chen asks 5 calibration questions, then the requirement. **Nothing starts until it's clear** |
| The AI says "fixed", you test it, still broken | A **different** persona must verify, and verification means **replaying the original problem** — not declaring itself done |
| Every change breaks something new | Each round must report its **net change**; five rounds without convergence triggers an **automatic circuit breaker** |
| The code reads like AI wrote it — plastic | One persona (D4) **hunts AI-slop specifically** and holds a **veto** |
| Things said in chat are forgotten next time | Every conclusion **must land on disk**; files are authoritative, not conversation memory |
| The AI quietly does the work itself, so nothing was ever assigned | Task-hogging is explicitly forbidden; anything Chen produces out of scope is **voided** |
| Many agents working at once overwrite each other | Batched parallelism with **mutually exclusive slice** declarations; duplicate work is forbidden |

---

## 2. The core: nine iron rules

The whole mode is locked down by nine rules. They are not slogans — breaking one has a stated consequence.

| # | Rule | Consequence of breaking it |
|---|---|---|
| **L1** | **Only Chen talks to you.** No other persona may output to the user | Out of scope; output voided |
| **L2** | **No work before the requirement is clear.** First conversation does calibration + requirement gathering; every later request gets 5–10 follow-up questions first | Work started in violation; rolled back |
| **L3** | **Bugs are never hidden.** Everything goes into the ledger, including "known but not fixing", with the reason stated | Serious violation |
| **L4** | **Loops must converge.** Each round must report its net bug change | Out of control; circuit breaker fires |
| **L5** | **Version changes need your explicit word.** Until you say "update / refactor / bump the version", all edits run as ordinary feature work | Unauthorized change |
| **L6** | **Peers may not cover for each other.** If one finds another's bug, it goes in the ledger — no quiet fix | Violation |
| **L7** | **Conclusions must land on disk.** Files are authoritative between personas | Conclusion invalid |
| **L8** | **Delegation must hand over the full persona card.** A path alone means the delegation failed; the sub-agent degrades into a generic assistant | Invalid delegation; artifacts voided |
| **L9** | **Questions to you always use the question tool** (structured choice cards), never a wall of prose | Process violation |

**L2 and L9 are what you feel most directly: Chen asks with selectable cards, not a paragraph you have to parse for the point.**

---

## 3. 56 personas, in two modes

### Main mode: Chen + 21 personas (everyday development, docs, design)

**Chen** is the root persona. The other 21 sit in five groups:

| Group | Trait | Members | What they're for |
|---|---|---|---|
| **Research** | Emotional coldness | A1 official-sources · A2 reuse-first · A3 individuation · A4 consolidation & verification | Reading docs, mapping existing code, removing AI-slop, integrating and verifying |
| **Design** | Greed / refinement | B1 odd idea · B2 pragmatist · B3 aesthetics & ergonomics · B4 consolidation & closure | Proposals, pragmatism red lines, visual and interaction, **final say on closure** |
| **Development** | Laziness + perfectionism | C1 frontend · C2 backend · C3 details & bug fixing · C4 security layer | Writing code, running it, fixing details, the security checklist |
| **Testing** | Sincerity | D1 code-level run · D2 real-device experience · D3 long-horizon bugs · D4 AI-slop hunter · D5 security red team · D6 classification & aggregation | Five independent viewpoints hunting problems; **D4 holds a veto** |
| **Misc** | — | E1 clerk · E2 slides · E3 promo video | All prose, decks, video |

### Attached mode: C-WEB web-security workflow (35 personas)

Enabled for security tasks. **It does not affect everyday development.** Eight groups:

| Group | Trait | Count | What they do |
|---|---|---|---|
| **A** Reconnaissance | Emotional coldness | 4 | Asset boundary, threat intel, open-source info, supply chain |
| **B** Detection & analysis | Truth-seeking | 5 | Alert triage, forensics, vuln analysis, malware, traffic |
| **C** Response & recovery | Restraint | 4 | Execute response, verify recovery, containment, business continuity |
| **D** Governance & compliance | Stubbornness | 4 | **Policy gate**, reporting, compliance, privacy |
| **E** Security architecture | Foresight | 6 | Architecture, appsec, cloud, identity, data security, crypto |
| **F** Offense & defense | Adversarial thinking | 4 | Pentest, red team, reverse engineering, vuln research |
| **G** Security operations | Efficiency | 3 | Detection engineering, automation, tooling |
| **I** Real-time defense | Fast, precise, hard | 5 | Live command, blocking, deception, attribution, countermeasure |

**Two designs in the security mode are worth knowing:**

**D-web1 is a policy gate that even Chen cannot bypass.** Every action that changes system state goes through it. Its verdict is one of three — **allow / requires approval / deny**. There is no fourth. "Do it now and file the approval alongside" is not a fourth; it's a violation.

**D-web4 holds a privacy veto.** For any operation touching personal data it can refuse outright, **without asking Chen** — but it must offer an alternative path that avoids personal data.

---

## 4. The most interesting design: Chen may not hog tasks

This is the most counter-intuitive and, in practice, the most useful rule in the whole mode.

AI has every tool available. **The default pull is to just write that part too.** And the moment Chen does, the personas that should have been dispatched never are — so everything the mode promises (the testing group's sincerity, B4's closure, D4's AI-slop veto, the research group's adversarial verification) **simply does not happen**.

So there is an explicit test:

> **If Chen produces an artifact that some persona should have landed, that is task-hogging. The artifact is voided and the work goes back.**

Chen may only write "orchestration records". Business artifacts are off limits.

There is also a matching **symptom → persona table**: which symptom goes to whom. Symptoms in the table may not be handled by Chen; symptoms not in it trigger a question of whether a new persona is needed, or **Chen stops and asks you**.

---

## 5. When it stops and waits for you

This matters — **not everything comes back to bother you.**

| Must stop and ask you | Must not stop; continue on its own |
|---|---|
| Requirement summary awaiting your confirmation | In-round progress (research → design → build → test) |
| Awaiting your "do not touch" list when taking over a project | The fix → retest loop |
| Judged to be a version change / rebuild | A single subtask finishing (**that is not a stop point**) |
| Circuit breaker fired | — |
| Contradiction in the requirements | — |
| A security red line is hit | — |
| About to deliver | — |

There is one more discipline: **do not report back after every single persona dispatched.** That's pestering, not diligence.

---

## 6. How it avoids "fixing until it's a mess"

Six circuit breakers fire automatically:

| ID | Trigger | Meaning |
|---|---|---|
| **CB-1** | 5 consecutive test loops without convergence | Stuck in a loop |
| **CB-2** | ≥ 3 new fatal bugs in any one round | Fixes introduce more than they remove |
| **CB-3** | Code grows net for 3 consecutive rounds while bugs don't fall | Digging a deeper hole |
| **CB-4** | A requirement disagreement that choice cards cannot resolve | Directional disagreement |
| **CB-5** | Budget / time limit reached | Resource breaker |
| **CB-6** | The same bug "fixed" 3 times and still broken | Root cause was misjudged |

**Problems are graded S1 (fatal) to S5 (suggestion).** One hard rule:

> **A "no error but the result is wrong" problem counts as at least S2, regardless of whether the feature is core.**

Silent wrong data is the most dangerous kind — the UI looks fine, the numbers are wrong.

---

## 7. What you see after installing

### Two preset cards

| Card | Notes |
|---|---|
| **CDS 模式（晨的DS）** | **Use this one day to day.** Zero experimental dependencies, always activates |
| **CDS 模式 · 同伴频道版** | Additionally mounts Agent Teams: personas can message each other directly and share a task board |

**Collaboration features exist only in the second card.** The first deliberately mounts no experimental package — so if one breaks, the CDS core still works.

In a 同伴频道版 session, **an Agent Teams entry appears in the conversation header**: roster, shared task board, and navigation into a teammate's conversation.

**If you can't find any collaboration entry, there is only one reason: you picked the first card.**

---

## 8. Installation

**Requirements:** a working DeepSeek Harness install that can run `dsh web`. **No npm login needed.** The package has zero external dependencies.

Four paths, pick one. **Try the first** (least effort), or jump to the fourth (least network).

### Option 1: Web UI (least effort)

1. Open the DSH web interface
2. In the sidebar, select **Plugins**
3. Click **Add plugin**
4. Enter the repository URL:

   ```
   https://github.com/DRQRTS/dsh-cds-mode
   ```

5. Choose a **Registry** (the default is fine) and tick the trust box above **Install**
6. Click **Install**
7. **Restart `dsh web`**

> **Note what the trust box says: installed plugins do not update automatically.** Upgrading means uninstalling, then installing the new version.
>
> Ticking it acknowledges that. Installing runs the package's code inside your profile — that is how the plugin mechanism works generally, not something specific to this package. You can read `index.js` first: about 400 lines, only Node built-ins.

### Option 2: CLI (good for scripting)

```bash
dsh plugin --profile web add https://github.com/DRQRTS/dsh-cds-mode
```

(`web` is your profile name. `--profile` is required — omitting it errors.)

Restart afterwards, same as above.

### Option 3: Let the agent install it

In a DSH session, say:

> Install this plugin for me: https://github.com/DRQRTS/dsh-cds-mode

The agent calls the `plugin_manager` tool's `install_bundle`. This needs `danger-full-access`.

### Option 4: From the archive (no GitHub needed)

If GitHub is unreachable (**common in mainland China**, see section 11), use this:

```bash
mkdir -p ~/dsh-bundles
unzip dsh-cds-mode-1.5.0.zip -d ~/dsh-bundles
# yields ~/dsh-bundles/package/
```

Then have the agent install that **directory**:

```
plugin_manager  action: install_bundle
                target: /absolute/path/to/the/extracted/package
```

> **Why "keep it long-term" matters:** installation uses a symlink; DSH **points at** that directory. Delete it and the plugin stops loading.
>
> `install_bundle` accepts **a registry name**, **a git address**, **a tarball**, or **an absolute path**. It does **not** accept a `.zip` itself — unzip first. The path must be absolute.

### Comparison

| Option | Needs GitHub reachable | Needs restart | Best for |
|---|---|---|---|
| Web UI | yes | yes | Most people |
| CLI | yes | yes | Batch / scripting |
| Agent tool | depends on the spec | yes | If you already work through chat |
| Archive | **no** | yes | When GitHub is unreachable |

### Last step: restart

```bash
dsh web
```

**A restart is required; refreshing the page is not enough.** JS modules load at process start, so adding or replacing a package needs a restart.

Then **start a new session** and pick **CDS 模式** as the preset.

### Uninstall and upgrade

**Uninstall:** find the CDS card on the Web **Plugins** page and remove it, or have the agent run

```
plugin_manager  action: remove_bundle  target: @local/dsh-cds-mode
```

**Upgrade:** since plugins do not auto-update, upgrading = **uninstall first, then install the new version**, then restart.

**Uninstalling does not touch your project artifacts** — those live in your project workspace.

---

## 9. Verifying it works (three steps)

**Step 1 — no red cards.** Open the preset list. Neither CDS card should carry a red "load failed" badge. If one does, send the diagnostic text: it is line-by-line and names the exact row and reason.

**Step 2 — it knows who it is.** In a new session, ask:

> Who are you?

You should get **Chen**'s self-description. Then ask:

> How many iron rules are in your CDS spec? What is the first one?

It should answer **nine**, and the first is "only Chen talks to the user".

**Step 3 — questions go through the tool.** State any requirement, e.g. "help me build a small tool for tracking student homework". Chen should **present selectable choice cards** (not a wall of prose), no more than 5 per batch, and the second batch should **follow from your answers** — if you said "just for our class", it should not go on to ask about payments, invoices, or regulatory filing.

---

## 10. Common problems

| Symptom | Cause | Fix |
|---|---|---|
| No CDS card in the preset list | not restarted after install | restart `dsh web` |
| Card shows a red "load failed" | a row failed to activate | send the diagnostic text to the maintainer |
| Diagnostic says "bundled corpus missing" | incomplete archive | unzip a complete archive again |
| Install says `Cannot access GitHub` | GitHub unreachable | **see section 11**: configure a proxy, or use the archive |
| No Plugins page in the sidebar | this profile is not managed | use option 2 or 3 instead |
| The model says "I'm a coding agent…" | wrong preset selected | confirm the session preset is **CDS 模式** |
| No collaboration entry anywhere | you're on **CDS 模式** | switch to **CDS 模式 · 同伴频道版** |
| Re-installing reports `ambiguous-install` | same target already installed | **expected**; just restart |
| A new version seems to have no effect | plugins don't auto-update | uninstall, then install the new version, then restart |
| Prompt-cache hit rate suddenly drops | the corpus was edited (prefix changed) | see the cache-impact notes in `cds/CHANGELOG.md` |

---

## 11. When GitHub is unreachable

**This is where mainland China users are most likely to get stuck, so it gets its own section.**

The plugin itself **does not need the network** (zero dependencies, corpus bundled). But **the first three install options all reach GitHub** (they clone the repository).

### Symptoms

- The Web UI shows `Cannot access GitHub` or `GitHub connection timed out`
- On the CLI, `git ls-remote` or `dsh plugin add` hangs for about 22 seconds and fails
- Error resembles `Failed to connect to github.com port 443`

### What to do

**Fix 1: give git a proxy** (if you have one)

```bash
git config --global http.proxy  http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890
```

Use your own port. Then verify:

```bash
git ls-remote https://github.com/DRQRTS/dsh-cds-mode HEAD
```

A commit hash means it works.

**Fix 2: switch to the archive (option 4)** — this bypasses both GitHub and the registry.

> One thing worth clearing up: the npm China mirror (npmmirror) **does not help here** — it mirrors packages on the registry, not GitHub repositories. So "switch the mirror" has no effect on a git address. That is why the Web UI offers `Try another way` after you pick a mirror.

---

## 12. Honest disclosure

**What is guaranteed**

- **Zero external dependencies**: `index.js` imports only `node:` built-ins. It cannot break on your machine because some package fails to resolve (this was fixed after hitting exactly that).
- **Verification ships with it**: 228 assertions across two scripts, covering structure, wiring, portability and real mounting. You can run them yourself:

  ```bash
  node _verify3.mjs && node _verify-corpus.mjs
  ```

- **The corpus is checkable**: `node _sync-corpus.mjs --check` byte-compares the bundled corpus against the source.
- **The `.zip` and `.tgz` are byte-identical in content**, each verified with two independent extractors.

**What must be said plainly**

- **同伴频道版 depends on two experimental packages** (`dsh-experimental-agent-team` / `dsh-experimental-tool-agent-team`) plus an experimental UI package. They carry **no stability promise**; a breaking upstream change could stop that card from activating. **This does not affect CDS 模式** (the baseline card).
- **Batch concurrency is capped at 8 instances.** Deliberate, not a defect.
- Built against DSH `0.2.0-rc.2`. **Before moving to a new major DSH version, run the verification scripts above.**
- **Four surfaces have not been verified end-to-end in a real session**: the preset cards not being red, sub-agent role-play, questions going through the tool, and the collaboration UI with teammates messaging each other. The 228 assertions cover "the wiring is right, the corpus is complete, it mounts" — **not "it works well in practice."** For a first run, do the three steps in section 9.

**On the security mode's boundaries**

- Countermeasure execution (I-web5) has **seven admission requirements**; missing one means outright refusal. "Do it first and file it after", "verbal approval", and "it's urgent" are not accepted.
- There is a **"never do" list**: intrusion, destruction, DDoS, backdoors, data theft, attacking targets outside the stated scope, retaliation against a natural person — **not done no matter how broadly the authorization is written**.
- The reason is simple: **authorization can widen what is permitted, but it cannot turn a crime into a lawful act.**

---

## 13. Changing things

**Editing the corpus**: everything lives under `cds/` inside the package. **Restart** after editing.

**Using your own corpus**: copy `cds/` elsewhere and add `corpusDir` to the `cds-mode` row in `cordis.patch.yml`, pointing at it.

**Don't turn on `liveReload`**: it rewrites the system-prompt prefix when the corpus changes, **dropping this session's prompt cache**. This mode cares about cache hits — restart after editing instead.

**Uninstall**: `plugin_manager action: remove_bundle target: @local/dsh-cds-mode`. The preset cards disappear and the system prompt returns to the deployment default. **Your project artifacts are unaffected** (they live in your project workspace).

---

## 14. Where the files are

```
dsh-cds-mode/                 ← repository root, which is also the bundle root
├── README.md                 ← Chinese (default)
├── README.en.md              ← this file
├── README.ja.md              ← Japanese
├── INSTALL.md                ← installation and troubleshooting
├── LICENSE                   ← MIT
├── package.json              ← name, version, dsh.bundle.patch pointer
├── index.js                  ← the plugin, ~400 lines, zero dependencies
├── cordis.patch.yml          ← presets and mounting (2 presets + peer-channel rows)
├── icon.svg
├── locale/                   ← UI strings
└── cds/                      ← the whole spec corpus (90 files)
    ├── CORE.md                   operating contract: nine iron rules, state machine, gates, delegation, orchestration
    ├── README.md                 mode entry point and persona overview
    ├── CHANGELOG.md              change log, including every cache-invalidation record
    ├── personas/                 Chen + 21 personas + 5 group indexes
    │   └── web/                  the security mode's 36 (including chen-web)
    ├── workflow/                 5 workflows (new project / takeover / iteration / circuit breakers / web security)
    ├── protocol/                 peer channel, artifact contract, bug taxonomy
    ├── questions/                the question doctrine + banks (calibration / new project / takeover / follow-up)
    ├── selfrescue/               the thrift side: prompt-cache hits and prefix stability
    └── web/                      the security workflow's 8 supporting documents
```

To go deeper, start at `cds/CORE.md` — that is the operating contract; everything else hangs off it.

### Verification scripts (optional, for self-checking)

The repository also carries a few development and verification files. **They are not needed to install the plugin.**

| File | Purpose |
|---|---|
| `_verify3.mjs` | plugin-layer checks: structure, wiring, portability, real mounting |
| `_verify-corpus.mjs` | corpus-layer checks: persona completeness, group-trait consistency, dead links |
| `_sync-corpus.mjs` | corpus sync (`--check` compares without writing) |
| `_check-specs.mjs` | confirms which install spec forms the official parser accepts |
| `_check-icon.mjs` | validates the icon SVG: structure and geometry |
| `_check-locale.mjs` | inspects the locale JSON files as bytes |
| `_compare-extract.mjs` | byte-compares an extracted archive against the source |
| `_patch-reader.mjs` | dependency-free patch reader |
| `_zip.mjs` | dependency-free ZIP writer |
| `_pack.mjs` | builds the `.zip` and `.tgz` |

You can run the first two yourself (**228 assertions**):

```bash
node _verify3.mjs && node _verify-corpus.mjs
```

---

**Language:** **English** · [简体中文](README.zh.md) · [日本語](README.ja.md)
