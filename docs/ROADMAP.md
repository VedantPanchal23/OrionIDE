# Orion IDE — Complete Product Roadmap

Last updated: 2026-08-07  
Scope: close gaps vs VS Code / Cursor / Antigravity while doubling down on **cloud + Google Drive + sandbox terminal + BYOK agents**.

**Status:** **P0 Done** · **P1 Done** · **P2 Mostly done** (jdt.ls / embeddings / live kernels still open)

---

## 0. Product north star

Orion is a **browser cloud IDE** where:

- Google Drive is the source of truth
- The **sandbox terminal is a general-purpose Linux project runtime** — not React-only. Users build **Python, Flask, FastAPI, Node/Express, React/Vite, Next.js, C++, git workflows**, and anything else the image supports
- React (Vite) is **one example template**, same as Flask or Express
- ▶ Run stays best-in-class for DSA / single-file execution (Piston)
- Agents are structured, approvable, BYOK (+ freeform Chat + Ctrl+K)
- We do **not** try to clone the VS Code extension marketplace or Antigravity’s multi-agent OS

**Win condition:** open Orion → create *any* kind of project → install deps in Terminal → run servers → preview via Ports → edit with Monaco/LSP → git + Agents — with zero local IDE install.

---

## 1. Competitive scorecard (summary)

| Area | VS Code | Cursor | Antigravity | Orion today | Orion target |
|------|---------|--------|-------------|-------------|--------------|
| Editor depth | W | W | S | S+ (Monaco + LSP + Tab ghosts) | S+ |
| Inline AI / Tab | P | W | S | S (Ctrl+K + ghosts) | S+ |
| Terminal power | W (local) | W | S | S+ (polyglot sandbox) | S+ |
| Agents (in-repo) | P | W | W | S (pipeline + chat + rules) | S |
| Agent orchestration | M | S | W | Opinionated 6-step + chat | Keep + deepen |
| Git / GitHub | W | W | S | S+ (SCM + conflicts + AI commits) | S+ PR (P2) |
| Debug / tests | W | W | P | S (DAP + Tests dock) | S+ |
| Drive cloud workspace | — | — | — | **W** | **W** |
| DSA one-click Run | S | S | P | **W** | **W** |
| Collab | Live Share | P | P | S (Yjs MVP) | S+ |
| Extensibility | W | S | P | M | Language packs only |

---

## 2. Terminal capability plan (polyglot)

**Principle:** React is an *example*. The Terminal supports **full project lifecycles** for every major stack we ship: create → install → run → test → git → preview ports.

Cookbook: [`docs/TERMINAL.md`](./TERMINAL.md)

### 2.0 Supported project classes

| Class | Create | Install | Run | Preview | Status |
|-------|--------|---------|-----|---------|--------|
| Python script / DSA | Template / blank | n/a | ▶ Run or `python3` | n/a | **Done** |
| Python Flask | Template Flask | `pip` + venv | `python app.py` | Ports 5000 | **Done** |
| Python FastAPI | Template FastAPI | `pip` | `uvicorn` | Ports 8000 | **Done** |
| Node Express / APIs | Template Express | `npm install` | `npm start` | Ports 3000 | **Done** |
| React / Vite (example SPA) | Template Vite | `npm install` | `vite` + `ORION_VITE_BASE` | Ports 5173 | **Done** |
| Next.js | Template Next | `npm install` | `npm run dev` | Ports 3000 | **Done** |
| C / C++ | Template C++ | n/a | `g++` / ▶ Run | n/a | **Done** |
| Blank + any CLI | Blank | user chooses | user chooses | Ports | **Done** |
| Go / Rust / Java | Language packs | toolchain | binary | Ports | **P2** |

### 2.1 Sandbox tools

