/**
 * Language → stdio language-server command.
 * Prefer globally installed binaries; fall back to npx packages.
 */

const path = require('path');

function npx(pkg, args = []) {
  return {
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['--yes', pkg, ...args],
    shell: process.platform === 'win32',
  };
}

/** @type {Record<string, { command: string, args: string[], shell?: boolean, env?: Record<string,string> }[]>} */
const SERVER_CANDIDATES = {
  python: [
    { command: 'pyright-langserver', args: ['--stdio'] },
    npx('pyright', ['--langserver', '--stdio']),
    npx('pyright-langserver', ['--stdio']),
  ],
  javascript: [
    { command: 'typescript-language-server', args: ['--stdio'] },
    npx('typescript-language-server', ['--stdio']),
  ],
  typescript: [
    { command: 'typescript-language-server', args: ['--stdio'] },
    npx('typescript-language-server', ['--stdio']),
  ],
  json: [
    { command: 'vscode-json-language-server', args: ['--stdio'] },
    npx('vscode-langservers-extracted', ['vscode-json-language-server', '--stdio']),
  ],
  html: [
    { command: 'vscode-html-language-server', args: ['--stdio'] },
    npx('vscode-langservers-extracted', ['vscode-html-language-server', '--stdio']),
  ],
  css: [
    { command: 'vscode-css-language-server', args: ['--stdio'] },
    npx('vscode-langservers-extracted', ['vscode-css-language-server', '--stdio']),
  ],
  scss: [
    { command: 'vscode-css-language-server', args: ['--stdio'] },
    npx('vscode-langservers-extracted', ['vscode-css-language-server', '--stdio']),
  ],
  c: [
    { command: 'clangd', args: ['--background-index', '--clang-tidy'] },
  ],
  cpp: [
    { command: 'clangd', args: ['--background-index', '--clang-tidy'] },
  ],
  go: [
    { command: 'gopls', args: ['serve'] },
  ],
  rust: [
    { command: 'rust-analyzer', args: [] },
  ],
  java: [
    // Optional: eclipse.jdt.ls is heavy; skip unless configured
  ],
  yaml: [
    { command: 'yaml-language-server', args: ['--stdio'] },
    npx('yaml-language-server', ['--stdio']),
  ],
};

/** Map Monaco / Orion language ids → server key */
const LANGUAGE_ALIASES = {
  javascriptreact: 'javascript',
  typescriptreact: 'typescript',
  jsx: 'javascript',
  tsx: 'typescript',
  shell: null,
  shellscript: null,
  plaintext: null,
  markdown: null,
};

function resolveLanguage(languageId = '') {
  const id = String(languageId || '').toLowerCase();
  if (LANGUAGE_ALIASES[id] === null) return null;
  return LANGUAGE_ALIASES[id] || id;
}

function getCandidates(languageId) {
  const key = resolveLanguage(languageId);
  if (!key) return [];
  return SERVER_CANDIDATES[key] || [];
}

function listSupportedLanguages() {
  return Object.keys(SERVER_CANDIDATES).filter((k) => (SERVER_CANDIDATES[k] || []).length > 0);
}

module.exports = {
  getCandidates,
  resolveLanguage,
  listSupportedLanguages,
  WORKSPACE_VIRTUAL_PREFIX: '/workspace',
};
