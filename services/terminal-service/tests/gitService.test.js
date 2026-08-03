/**
 * Unit tests for git status porcelain parsing
 */

const { parseStatus } = require('../src/services/gitService');

describe('gitService.parseStatus', () => {
  test('parses staged, unstaged, and untracked', () => {
    const porcelain = [
      'M  staged.js',
      ' M unstaged.js',
      'MM both.js',
      '?? new.js',
      'A  added.js',
      'D  deleted.js',
    ].join('\n');

    const result = parseStatus(porcelain);
    expect(result.staged.map((f) => f.path)).toEqual(
      expect.arrayContaining(['staged.js', 'both.js', 'added.js', 'deleted.js'])
    );
    expect(result.unstaged.map((f) => f.path)).toEqual(
      expect.arrayContaining(['unstaged.js', 'both.js'])
    );
    expect(result.untracked).toEqual([{ path: 'new.js', status: 'untracked' }]);
  });

  test('handles rename paths', () => {
    const result = parseStatus('R  old.js -> new.js\n');
    expect(result.staged[0].path).toBe('new.js');
    expect(result.staged[0].status).toBe('renamed');
  });
});
