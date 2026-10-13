// Color, markings, and breed anatomy are independent: new variants reuse the SVG.
export type WingPattern = 'bar' | 'checker' | 'plain' | 'grizzle' | 'pied';
export type Breed = 'rock' | 'fantail' | 'jacobin' | 'owl';
// Cornell's identification guide describes blue-gray birds with green/purple throat
// iridescence: neck and iridescence are separate flat-color layers to suggest it.
// https://www.allaboutbirds.org/guide/rock_pigeon/id
// All hex colors, contour shading, and highlights are illustration choices.
const blue = {
  tail: '#525b6a', breast: '#99a3af', neck: '#55887f', iridescence: '#887398',
  wing: '#b8c4d0', bars: '#535e70', feather: '#929dab', flight: '#b8c3cf',
  'flight-bars': '#59677b', head: '#6e7d90', highlight: '#c1ccd6', contour: '#657385', iris: '#e7a452',
};
type Palette = typeof blue;
const red: Palette = { ...blue, tail: '#745247', breast: '#c4aaa0', neck: '#9c705f', iridescence: '#986d87', wing: '#cbb7ab', bars: '#8d5545', feather: '#ad8b77', flight: '#d2bdb0', 'flight-bars': '#8d5545', head: '#98796f', highlight: '#dfc7bc', contour: '#896e65' };
// White feathers lack colored pigment (Utah's inherited-characteristics gallery).
// Cool gray shadows and a muted contour make white feathers readable on cream;
// these shadows suggest feather relief, not a gray pigment mutation.
// https://learn.genetics.utah.edu/content/pigeons/other/
const white: Palette = { ...blue, tail: '#bbc3c4', breast: '#e6e8e5', neck: '#cfd8d2', iridescence: '#d8d1dd', wing: '#f3f2eb', bars: '#c6c5bd', feather: '#aab6b9', flight: '#eeece3', 'flight-bars': '#b9bab4', head: '#dfe3df', highlight: '#faf9f3', contour: '#96a4a7', iris: '#493b35' };
const dark: Palette = { ...blue, tail: '#30313b', breast: '#444c59', neck: '#37695e', iridescence: '#795d89', wing: '#596373', bars: '#30313b', feather: '#858491', flight: '#777784', 'flight-bars': '#383844', head: '#485363', highlight: '#788998', contour: '#343e4e' };
const brown: Palette = { ...red, tail: '#665046', breast: '#ad9483', head: '#937966', wing: '#c7b59d', bars: '#705648', neck: '#89755b', iridescence: '#a58b80' };
interface Appearance { label: string; palette: Palette; pattern: WingPattern; breed: Breed }
const morph = (label: string, palette: Palette, pattern: WingPattern = 'bar', breed: Breed = 'rock'): Appearance => ({ label, palette, pattern, breed });
// Utah's pigeon genetics project distinguishes blue, brown, and ash-red base
// colors; spread and recessive red suppress the visible underlying wing pattern.
// We hide the bar/check layers for those uniform-color phenotypes, not simulate
// inheritance. Grizzle and pied are visual overlays, not extra pattern alleles.
// https://learn.genetics.utah.edu/content/pigeons/
// Bar, barless, check, and T-check are the four underlying wing patterns.
// T-check reuses check marks on a darker shield as an icon-scale approximation.
// https://learn.genetics.utah.edu/content/pigeons/pattern/
export const appearances = {
  city: morph('Blue bar rock pigeon', blue),
  red: morph('Ash-red bar', red),
  white: morph('Recessive white', white, 'plain'),
  dark: morph('Spread black', dark, 'plain'),
  checker: morph('Blue checker', blue, 'checker'),
  't-check': morph('Blue T-check', { ...dark, wing: '#858895' }, 'checker'),
  barless: morph('Blue barless', blue, 'plain'),
  brown: morph('Brown bar', brown),
  // The Fantail standard's color descriptions distinguish peppered grizzle from
  // splash's larger white areas; small flecks vs. solid patches suggest that here.
  // https://www.pigeoncote.com/standards/fantail/npafan.html
  grizzle: morph('Blue grizzle', { ...blue, head: '#b5bcc4', breast: '#c4c9cf' }, 'grizzle'),
  pied: morph('Blue pied', blue, 'pied'),
  'recessive-red': morph('Recessive red', { ...red, breast: '#ac6e4f', wing: '#b77a58', head: '#ae7353', neck: '#a3674e', tail: '#925c43' }, 'plain'),
  // White Fantails have dark eyes; Old German Owls also have dark bull eyes.
  // Shared white iris color suggests these, without claiming every white bird
  // has that eye color. The Jacobin's pale head is a breed marking; its hood
  // remains colored. Breed shapes are cues, not complete show-standard anatomy.
  // https://www.pigeoncote.com/standards/fantail/npafan.html
  // https://www.pigeoncote.com/hilight/oldgermanowl/oldger.html
  // https://pigeoncote.com/standards/jacobin/npajacob.html
  fantail: morph('White Fantail', white, 'plain', 'fantail'),
  jacobin: morph('Red Jacobin', { ...red, head: white.head, neck: '#8a584b', iridescence: '#9e7066', contour: '#795348' }, 'plain', 'jacobin'),
  owl: morph('Blue shield Old German Owl', { ...white, wing: blue.wing, bars: blue.bars, flight: blue.flight, 'flight-bars': blue['flight-bars'] }, 'bar', 'owl'),
} satisfies Record<string, Appearance>;
export type AppearanceName = keyof typeof appearances;
export const companionAppearances = Object.keys(appearances) as AppearanceName[];
export const commonAppearances = companionAppearances.filter(name => appearances[name].breed === 'rock');

export function applyAppearance(element: HTMLElement, name: AppearanceName) {
  const { palette, pattern, breed } = appearances[name];
  element.dataset.appearance = name;
  element.dataset.pattern = pattern;
  element.dataset.breed = breed;
  for (const [part, color] of Object.entries(palette)) element.style.setProperty(`--pigeon-${part}`, color);
}
