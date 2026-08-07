# Orion Terminal — Polyglot Command Cookbook

The Orion sandbox is a **general Linux project runtime** (not React-only).

| Available | Examples |
|-----------|----------|
| Shell | `bash`, pipes, `curl`, `wget` |
| Python | `python3`, `pip`, venv, Flask, FastAPI |
| Node | `node`, `npm`, `npx`, `yarn`, Express, Vite, Next.js |
| C++ | `g++`, `make` |
| Git | full CLI (+ Source Control panel: stage, commit, AI message, merge conflicts) |
| Tests | Dock **Tests** tab → `npm test` / `pytest` / `node --test` / `go test` |

React/Vite is **one** frontend example. Build Python APIs, Express servers, C++ tools, or anything else these toolchains support.

See also: [ROADMAP.md](./ROADMAP.md) (P0 + P1 complete)

---

## Everyday shell

```bash
pwd
ls -la
cd src
mkdir -p src/components
cat package.json
echo "hello" > note.txt
```

Dock chips: **Shell** → `ls`, `pwd`.

## Python

```bash
python3 --version
python3 hello.py                          # or ▶ Run

# Virtualenv + Flask web app
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python3 app.py                            # Ports → 5000
```

### FastAPI

```bash
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
# Ports → 8000 → Open
```

Dock chips: **Python** → `venv`, `pip install`, `flask run`, `uvicorn`, `py script`.

`.venv` stays in the sandbox (not synced to Drive).

## Node / Express

```bash
node -v && npm -v
npm install
npm start                                 # Ports → 3000
npm run build
npm test                                  # or Dock → Tests → npm test
```

## React / Vite (example SPA)

```bash
npm create vite@latest . -- --template react
npm install
ORION_VITE_BASE=/api/terminal/proxy/5173/ npm run dev -- --host 127.0.0.1 --port 5173
```

Ports → **5173** → Open. HMR WebSockets are proxied on the same path.

## Next.js

```bash
npm install
npm run dev                               # Ports → 3000
```

Dock chips: **Node** → `npm i`, `npm start`, `next dev`, `vite dev`.

## Go

```bash
go version
go run .
go test ./...
```

Dock chips: **Go**. Rebuild terminal/LSP images after pulling Dockerfile changes (`golang`, `gopls`, `gh`, Rust toolchain).

## Rust

```bash
rustc --version && cargo --version
cargo run
cargo test
```

Dock chips: **Rust**. `rust-analyzer` is installed in the LSP image.

## Java

```bash
java -version
javac Main.java && java Main
```

Dock chips: **Java**. OpenJDK is in the terminal image. ▶ Run also works on `.java` via Piston.

## C / C++

```bash
g++ --version
g++ main.cpp -o main && ./main
# or ▶ Run on main.cpp
```

Dock chips: **C++** → `g++ -V`, `g++ run`.

## Git

```bash
git status
git add .
git commit -m "message"
gh auth login          # once
gh pr create --fill    # or SCM toolbar Link icon
```

Or use the **Source Control** side panel:

- Stage / Commit / Push / Pull
- **AI message** (BYOK) for commit text
- **Merge conflicts** → Ours / Theirs / Both / Abort merge
- **Create PR** toolbar (sends `gh pr create --fill` to Terminal)

## Drive sync

After Drive edits, click **Drive sync** so the sandbox disk matches before `pip`/`npm`.

Skipped from Drive sync: `node_modules`, `.venv`, `.git` (typical).

## Ports preview

1. Bind servers to `127.0.0.1`
2. Open **Ports** — common ports auto-register when detected (`5173`, `3000`, `5000`, `8000`, `8080`)
3. Click **Open** → `/api/terminal/proxy/<port>/`
4. Vite HMR WebSockets are proxied on the same path (register the port first)

| Port | Typical |
|------|---------|
| 5173 | Vite |
| 3000 | Express / Next |
| 5000 | Flask |
| 8000 | FastAPI / Django |
| 8080 | Generic HTTP |

## Tests

Dock → **Tests**:

- `npm test`
- `pytest`
- `node --test`
- `go test ./...`

Commands are sent to the **active terminal** (keep Terminal tab visible for output).

## Tasks

Dock → **Tasks**: runs `.vscode/tasks.json` or `.orion/tasks.json` (VS Code–style). Falls back to npm/pytest presets. Same PTY injection as Tests.

Chip **pnpm i** runs `corepack enable && pnpm install`.

Terminal **http(s) URLs** are clickable (open in a new tab).

## Agents / AI

- **Chat** tab: freeform coding help; can write files into the open Drive project
- **Pipeline** tab: multi-step Planner → … with approvals
- **Ctrl/Cmd+K**: inline edit selection in the editor
- Optional project rules: add `AGENTS.md` (or `.orion/rules.md`) at the project root
- BYOK: Settings → Your model (API key stays in this browser)
- **Local History** activity: snapshots on save (browser IndexedDB); compare / restore

## Search / replace

Activity → **Search**: Drive filename + content. Toggle replace → **Replace in open editors** or **Replace in project** (confirms, writes Drive).

## Collab (optional)

With `ENABLE_YJS_COLLAB=true` (and client `VITE_ENABLE_YJS_COLLAB` in prod), open the same file in two sessions to share edits via CRDT.

## Limits

- Runs in the **terminal container**, not your laptop OS
- No Docker-in-Docker by default
- Prefer non-interactive flags (`--yes`, `--template`) for scaffolding
- Install project-local deps; don’t break the shared image