| Tool | Status |
|------|--------|
| `bash`, pipes, `curl`, `wget` | Yes |
| `node`, `npm`, `npx`, `yarn` (corepack) | Yes (Node 18) |
| `git` | Yes (+ SCM UI) |
| `python3`, `pip` | Yes |
| `g++`, `make` | Yes |
| Listening port detect + HTTP/WS proxy | Yes |
| Grouped Terminal chips | **Done** (Shell / Python / Node / C++ / Git) |
| Project templates | **Done** (Blank, Python, Flask, FastAPI, Express, Vite, Next, C++) |
| Tests dock | **Done** |

### 2.2 Canonical workflows

See [`TERMINAL.md`](./TERMINAL.md) for copy-paste commands (Flask, FastAPI, Express, Vite, Next, C++, git, tests, ports).

### 2.3 Later (P2)

| Tool | Notes |
|------|-------|
| `pnpm` | Corepack enable |
| `go`, `rustc`, `java` | Language packs + LSP |
| Shell integration (cwd/links) | xterm polish |
| `sqlite3`, `redis-cli` | Optional |
| `docker` CLI | Multi-tenant risk — maybe never |

### 2.4 Hard limits

- Processes run **inside the terminal container**
- App ports via **Orion proxy**, not raw host `localhost`
- `node_modules` / `.venv` stay in sandbox (not synced to Drive)
- Prefer non-interactive CLI flags
- No shared-image package installs that break the sandbox

---

## 3. Full feature inventory

Status: **Done** · **P2** · **Won’t clone**

### 3.1 Editor

| Feature | Status | Notes |
|---------|--------|-------|
| Monaco edit, tabs, split, breadcrumbs | Done | |
| Themes, font/tab/wrap/minimap | Done | |
| Completions catalogs + snippets | Done | |
| LSP (hover, def, refs, rename, format, diagnostics) | Done | Pull-on-open + in-flight pull dedupe |
| Outline / Problems | Done | |
| Inline AI edit (Cmd/Ctrl+K) | Done | Accept / Retry / Discard |
| Tab ghost completions | Done | Catalogs + buffer words |
| Multi-cursor / column select | Done | Monaco defaults |
| Merge conflict editor | Done | Ours / Theirs / Both + abort |
| Notebooks | Done | Cell editor + Piston Run (no live Jupyter kernel) |
| Multi-root workspace | P2 | |
| Extension marketplace | Won’t clone | |

### 3.2 Terminal & ports

| Feature | Status | Notes |
|---------|--------|-------|
| Multi PTY, rename, reconnect, canvas | Done | |
| Drive sync pull/push | Done | |
| Ports detect/register/open | Done | |
| Polyglot chips + templates | Done | FastAPI / Next included |
| Proxy HTML/base + WS HMR | Done | |
| Tests dock → PTY | Done | Terminal stays mounted for input |
| Tasks / launch.json | Done | tasks.json → PTY; full DAP launch.json still P2 |
| Shell integration | Done | WebLinks (http/https) |
| Go/Rust/Java/pnpm | Partial | pnpm + Go + Rust + Java templates/chips; JDK in terminal image; jdt.ls still open |

### 3.3 Run / Debug / Test

| Feature | Status | Notes |
|---------|--------|-------|
| Piston ▶ Run + stdin + Output | Done | |
| Debug Python/Node DAP | Done | |
| Test runner (npm/pytest/node/go) | Done | |
| Coverage / profiler | P2 | |

### 3.4 Git

| Feature | Status | Notes |
|---------|--------|-------|
| Status, stage, commit, push/pull, branches, diff | Done | |
| Explorer git glyphs | Done | |
| Merge conflict UI | Done | Unmerged excluded from stage lists |
| AI commit messages | Done | |
| GitHub PR panel | Done | List/checkout via `gh` + create chip (full API panel later) |

### 3.5 Agents / AI

| Feature | Status | Notes |
|---------|--------|-------|
| 6-step pipeline + approvals + BYOK | Done | |
| Freeform agent chat + Drive writes | Done | |
| Project rules (`AGENTS.md`) | Done | Also `.orion/rules.md` |
| Inline Tab completions | Done | |
| Semantic codebase index | Partial | Lexical symbols over open + recently viewed files → Search + agent chat |
| Browser / scheduled agents | P2 | |

