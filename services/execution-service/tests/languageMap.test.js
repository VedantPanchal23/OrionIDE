/**
 * Orion IDE — Language Map Tests
 */

const { getByExtension, getById, getByPistonId, getExecutableLanguages, buildPistonRequest, LANGUAGES } = require('../src/services/languageMap');

describe('Language Map', () => {
  test('getByExtension(".py") returns Python', () => {
    const lang = getByExtension('.py');
    expect(lang).not.toBeNull();
    expect(lang.id).toBe('python');
    expect(lang.displayName).toBe('Python');
    expect(lang.pistonLanguage).toBe('python');
  });

  test('getByExtension(".cpp") returns C++', () => {
    const lang = getByExtension('.cpp');
    expect(lang).not.toBeNull();
    expect(lang.id).toBe('cpp');
    expect(lang.displayName).toBe('C++');
  });

  test('getByExtension(".cc") returns C++ (alternate)', () => {
    const lang = getByExtension('.cc');
    expect(lang).not.toBeNull();
    expect(lang.id).toBe('cpp');
  });

  test('getByExtension(".unknown") returns null', () => {
    expect(getByExtension('.unknown')).toBeNull();
  });

  test('getByExtension without dot works', () => {
    const lang = getByExtension('rs');
    expect(lang).not.toBeNull();
    expect(lang.id).toBe('rust');
  });

  test('getById("rust") returns Rust', () => {
    const lang = getById('rust');
    expect(lang).not.toBeNull();
    expect(lang.displayName).toBe('Rust');
    expect(lang.pistonLanguage).toBe('rust');
    expect(lang.color).toBe('#DEA584');
  });

  test('getById("nonexistent") returns null', () => {
    expect(getById('nonexistent')).toBeNull();
  });

  test('getByPistonId("python") returns Python', () => {
    const lang = getByPistonId('python');
    expect(lang).not.toBeNull();
    expect(lang.id).toBe('python');
  });

  test('getExecutableLanguages returns 18 languages', () => {
    const exec = getExecutableLanguages();
    expect(exec.length).toBe(18);
    expect(exec.every((l) => l.pistonLanguage !== null)).toBe(true);
  });

  test('all 18 executable languages have required fields', () => {
    const exec = getExecutableLanguages();
    exec.forEach((lang) => {
      expect(lang.id).toBeTruthy();
      expect(lang.displayName).toBeTruthy();
      expect(lang.extensions.length).toBeGreaterThan(0);
      expect(lang.monacoLanguage).toBeTruthy();
      expect(lang.pistonLanguage).toBeTruthy();
      expect(lang.pistonVersion).toBeTruthy();
      expect(lang.runCommand).toBeTruthy();
      expect(lang.icon).toBeTruthy();
      expect(lang.color).toBeTruthy();
      expect(lang.fileTemplate).toBeTruthy();
    });
  });

  test('LANGUAGES includes all 18 executable IDs', () => {
    const ids = ['python', 'javascript', 'typescript', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'php', 'ruby', 'kotlin', 'swift', 'bash', 'r', 'dart', 'lua', 'perl'];
    ids.forEach((id) => {
      expect(getById(id)).not.toBeNull();
    });
  });

  test('buildPistonRequest returns correct shape for Python', () => {
    const req = buildPistonRequest('python', 'main.py', 'print("hi")', '');
    expect(req).toEqual({
      language: 'python',
      version: '3.10.0',
      files: [{ name: 'main.py', content: 'print("hi")' }],
      stdin: '',
      run_timeout: 30000,
      compile_timeout: 30000,
    });
  });

  test('buildPistonRequest for all 18 languages produces valid output', () => {
    const exec = getExecutableLanguages();
    exec.forEach((lang) => {
      const req = buildPistonRequest(lang.id, 'test.file', 'code', '');
      expect(req.language).toBe(lang.pistonLanguage);
      expect(req.version).toBe(lang.pistonVersion);
      expect(req.files.length).toBe(1);
      expect(req.run_timeout).toBe(30000);
    });
  });

  test('buildPistonRequest throws for non-executable language', () => {
    expect(() => buildPistonRequest('html', 'test.html', '<html/>', '')).toThrow('not executable');
  });

  test('buildPistonRequest throws for unknown language', () => {
    expect(() => buildPistonRequest('unknown', 'test', 'code', '')).toThrow();
  });

  test('compiled languages have compileCommand', () => {
    const compiled = ['java', 'c', 'cpp', 'rust', 'kotlin'];
    compiled.forEach((id) => {
      const lang = getById(id);
      expect(lang.compileCommand).not.toBeNull();
    });
  });

  test('interpreted languages have null compileCommand', () => {
    const interpreted = ['python', 'javascript', 'ruby', 'php', 'bash', 'lua', 'perl'];
    interpreted.forEach((id) => {
      const lang = getById(id);
      expect(lang.compileCommand).toBeNull();
    });
  });

  test('R language is case-insensitive on extension', () => {
    const r1 = getByExtension('.r');
    const r2 = getByExtension('.R');
    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
    expect(r1.id).toBe('r');
    expect(r2.id).toBe('r');
  });
});
