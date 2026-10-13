// Color, markings, and breed anatomy are independent: new variants reuse the SVG.
export type WingPattern = 'bar' | 'checker' | 'plain' | 'grizzle' | 'pied';
export type Breed = 'rock' | 'fantail' | 'jacobin' | 'owl';
const blue = {
  tail: '#525b6a', breast: '#99a3af', neck: '#55887f', iridescence: '#887398',
  wing: '#bdc5ce', bars: '#535e70', feather: '#929dab', flight: '#b8c3cf',
  'flight-bars': '#59677b', head: '#7c899a', highlight: '#b9c1c9', iris: '#e7a452',
};
type Palette = typeof blue;
const red: Palette = { ...blue, tail: '#745247', breast: '#c4aaa0', neck: '#9c705f', iridescence: '#986d87', wing: '#d6c5b6', bars: '#8d5545', feather: '#ad8b77', flight: '#d2bdb0', 'flight-bars': '#8d5545', head: '#ac8a7a', highlight: '#e0c9ba' };
const white: Palette = { ...blue, tail: '#c9c8c2', breast: '#f0ede5', neck: '#e4e8df', iridescence: '#e5dce5', wing: '#f5f2e9', bars: '#c6c5bd', feather: '#d8d6cd', flight: '#eeece3', 'flight-bars': '#b9bab4', head: '#e3e3db', highlight: '#fffdf6', iris: '#493b35' };
const dark: Palette = { ...blue, tail: '#30313b', breast: '#535361', neck: '#41665e', iridescence: '#6c547b', wing: '#6b6a78', bars: '#30313b', feather: '#858491', flight: '#777784', 'flight-bars': '#383844', head: '#555564', highlight: '#777783' };
const brown: Palette = { ...red, tail: '#665046', breast: '#ad9483', head: '#937966', wing: '#c7b59d', bars: '#705648', neck: '#89755b', iridescence: '#a58b80' };
interface Appearance { label: string; palette: Palette; pattern: WingPattern; breed: Breed }
const morph = (label: string, palette: Palette, pattern: WingPattern = 'bar', breed: Breed = 'rock'): Appearance => ({ label, palette, pattern, breed });
export const appearances = {
  city: morph('Blue bar rock pigeon', blue),
  red: morph('Ash-red bar', red),
  white: morph('Recessive white', white, 'plain'),
  dark: morph('Spread black', dark, 'plain'),
  checker: morph('Blue checker', blue, 'checker'),
  't-check': morph('Blue T-check', { ...dark, wing: '#858895' }, 'checker'),
  barless: morph('Blue barless', blue, 'plain'),
  brown: morph('Brown bar', brown),
  grizzle: morph('Blue grizzle', { ...blue, head: '#b5bcc4', breast: '#c4c9cf' }, 'grizzle'),
  pied: morph('Blue pied', blue, 'pied'),
  'recessive-red': morph('Recessive red', { ...red, breast: '#ac6e4f', wing: '#b77a58', head: '#ae7353', neck: '#a3674e', tail: '#925c43' }, 'plain'),
  fantail: morph('White Fantail', white, 'plain', 'fantail'),
  jacobin: morph('Red Jacobin', { ...red, head: white.head }, 'plain', 'jacobin'),
  owl: morph('Blue shield Old German Owl', { ...white, wing: blue.wing, bars: blue.bars, flight: blue.flight, 'flight-bars': blue['flight-bars'] }, 'bar', 'owl'),
} satisfies Record<string, Appearance>;
export type AppearanceName = keyof typeof appearances;
export const companionAppearances = Object.keys(appearances).filter((name): name is Exclude<AppearanceName, 'city'> => name !== 'city');

export function applyAppearance(element: HTMLElement, name: AppearanceName) {
  const { palette, pattern, breed } = appearances[name];
  element.dataset.appearance = name;
  element.dataset.pattern = pattern;
  element.dataset.breed = breed;
  for (const [part, color] of Object.entries(palette)) element.style.setProperty(`--pigeon-${part}`, color);
}
