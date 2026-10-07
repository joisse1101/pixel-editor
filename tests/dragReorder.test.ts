import { describe, expect, it } from 'vitest';
import { dropSlot, slotToPosition } from '../src/ui/dragReorder';

describe('dropSlot', () => {
  const mids = [10, 30, 50];
  it('maps pointer height to the gap between rows', () => {
    expect(dropSlot(0, mids)).toBe(0);
    expect(dropSlot(9, mids)).toBe(0);
    expect(dropSlot(10, mids)).toBe(1);
    expect(dropSlot(40, mids)).toBe(2);
    expect(dropSlot(99, mids)).toBe(3);
  });
  it('handles an empty list', () => {
    expect(dropSlot(5, [])).toBe(0);
  });
});

describe('slotToPosition', () => {
  it('is a no-op for the slots on either side of the dragged row', () => {
    expect(slotToPosition(2, 2)).toBeNull();
    expect(slotToPosition(2, 3)).toBeNull();
  });
  it('accounts for removing the dragged row when moving down', () => {
    expect(slotToPosition(0, 2)).toBe(1);
    expect(slotToPosition(0, 4)).toBe(3);
  });
  it('uses the slot directly when moving up', () => {
    expect(slotToPosition(3, 0)).toBe(0);
    expect(slotToPosition(3, 1)).toBe(1);
  });
});
