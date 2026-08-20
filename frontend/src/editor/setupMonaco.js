/**
 * One-time Monaco bootstrap: themes, JS/TS IntelliSense, multi-language completions.
 */

import { registerLanguageCompletions } from './completions/register';
import { registerTabCompletions } from './completions/tabCompletions';

let bootstrapped = false;

/** Extra ambient types so browser + Node APIs complete in JS/TS. */
const EXTRA_LIBS = `
/** Orion ambient libs for richer IntelliSense */
interface Console {
  log(...data: any[]): void;
  warn(...data: any[]): void;
  error(...data: any[]): void;
  info(...data: any[]): void;
  debug(...data: any[]): void;
  table(...data: any[]): void;
  time(label?: string): void;
  timeEnd(label?: string): void;
  assert(condition?: boolean, ...data: any[]): void;
  clear(): void;
}
declare var console: Console;
declare function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
declare function setTimeout(handler: TimerHandler, timeout?: number, ...args: any[]): number;
declare function setInterval(handler: TimerHandler, timeout?: number, ...args: any[]): number;
declare function clearTimeout(id?: number): void;
declare function clearInterval(id?: number): void;
declare var localStorage: Storage;
declare var sessionStorage: Storage;
declare var document: Document;
declare var window: Window & typeof globalThis;
declare var process: { env: Record<string, string | undefined>; cwd(): string; argv: string[] };
declare function require(id: string): any;
declare var module: { exports: any };
declare var exports: any;
declare var __dirname: string;
declare var __filename: string;
`;

export function bootstrapMonaco(monaco) {
  if (!monaco || bootstrapped) return;
  bootstrapped = true;

  // ── JavaScript / TypeScript language service ──────────────────────────
  const ts = monaco.languages.typescript;
  const compilerOptions = {
    target: ts.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    module: ts.ModuleKind.ESNext,
    noEmit: true,
    esModuleInterop: true,
    allowJs: true,
    checkJs: false,
    jsx: ts.JsxEmit.React,
    reactNamespace: 'React',
    allowSyntheticDefaultImports: true,
    lib: ['es2022', 'dom', 'dom.iterable'],
  };

  ts.javascriptDefaults.setCompilerOptions(compilerOptions);
  ts.typescriptDefaults.setCompilerOptions({
    ...compilerOptions,
    strict: false,
  });

  ts.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false,
  });
  ts.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false,
  });

  ts.javascriptDefaults.setEagerModelSync(true);
  ts.typescriptDefaults.setEagerModelSync(true);

  ts.javascriptDefaults.addExtraLib(EXTRA_LIBS, 'ts:orion-ambient.d.ts');
  ts.typescriptDefaults.addExtraLib(EXTRA_LIBS, 'ts:orion-ambient.d.ts');

  // Lightweight React stubs so JSX/TSX completes common APIs.
  const reactStub = `
declare module 'react' {
  export type ReactNode = any;
  export interface FC<P = {}> { (props: P): any }
  export function useState<T>(init: T | (() => T)): [T, (v: T | ((p: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useMemo<T>(factory: () => T, deps: any[]): T;
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps: any[]): T;
  export function useRef<T>(init: T): { current: T };
  export function useContext<T>(ctx: any): T;
  export function createElement(type: any, props?: any, ...children: any[]): any;
  export function Fragment(props: { children?: any }): any;
  const React: { createElement: typeof createElement; Fragment: typeof Fragment };
  export default React;
}
declare module 'react-dom/client' {
  export function createRoot(el: Element | null): { render(node: any): void };
}
`;
  ts.javascriptDefaults.addExtraLib(reactStub, 'ts:orion-react.d.ts');
  ts.typescriptDefaults.addExtraLib(reactStub, 'ts:orion-react.d.ts');

  // ── Completions for every language Orion supports ─────────────────────
  registerLanguageCompletions(monaco);
  registerTabCompletions(monaco);
}

/** Editor options that keep suggestions permanently aggressive. */
export const SUGGEST_EDITOR_OPTIONS = {
  quickSuggestions: {
    other: true,
    comments: true,
    strings: true,
  },
  suggestOnTriggerCharacters: true,
  acceptSuggestionOnCommitCharacter: true,
  acceptSuggestionOnEnter: 'on',
  tabCompletion: 'on',
  wordBasedSuggestions: 'allDocuments',
  snippetSuggestions: 'inline',
  suggestSelection: 'first',
  inlineSuggest: { enabled: true },
  suggest: {
    showKeywords: true,
    showSnippets: true,
    showClasses: true,
    showFunctions: true,
    showVariables: true,
    showModules: true,
    showProperties: true,
    showMethods: true,
    showWords: true,
    showValues: true,
    showConstants: true,
    showEnums: true,
    showEnumMembers: true,
    showColors: true,
    showFiles: true,
    showFolders: true,
    showTypeParameters: true,
    showIssues: true,
    showUsers: true,
    showIcons: true,
    showStatusBar: true,
    preview: true,
    insertMode: 'insert',
    filterGraceful: true,
    localityBonus: true,
    shareSuggestSelections: true,
  },
  parameterHints: { enabled: true, cycle: true },
  hover: { enabled: true, delay: 200 },
  autoClosingBrackets: 'languageDefined',
  autoClosingQuotes: 'languageDefined',
  autoSurround: 'languageDefined',
  formatOnType: false,
  formatOnPaste: false,
};
