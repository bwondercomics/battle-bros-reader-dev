const PATREON_LINK = 'https://patreon.com/doylemelville2';

const RAW_COVERS = [
  'chapters/patreonCh/8cover.png',
  'chapters/patreonCh/9cover.png',
  'chapters/patreonCh/10p1cover.png',
];

function titleFromPath(path = '') {
  const file = path.split('/').pop() || '';
  const match = file.match(/(\d+)/);
  if (match) return `Patreon #${match[1]}`;
  return 'Patreon Exclusive';
}

export const PATREON_COVERS = RAW_COVERS.map((image) => ({
  image,
  title: titleFromPath(image),
  href: PATREON_LINK,
}));

const VOLUME_LINK = 'https://bwondercomics.bigcartel.com/product/battle-bros-volume-1';
const VOLUME_COVERS = ['chapters/volumes/frontBBCOVER.png'];

export const VOLUME_EXCLUSIVES = VOLUME_COVERS.map((image) => ({
  image,
  title: 'Physical Volume',
  href: VOLUME_LINK,
}));
