/**
 * Seed file packs for new Drive projects.
 * Templates are examples — the Terminal is the real polyglot runtime
 * (Python, Node, C++, git, any CLI that fits the sandbox image).
 * Keep lean: deps install in the sandbox, not synced to Drive.
 */

export const PROJECT_TEMPLATES = [
  {
    id: 'blank',
    label: 'Blank',
    description: 'Empty folder — build anything in Terminal (Python, Node, C++, …)',
  },
  {
    id: 'python',
    label: 'Python script',
    description: 'hello.py — ▶ Run or python3 in Terminal',
  },
  {
    id: 'flask',
    label: 'Python Flask',
    description: 'Flask app — pip install -r requirements.txt, then flask run → Ports 5000',
  },
  {
    id: 'express',
    label: 'Node Express',
    description: 'Express API — npm install && npm start → Ports 3000',
  },
  {
    id: 'vite-react',
    label: 'React (Vite)',
    description: 'One example frontend — npm install && vite dev → Ports 5173',
  },
  {
    id: 'cpp',
    label: 'C++',
    description: 'main.cpp — g++ in Terminal or ▶ Run',
  },
  {
    id: 'fastapi',
    label: 'Python FastAPI',
    description: 'FastAPI — pip install && uvicorn → Ports 8000',
  },
  {
    id: 'nextjs',
    label: 'Next.js',
    description: 'Next.js app — npm install && npm run dev → Ports 3000',
  },
  {
    id: 'go',
    label: 'Go',
    description: 'main.go — go run . or Tests dock',
  },
  {
    id: 'rust',
    label: 'Rust',
    description: 'Cargo hello — cargo run / cargo test',
  },
  {
    id: 'notebook',
    label: 'Python notebook',
    description: 'starter.ipynb — edit cells + Run via Piston',
  },
  {
    id: 'java',
    label: 'Java',
    description: 'Main.java — javac / java or ▶ Run',
  },
];

function safePkgName(projectName) {
  return String(projectName || 'orion-app')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'orion-app';
}