### 3.6 Files / Search / Drive

| Feature | Status | Notes |
|---------|--------|-------|
| Explorer CRUD, Drive sync | Done | |
| Search + replace (open + project) | Done | Skip/fail counts surfaced |
| Project templates | Done | |
| Nested Drive folder UX | P2 | |

### 3.7 Collaboration / billing

| Feature | Status | Notes |
|---------|--------|-------|
| Yjs CRDT collab | Done | `ENABLE_YJS_COLLAB` + client gate |
| Stripe / Upgrade CTA | Done | Settings + `/billing` poll |
| Invites / roles | P2 | |
| Audit / secret scan | Done | Client regex → Monaco Problems |

### 3.8 UX chrome

| Feature | Status | Notes |
|---------|--------|-------|
| Command palette, menus, status bar | Done | |
| Shortcut completeness | Done | F2, format, Ctrl+K |
| Keybinding customizer | P2 | |
| Settings sync / profiles | Partial | Local export/import + Drive `.orion/settings.json` (no API key) |

---

## 4. Prioritized roadmap

### P0 — Foundation — **COMPLETE**

1. Roadmap + polyglot terminal framing  
2. Templates: Blank, Python, Flask, Express, Vite React, C++  
3. Terminal chips: Shell / Python / Node / C++ / Git  
4. Vite-aware preview + HTML/Location rewrite  
5. Ports UX auto-register  
6. `docs/TERMINAL.md` cookbook  
7. Shortcuts F2 / Alt+Shift+F  

### P1 — Modern AI IDE — **COMPLETE**

1. Freeform Agents chat + file apply  
2. Inline edit (Ctrl+K)  
3. LSP pull-on-open reliability  
4. Merge conflicts  
5. Tests dock + DAP debug  
6. Yjs collab MVP  
7. Stripe upgrade flow  
8. Project rules + AI commits  
9. Vite HMR WebSocket proxy  
10. Drive search/replace  
11. Tab ghost completions  
12. FastAPI + Next.js templates  

### P2 — Depth & scale

1. ~~GitHub PRs~~ → **Done** (SCM + chip → `gh pr create --fill`)  
2. ~~Go / Rust / Java language packs~~ → **Partial** (templates + chips; terminal has go/rust/java/`gh`; LSP has gopls/rust-analyzer; **jdt.ls still open**)  
3. ~~Notebooks~~ → **Done** (cell editor + Piston Run; no live Jupyter kernel)  
4. ~~Secret scan~~ → **Done** (client regex → Problems)  
5. ~~Settings export/import + Drive sync~~ → **Done** (local JSON + `.orion/settings.json`)  
6. ~~Lexical codebase index~~ → **Done** (open + recent files → Search + agent `codeContext`) · embeddings / RAG still open  
7. ~~Tasks / launch.json~~ → **Done** (tasks.json + launch.json DAP picker)  
8. ~~Shell integration links~~ → **Done**  
9. ~~Local history~~ → **Done**  
10. ~~pnpm chip~~ → **Done**  

### P2 shipped

- Local History, Tasks dock, Terminal WebLinks, pnpm chip  
- `launch.json` config picker in Debug  
- Client secret scan markers  
- Settings Export / Import + Drive `.orion/settings.json` sync  
- GitHub PR list/checkout via `gh` + create chip  
- Go + Rust + Java templates/chips; terminal JDK + rust/go; LSP gopls/rust-analyzer  
- Notebook `.ipynb` editor + Piston cell Run + notebook template  
- Lexical project symbol index (open + recently viewed)  
- Agent chat “Run in Terminal” for bash fences  

### P2 still open

- Java language server (jdt.ls)  
- Embedding-based semantic search / RAG  
- Live notebook kernels (stateful REPL)  
- Full GitHub App / API PR panel, roles/invites, multi-root, cloud profiles  

