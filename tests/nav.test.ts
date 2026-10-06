import { describe, expect, it } from 'vitest';
import { navHtml } from '../src/ui/nav';

describe('navHtml', () => {
  it('links both pages and marks only the current one', () => {
    const html = navHtml('pixel');
    expect(html).toContain('<a href="./index.html">Map Editor</a>');
    expect(html).toContain('<a href="./pixel.html" class="current" aria-current="page">Pixel Art Editor</a>');
    expect(html.match(/class="current"/g)).toHaveLength(1);
  });

  it('marks the map page when current', () => {
    const html = navHtml('map');
    expect(html).toContain('<a href="./index.html" class="current" aria-current="page">Map Editor</a>');
    expect(html).toContain('<a href="./pixel.html">Pixel Art Editor</a>');
  });
});
