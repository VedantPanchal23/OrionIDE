/**
 * Official brand / language file icons (Simple Icons via react-icons).
 * Used in Explorer, tabs, Git, search, and command palette.
 */

import {
  SiC,
  SiCplusplus,
  SiCss,
  SiDart,
  SiDocker,
  SiDotnet,
  SiGo,
  SiHtml5,
  SiJavascript,
  SiJson,
  SiKotlin,
  SiLess,
  SiLua,
  SiMarkdown,
  SiOpenjdk,
  SiPhp,
  SiPython,
  SiReact,
  SiRuby,
  SiRust,
  SiSass,
  SiSqlite,
  SiSvelte,
  SiSwift,
  SiToml,
  SiTypescript,
  SiVuedotjs,
  SiXml,
  SiYaml,
  SiGnubash,
  SiShell,
  SiDotenv,
  SiGit,
  SiVite,
  SiNodedotjs,
  SiR,
} from 'react-icons/si';
import {
  VscFile,
  VscFileMedia,
  VscFolder,
  VscFolderOpened,
  VscLock,
  VscSettingsGear,
  VscTerminalPowershell,
  VscJson as VscJsonAlt,
} from 'react-icons/vsc';

function BrandIcon({ Icon, color, size = 14, title, className, bg }) {
  const icon = (
    <Icon
      size={size}
      color={color}
      title={title}
      className={`file-brand-icon ${className || ''}`.trim()}
      style={{ flexShrink: 0, display: 'block' }}
      aria-hidden="true"
    />
  );
  if (!bg) return icon;
  return (
    <span
      className={`file-brand-wrap ${className || ''}`.trim()}
      title={title}
      style={{
        width: size,
        height: size,
        minWidth: size,
        background: bg,
        borderRadius: 3,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <Icon size={Math.max(10, size - 2)} color={color} style={{ display: 'block' }} />
    </span>
  );
}

function FallbackBadge({ label, bg, fg = '#e8e8f0', size = 14, title, className }) {
  const fontSize = label.length > 2 ? Math.max(7, size * 0.42) : Math.max(8, size * 0.55);
  return (
    <span
      className={`file-badge ${className || ''}`.trim()}
      title={title}
      style={{
        width: size,
        height: size,
        minWidth: size,
        background: bg,
        color: fg,
        fontSize,
      }}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}

/** Extension → official icon */
const EXT_ICONS = {
  js: { Icon: SiJavascript, color: '#F7DF1E', title: 'JavaScript', bg: '#2b2b2b' },
  mjs: { Icon: SiJavascript, color: '#F7DF1E', title: 'JavaScript', bg: '#2b2b2b' },
  cjs: { Icon: SiJavascript, color: '#F7DF1E', title: 'JavaScript', bg: '#2b2b2b' },
  jsx: { Icon: SiReact, color: '#61DAFB', title: 'React JSX' },
  ts: { Icon: SiTypescript, color: '#3178C6', title: 'TypeScript' },
  tsx: { Icon: SiReact, color: '#61DAFB', title: 'React TSX' },
  py: { Icon: SiPython, color: '#3776AB', title: 'Python' },
  pyw: { Icon: SiPython, color: '#3776AB', title: 'Python' },
  go: { Icon: SiGo, color: '#00ADD8', title: 'Go' },
  rs: { Icon: SiRust, color: '#DEA584', title: 'Rust' },
  java: { Icon: SiOpenjdk, color: '#EA2D2E', title: 'Java' },
  kt: { Icon: SiKotlin, color: '#7F52FF', title: 'Kotlin' },
  kts: { Icon: SiKotlin, color: '#7F52FF', title: 'Kotlin' },
  c: { Icon: SiC, color: '#A8B9CC', title: 'C' },
  h: { Icon: SiC, color: '#A8B9CC', title: 'C Header' },
  cpp: { Icon: SiCplusplus, color: '#00599C', title: 'C++' },
  cc: { Icon: SiCplusplus, color: '#00599C', title: 'C++' },
  cxx: { Icon: SiCplusplus, color: '#00599C', title: 'C++' },
  hpp: { Icon: SiCplusplus, color: '#004482', title: 'C++ Header' },
  hh: { Icon: SiCplusplus, color: '#004482', title: 'C++ Header' },
  cs: { Icon: SiDotnet, color: '#512BD4', title: 'C#' },
  rb: { Icon: SiRuby, color: '#CC342D', title: 'Ruby' },
  php: { Icon: SiPhp, color: '#777BB4', title: 'PHP' },
  swift: { Icon: SiSwift, color: '#F05138', title: 'Swift' },
  dart: { Icon: SiDart, color: '#0175C2', title: 'Dart' },
  lua: { Icon: SiLua, color: '#000080', title: 'Lua' },
  r: { Icon: SiR, color: '#276DC3', title: 'R' },
  json: { Icon: SiJson, color: '#CBB41A', title: 'JSON' },
  jsonc: { Icon: SiJson, color: '#CBB41A', title: 'JSON' },
  md: { Icon: SiMarkdown, color: '#083FA1', title: 'Markdown' },
  markdown: { Icon: SiMarkdown, color: '#083FA1', title: 'Markdown' },
  html: { Icon: SiHtml5, color: '#E34F26', title: 'HTML' },
  htm: { Icon: SiHtml5, color: '#E34F26', title: 'HTML' },
  css: { Icon: SiCss, color: '#1572B6', title: 'CSS' },
  scss: { Icon: SiSass, color: '#CC6699', title: 'SCSS' },
  sass: { Icon: SiSass, color: '#CC6699', title: 'Sass' },
  less: { Icon: SiLess, color: '#1D365D', title: 'Less' },
  vue: { Icon: SiVuedotjs, color: '#4FC08D', title: 'Vue' },
  svelte: { Icon: SiSvelte, color: '#FF3E00', title: 'Svelte' },
  yml: { Icon: SiYaml, color: '#CB171E', title: 'YAML' },
  yaml: { Icon: SiYaml, color: '#CB171E', title: 'YAML' },
  xml: { Icon: SiXml, color: '#F16529', title: 'XML' },
  sql: { Icon: SiSqlite, color: '#003B57', title: 'SQL' },
  sh: { Icon: SiGnubash, color: '#4EAA25', title: 'Shell' },
  bash: { Icon: SiGnubash, color: '#4EAA25', title: 'Shell' },
  zsh: { Icon: SiGnubash, color: '#4EAA25', title: 'Shell' },
  ps1: { Icon: VscTerminalPowershell, color: '#5391FE', title: 'PowerShell' },
  bat: { Icon: SiShell, color: '#C1F12E', title: 'Batch' },
  cmd: { Icon: SiShell, color: '#C1F12E', title: 'Batch' },
  env: { Icon: SiDotenv, color: '#ECD53F', title: 'Env', bg: '#2b2b2b' },
  toml: { Icon: SiToml, color: '#9C4121', title: 'TOML' },
  ini: { Icon: VscSettingsGear, color: '#9a9aa0', title: 'INI' },
  conf: { Icon: VscSettingsGear, color: '#9a9aa0', title: 'Config' },
  lock: { Icon: VscLock, color: '#9a9aa0', title: 'Lockfile' },
  txt: { Icon: VscFile, color: '#9a9aa0', title: 'Text' },
  log: { Icon: VscFile, color: '#9a9aa0', title: 'Log' },
  png: { Icon: VscFileMedia, color: '#a78bfa', title: 'Image' },
  jpg: { Icon: VscFileMedia, color: '#a78bfa', title: 'Image' },
  jpeg: { Icon: VscFileMedia, color: '#a78bfa', title: 'Image' },
  gif: { Icon: VscFileMedia, color: '#a78bfa', title: 'Image' },
  webp: { Icon: VscFileMedia, color: '#a78bfa', title: 'Image' },
  svg: { Icon: VscFileMedia, color: '#CBB41A', title: 'SVG' },
  gitignore: { Icon: SiGit, color: '#F05032', title: 'Git ignore' },
  gitattributes: { Icon: SiGit, color: '#F05032', title: 'Git attributes' },
};

const NAME_ICONS = {
  dockerfile: { Icon: SiDocker, color: '#2496ED', title: 'Dockerfile' },
  makefile: { Icon: VscSettingsGear, color: '#6d6d6d', title: 'Makefile' },
  gemfile: { Icon: SiRuby, color: '#CC342D', title: 'Gemfile' },
  'package.json': { Icon: SiNodedotjs, color: '#339933', title: 'package.json' },
  'package-lock.json': { Icon: VscLock, color: '#9a9aa0', title: 'Lockfile' },
  'tsconfig.json': { Icon: SiTypescript, color: '#3178C6', title: 'tsconfig' },
  'vite.config.js': { Icon: SiVite, color: '#646CFF', title: 'Vite' },
  'vite.config.ts': { Icon: SiVite, color: '#646CFF', title: 'Vite' },
  'vite.config.mjs': { Icon: SiVite, color: '#646CFF', title: 'Vite' },
  '.env': { Icon: SiDotenv, color: '#ECD53F', title: 'Env', bg: '#2b2b2b' },
  '.env.local': { Icon: SiDotenv, color: '#ECD53F', title: 'Env', bg: '#2b2b2b' },
  '.env.example': { Icon: SiDotenv, color: '#ECD53F', title: 'Env', bg: '#2b2b2b' },
  '.gitignore': { Icon: SiGit, color: '#F05032', title: 'Git ignore' },
  'readme.md': { Icon: SiMarkdown, color: '#083FA1', title: 'README' },
  readme: { Icon: SiMarkdown, color: '#083FA1', title: 'README' },
  '.orion-sync.json': { Icon: VscJsonAlt, color: '#d4a84b', title: 'Orion sync' },
  'orion-sync.json': { Icon: VscJsonAlt, color: '#d4a84b', title: 'Orion sync' },
};

export function getExt(name = '') {
  const parts = String(name).split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function resolveIcon(name = '') {
  const lower = String(name).toLowerCase();
  const base = lower.split(/[/\\]/).pop() || lower;

  if (NAME_ICONS[lower]) return NAME_ICONS[lower];
  if (NAME_ICONS[base]) return NAME_ICONS[base];
  if (base === 'readme' || base.startsWith('readme.')) return NAME_ICONS['readme.md'];
  if (base === 'dockerfile' || base.startsWith('dockerfile.')) return NAME_ICONS.dockerfile;

  // Compound: component.module.css etc. — use last extension
  const ext = getExt(name);
  if (EXT_ICONS[ext]) return EXT_ICONS[ext];

  return null;
}

export function FileIcon({ name, size = 14, className }) {
  const meta = resolveIcon(name);
  if (meta) {
    return (
      <BrandIcon
        Icon={meta.Icon}
        color={meta.color}
        bg={meta.bg}
        size={size}
        title={meta.title}
        className={className}
      />
    );
  }
  const ext = getExt(name);
  return (
    <FallbackBadge
      label={(ext || '?').slice(0, 2).toUpperCase()}
      bg="#5a5a64"
      size={size}
      title={name}
      className={className}
    />
  );
}

export function FolderIcon({ open, size = 14 }) {
  const Icon = open ? VscFolderOpened : VscFolder;
  return (
    <Icon
      size={size}
      color="var(--folder, #d4a84b)"
      className="folder-badge"
      style={{ flexShrink: 0, display: 'block' }}
      aria-hidden="true"
    />
  );
}

/** Normalize git porcelain / API status to a single glyph for the SCM list. */
export function gitStatusGlyph(status, sectionTitle = '') {
  const raw = String(status || '').trim();
  const upper = raw.toUpperCase();
  if (!raw) {
    if (/untracked/i.test(sectionTitle)) return 'U';
    return 'M';
  }
  if (upper === 'UNTRACKED' || upper === '??' || upper === 'U') return 'U';
  if (upper === 'ADDED' || upper === 'A') return 'A';
  if (upper === 'DELETED' || upper === 'D') return 'D';
  if (upper === 'RENAMED' || upper === 'R') return 'R';
  if (upper === 'COPIED' || upper === 'C') return 'C';
  if (upper === 'MODIFIED' || upper === 'M') return 'M';
  if (raw.length <= 2) return upper.slice(0, 1) || 'M';
  return upper.charAt(0);
}