---

## 5. Gap checklist

Must-have IDE:

- [x] Reliable LSP  
- [x] Inline AI edit  
- [x] Merge conflict UI  
- [x] Drive-wide search/replace  
- [x] Keybinding completeness  
- [x] Local history  
- [x] Terminal crash/paint harden  

Must-have agents:

- [x] Lexical symbol index (embeddings still open)  
- [x] Agent terminal (send bash fences to PTY)  
- [ ] Background agents  
- [x] Apply agent diffs  

Teams / school:

- [x] Live collab  
- [ ] Roles / invites  
- [ ] Teacher / assignment mode  
- [x] Billing upgrade UX  

Asymmetric wins:

- [x] Drive source of truth  
- [x] Zero-install browser IDE  
- [x] Piston Run  
- [x] BYOK pipeline approvals  
- [x] Full polyglot create → install → run → Ports  
- [x] Entitlements / SaaS shape  

Won’t clone: VS Code marketplace, full local SSH/WSL, Antigravity multi-agent OS.

---

## 6. Success metrics

| Metric | Target | Notes |
|--------|--------|-------|
| Create template → install → run → Ports | < 5 min | Flask / Express / Vite / FastAPI / Next |
| Terminal `dimensions` / blank paint | ~0 | Canvas + fit guards |
| Gateway `/health` including LSP | `ok` | Dev compose |
| Agent chat / pipeline / Ctrl+K | Works with BYOK | Quota = agent requests / day |
| ▶ Run Python hello | Exit 0 | |
| Merge conflict resolve | Ours/Theirs/Both | Then commit |
| Tests dock → PTY | Command runs | Terminal stays mounted |

---

## 7. Implementation notes

- Frontend: `http://localhost:3010`  
- Gateway: `:3000` · Terminal: `:3007` · LSP: `:3008` · Editor WS: `:3003`  
- Workspace: `/workspace/{userId}/{projectId}` in terminal container  
- Never sync `node_modules` / `.venv` to Drive  
- BYOK: `localStorage` `orion_model_settings`  
- Collab: `ENABLE_YJS_COLLAB=true` (compose) · client `VITE_ENABLE_YJS_COLLAB` (prod)  
- Prefer non-interactive CLI flags in chips and docs  

### P0/P1 audit fixes (2026-08-07)

- Tests → Terminal: keep PTY mounted when other dock tabs active  
- Yjs: no JSON frames after CRDT bind; bind after sync; client flag gate  
- Git: unmerged paths excluded from staged/unstaged  
- LSP: in-flight Drive pull Promise (no skipped concurrent pulls)  
- Billing: poll entitlements on `/billing?success=1`  
- Search replace: report skipped/failed counts  
- Quota copy: “agent request” not only “pipeline”  

---

## 8. Change log

| Date | Change |
|------|--------|
| 2026-08-07 | Initial roadmap; P0 React/terminal/preview |
| 2026-08-07 | Polyglot terminal; Flask/Express/C++ templates + chips |
| 2026-08-07 | P1: Agents Chat, `AGENTS.md`, Vite HMR WS |
| 2026-08-07 | P1: Ctrl+K inline edit |
| 2026-08-07 | P1 sweep: Stripe, AI commits, conflicts, Drive replace, Tests, Yjs, Tab ghosts, FastAPI/Next |
| 2026-08-07 | **P0+P1 marked complete**; full-system audit fixes; TERMINAL.md expanded |
| 2026-08-07 | P2 start: Local History, Tasks dock, Terminal WebLinks, pnpm chip |
| 2026-08-07 | P2 continue: launch.json debug, secret scan, settings backup, gh PR, Go toolchain Dockerfiles |
| 2026-08-07 | P2: notebooks MVP, Rust pack, lexical symbol index, Drive settings sync |
| 2026-08-07 | P2: Java pack, notebook Piston Run, PR list/checkout, index cache, agent→Terminal |
