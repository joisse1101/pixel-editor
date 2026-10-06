import { describe, expect, it } from 'vitest';
import { loadMapJson, loadOfficeJson, loadSpritesheetPng } from './fixtures';

describe('fixtures', () => {
  it('loads the sample files', () => {
    const office = loadOfficeJson() as any;
    expect(office.layers).toHaveLength(10);
    expect(loadMapJson().width).toBe(40);
    // PNG signature
    expect(loadSpritesheetPng().subarray(1, 4).toString('ascii')).toBe('PNG');
  });
});
