import { describe, expect, it } from 'vitest';
import { parseGridLevels } from '../src/pixel/gridLevels';

describe('parseGridLevels', () => {
  it('parses comma and space separated sizes in order', () => {
    expect(parseGridLevels('16, 32')).toEqual([16, 32]);
    expect(parseGridLevels('32 16;8')).toEqual([32, 16, 8]);
  });

  it('drops junk, duplicates and out-of-range values', () => {
    expect(parseGridLevels('16, x, 16, 0, 1, -4, 1.5, 99999')).toEqual([16]);
    expect(parseGridLevels('')).toEqual([]);
  });
});