/** @returns {{ path: string, content: string }[]} */
export function getTemplateFiles(templateId, projectName = 'orion-app') {
  const safeName = safePkgName(projectName);

  if (templateId === 'python') {
    return [
      {
        path: 'hello.py',
        content: `def main():
    print("Hello, World!")


if __name__ == "__main__":
    main()
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName}

## Run

- **▶ Run** (Ctrl+Enter) on \`hello.py\`, or
- Terminal: \`python3 hello.py\`

## Grow into a full Python project

\`\`\`bash
python3 -m venv .venv && . .venv/bin/activate
pip install requests flask
python3 hello.py
\`\`\`

See docs/TERMINAL.md for Flask, venv, pip, and Ports.
`,
      },
    ];
  }

  if (templateId === 'flask') {
    return [
      {
        path: 'app.py',
        content: `from flask import Flask, jsonify

app = Flask(__name__)


@app.get("/")
def home():
    return jsonify(
        ok=True,
        message="Hello from Orion Flask",
        project="${String(projectName).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}",
    )


@app.get("/health")
def health():
    return jsonify(status="ok")


if __name__ == "__main__":
    # Bind loopback — open via Orion Ports → 5000
    app.run(host="127.0.0.1", port=5000, debug=True)
`,
      },
      {
        path: 'requirements.txt',
        content: `flask>=3.0.0
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName} (Flask)

## Terminal

\`\`\`bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python3 app.py
# or: flask --app app run --host 127.0.0.1 --port 5000
\`\`\`

Then **Ports → 5000 → Open**.

\`.venv\` stays in the sandbox (not synced to Drive).
`,
      },
    ];
  }

  if (templateId === 'express') {
    return [
      {
        path: 'package.json',
        content: `${JSON.stringify({
          name: safeName,
          private: true,
          version: '1.0.0',
          type: 'module',
          scripts: {
            start: 'node server.js',
            dev: 'node --watch server.js',
          },
          dependencies: {
            express: '^4.21.0',
          },
        }, null, 2)}\n`,
      },
      {
        path: 'server.js',
        content: `import express from 'express';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.get('/', (_req, res) => {
  res.json({ ok: true, message: 'Hello from Orion Express', project: ${JSON.stringify(projectName)} });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(\`Listening on http://127.0.0.1:\${PORT} — open Orion Ports → \${PORT}\`);
});
`,
      },
      {
        path: '.gitignore',
        content: `node_modules
.env
.env.*
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName} (Express)

\`\`\`bash
npm install
npm start
\`\`\`

**Ports → 3000 → Open**. \`node_modules\` is not synced to Drive.
`,
      },
    ];
  }

  if (templateId === 'cpp') {
    return [
      {
        path: 'main.cpp',
        content: `#include <iostream>

int main() {
  std::cout << "Hello from Orion C++\\n";
  return 0;
}
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName} (C++)

## Terminal

\`\`\`bash
g++ main.cpp -o main && ./main
\`\`\`

Or open \`main.cpp\` and use **▶ Run**.
`,
      },
    ];
  }

  if (templateId === 'vite-react') {
    return [
      {
        path: 'package.json',
        content: `${JSON.stringify({
          name: safeName,
          private: true,
          version: '0.0.0',
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'vite build',
            preview: 'vite preview',
          },
          dependencies: {
            react: '^19.0.0',
            'react-dom': '^19.0.0',
          },
          devDependencies: {
            '@vitejs/plugin-react': '^4.3.4',
            vite: '^6.0.0',
          },
        }, null, 2)}\n`,
      },
      {
        path: 'vite.config.js',
        content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Example frontend template. Orion Terminal supports any stack the sandbox has
 * (Python/Flask, Express, C++, …) — React is only one option.
 *
 * Preview via Ports:
 *   ORION_VITE_BASE=/api/terminal/proxy/5173/ npm run dev -- --host 127.0.0.1 --port 5173
 */
const base = process.env.ORION_VITE_BASE || '/';

export default defineConfig({
  plugins: [react()],
  base,
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // HMR works through Orion Ports WebSocket proxy when base is set
    hmr: true,
  },
});
`,
      },
      {
        path: 'index.html',
        content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
      },
      {
        path: 'src/main.jsx',
        content: `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
      },
      {
        path: 'src/App.jsx',
        content: `export default function App() {
  return (
    <main className="app">
      <h1>Orion + React</h1>
      <p>This is one template example. Use Terminal for Python, Flask, Express, C++, git, and more.</p>
      <pre>npm install
ORION_VITE_BASE=/api/terminal/proxy/5173/ npm run dev -- --host 127.0.0.1 --port 5173</pre>
      <p>Then <strong>Ports → 5173</strong>.</p>
    </main>
  );
}
`,
      },
      {
        path: 'src/index.css',
        content: `:root {
  font-family: "Segoe UI", system-ui, sans-serif;
  color: #e6e4df;
  background: #0c0d10;
}

body { margin: 0; }

.app {
  max-width: 42rem;
  margin: 4rem auto;
  padding: 0 1.25rem;
  line-height: 1.5;
}

h1 { color: #d4a84b; font-weight: 600; }

code, pre {
  font-family: "IBM Plex Mono", Consolas, monospace;
  font-size: 0.9rem;
}

pre {
  background: #181a22;
  border: 1px solid #23252f;
  border-radius: 8px;
  padding: 1rem;
  overflow: auto;
}
`,
      },
      {
        path: '.gitignore',
        content: `node_modules
dist
.DS_Store
*.local
.env
.env.*
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName}

Example React (Vite) app. Orion Terminal is polyglot — also use Python/Flask/Express/C++ templates or a Blank project and scaffold yourself.

\`\`\`bash
npm install
ORION_VITE_BASE=/api/terminal/proxy/5173/ npm run dev -- --host 127.0.0.1 --port 5173
\`\`\`

Ports → 5173 → Open. \`node_modules\` is not synced to Drive.
`,
      },
    ];
  }

  if (templateId === 'fastapi') {
    return [
      {
        path: 'main.py',
        content: `from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def root():
    return {"message": "Hello from Orion FastAPI"}


@app.get("/health")
def health():
    return {"ok": True}
`,
      },
      {
        path: 'requirements.txt',
        content: `fastapi>=0.115.0
uvicorn[standard]>=0.32.0
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName}

\`\`\`bash
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
\`\`\`

Ports → 8000 → Open.
`,
      },
    ];
  }

  if (templateId === 'nextjs') {
    return [
      {
        path: 'package.json',
        content: `${JSON.stringify({
          name: safeName,
          private: true,
          scripts: {
            dev: 'next dev -H 127.0.0.1 -p 3000',
            build: 'next build',
            start: 'next start -H 127.0.0.1 -p 3000',
          },
          dependencies: {
            next: '^15.0.0',
            react: '^19.0.0',
            'react-dom': '^19.0.0',
          },
        }, null, 2)}\n`,
      },
      {
        path: 'app/page.jsx',
        content: `export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>${projectName}</h1>
      <p>Next.js on Orion — open Ports 3000 after npm run dev.</p>
    </main>
  );
}
`,
      },
      {
        path: 'app/layout.jsx',
        content: `export const metadata = { title: '${projectName}' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
      },
      {
        path: '.gitignore',
        content: `node_modules
.next
.env*
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName}

\`\`\`bash
npm install
npm run dev
\`\`\`

Ports → 3000 → Open. \`node_modules\` / \`.next\` are not synced to Drive.
`,
      },
    ];
  }

  if (templateId === 'go') {
    return [
      {
        path: 'main.go',
        content: `package main

import "fmt"

func main() {
\tfmt.Println("Hello from Orion Go")
}
`,
      },
      {
        path: 'go.mod',
        content: `module ${safeName}

go 1.21
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName}

\`\`\`bash
go run .
go test ./...
\`\`\`
`,
      },
    ];
  }

  if (templateId === 'rust') {
    return [
      {
        path: 'Cargo.toml',
        content: `[package]
name = "${safeName.replace(/-/g, '_')}"
version = "0.1.0"
edition = "2021"
`,
      },
      {
        path: 'src/main.rs',
        content: `fn main() {
    println!("Hello from Orion Rust");
}
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName}

\`\`\`bash
cargo run
cargo test
\`\`\`
`,
      },
    ];
  }

  if (templateId === 'notebook') {
    const nb = {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {
        kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' },
        language_info: { name: 'python' },
      },
      cells: [
        {
          cell_type: 'markdown',
          metadata: {},
          source: [`# ${projectName}\n`, '\n', 'Edit cells and use **Run** on code cells (Piston).\n'],
        },
        {
          cell_type: 'code',
          metadata: {},
          execution_count: null,
          outputs: [],
          source: ['print("Hello from Orion notebook")\n'],
        },
      ],
    };
    return [
      { path: 'starter.ipynb', content: `${JSON.stringify(nb, null, 1)}\n` },
      {
        path: 'README.md',
        content: `# ${projectName}

Open \`starter.ipynb\` in Orion. Use **Run** on code cells (Piston — no live kernel).
`,
      },
    ];
  }

  if (templateId === 'java') {
    return [
      {
        path: 'Main.java',
        content: `public class Main {
  public static void main(String[] args) {
    System.out.println("Hello from Orion Java");
  }
}
`,
      },
      {
        path: 'README.md',
        content: `# ${projectName}

\`\`\`bash
javac Main.java && java Main
\`\`\`

Or open \`Main.java\` and use ▶ Run.
`,
      },
    ];
  }

  return [];
}
