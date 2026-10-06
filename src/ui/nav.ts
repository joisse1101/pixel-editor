export type Page = 'map' | 'pixel';

const links: { page: Page; href: string; label: string }[] = [
  { page: 'map', href: './index.html', label: 'Map Editor' },
  { page: 'pixel', href: './pixel.html', label: 'Pixel Art Editor' },
];

/** Markup of the top navigation bar with the link of `current` marked. */
export function navHtml(current: Page): string {
  const items = links
    .map((l) => `<a href="${l.href}"${l.page === current ? ' class="current" aria-current="page"' : ''}>${l.label}</a>`)
    .join('');
  return `<nav class="app-nav">${items}</nav>`;
}

/** Puts the navigation bar first in #app. Call after the page has set #app's content. */
export function mountNav(current: Page): void {
  document.getElementById('app')!.insertAdjacentHTML('afterbegin', navHtml(current));
}
