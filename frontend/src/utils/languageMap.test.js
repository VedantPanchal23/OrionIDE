import { describe, expect, it } from 'vitest';
import {
  getMonacoLanguage,
  getLanguageByFileName,
  getLanguageAbbr,
} from './languageMap';

describe('languageMap', () => {
  it('maps common extensions to Monaco languages', () => {
    expect(getMonacoLanguage('main.py')).toBe('python');
    expect(getMonacoLanguage('app.tsx')).toBe('typescript');
    expect(getMonacoLanguage('index.js')).toBe('javascript');
    expect(getMonacoLanguage('readme.md')).toBe('markdown');
    expect(getMonacoLanguage('starter.ipynb')).toBe('json');
  });

  it('returns piston language for run', () => {
    expect(getLanguageByFileName('main.py').pistonLanguage).toBe('python');
    expect(getLanguageByFileName('app.js').pistonLanguage).toBe('javascript');
  });

  it('provides file templates', () => {
    expect(getLanguageByFileName('x.py').fileTemplate).toContain('print');
  });

  it('abbr falls back for unknown', () => {
    expect(getLanguageAbbr('notes.txt')).toBe('TXT');
  });
});
