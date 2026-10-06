/** Colours for overlay levels, cycled in the order the levels were entered. */
export const LEVEL_COLORS = ['#ff5a5a', '#4ad8ff', '#7dff6a', '#ffd84a', '#ff7af0'];

/** Parses "16, 32" into unique cell sizes (whole numbers of at least 2), in the order given. Junk is ignored. */
export function parseGridLevels(text: string): number[] {
  const out: number[] = [];
  for (const part of text.split(/[\s,;]+/)) {
    if (!/^\d+$/.test(part)) continue;
    const n = Number(part);
    if (n >= 2 && n <= 4096 && !out.includes(n)) out.push(n);
  }
  return out;
}
