import { describe, expect, it } from 'vitest';
import { replaceAllInText } from './searchReplace';

describe('replaceAllInText', () => {
  it('replaces case-insensitively and counts matches', () => {
    const { text, count } = replaceAllInText('Foo foo FOO', 'foo', 'bar');
    expect(count).toBe(3);
    expect(text).toBe('bar bar bar');
  });

  it('returns unchanged text when query empty', () => {
    const { text, count } = replaceAllInText('hello', '  ', 'x');
    expect(count).toBe(0);
    expect(text).toBe('hello');
  });
});
