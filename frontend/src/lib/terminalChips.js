/**
 * Terminal dock quick commands — polyglot project workflows.
 * React/Vite is one example; Python/Flask/Express/C++/git are first-class too.
 */

export const TERM_CHIP_GROUPS = [
  {
    id: 'shell',
    label: 'Shell',
    chips: [
      { label: 'ls', cmd: 'ls -la\n' },
      { label: 'pwd', cmd: 'pwd\n' },
    ],
  },
  {
    id: 'python',
    label: 'Python',
    chips: [
      { label: 'python3 -V', cmd: 'python3 --version && pip3 --version\n' },
      { label: 'venv', cmd: 'python3 -m venv .venv && . .venv/bin/activate && python -V\n' },
      { label: 'pip install', cmd: 'pip install -r requirements.txt\n' },
      { label: 'flask run', cmd: 'python3 app.py\n' },
      { label: 'uvicorn', cmd: 'uvicorn main:app --host 127.0.0.1 --port 8000 --reload\n' },
      { label: 'py script', cmd: 'python3 hello.py\n' },
    ],
  },
  {
    id: 'node',
    label: 'Node',
    chips: [
      { label: 'node -v', cmd: 'node -v && npm -v\n' },
      { label: 'npm i', cmd: 'npm install\n' },
      { label: 'pnpm i', cmd: 'corepack enable && pnpm install\n' },
      { label: 'npm start', cmd: 'npm start\n' },
      { label: 'next dev', cmd: 'npm run dev\n' },
      {
        label: 'vite dev',
        cmd: 'ORION_VITE_BASE=/api/terminal/proxy/5173/ npm run dev -- --host 127.0.0.1 --port 5173\n',
      },
      {
        label: 'create vite',
        cmd: 'npm create vite@latest . -- --template react\n',
      },
    ],
  },
  {
    id: 'go',
    label: 'Go',
    chips: [
      { label: 'go version', cmd: 'go version\n' },
      { label: 'go run', cmd: 'go run .\n' },
      { label: 'go test', cmd: 'go test ./...\n' },
    ],
  },
  {
    id: 'rust',
    label: 'Rust',
    chips: [
      { label: 'rustc -V', cmd: 'rustc --version && cargo --version\n' },
      { label: 'cargo run', cmd: 'cargo run\n' },
      { label: 'cargo test', cmd: 'cargo test\n' },
    ],
  },
  {
    id: 'java',
    label: 'Java',
    chips: [
      { label: 'java -version', cmd: 'java -version 2>&1; javac -version\n' },
      { label: 'javac+run', cmd: 'javac Main.java && java Main\n' },
    ],
  },
  {
    id: 'cpp',
    label: 'C++',
    chips: [
      { label: 'g++ -V', cmd: 'g++ --version\n' },
      { label: 'g++ run', cmd: 'g++ main.cpp -o main && ./main\n' },
    ],
  },
  {
    id: 'git',
    label: 'Git',
    chips: [
      { label: 'git status', cmd: 'git status\n' },
      { label: 'git log', cmd: 'git log --oneline -n 8\n' },
      { label: 'gh pr list', cmd: 'gh pr list\n' },
      { label: 'gh pr', cmd: 'gh pr create --fill\n' },
    ],
  },
];

export const TERM_CHIPS_FLAT = TERM_CHIP_GROUPS.flatMap((g) => g.chips);
