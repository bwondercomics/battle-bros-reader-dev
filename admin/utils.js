// Shared utilities for the admin panel

export function escapeHtml(text = '') {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function parseTags(text = '') {
  return text
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);
}

export function sortPagesByFilename(pages = []) {
  return [...pages].sort((a, b) => {
    const nameA = a.split('/').pop() || a;
    const nameB = b.split('/').pop() || b;
    const numA = parseInt(nameA.match(/\d+/)?.[0] || '0', 10);
    const numB = parseInt(nameB.match(/\d+/)?.[0] || '0', 10);
    if (numA !== numB) return numA - numB;
    return nameA.localeCompare(nameB);
  });
}

export function sanitizeFolderFromName(name = '') {
  let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) slug = `chapter-${Date.now()}`;
  return `chapters/${slug}`;
}

export function inferFolderFromPages(name, chapters = {}, currentPages = []) {
  const pages = chapters[name] || currentPages || [];
  const counts = {};
  pages.forEach(p => {
    if (typeof p !== 'string') return;
    if (!p.startsWith('chapters/')) return;
    const dir = p.slice(0, p.lastIndexOf('/'));
    if (!dir) return;
    counts[dir] = (counts[dir] || 0) + 1;
  });
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : null;
}

export function ensureChapterFolder(name = '', chapterFolders = {}, chapters = {}, currentPages = []) {
  if (chapterFolders[name]) return chapterFolders[name];

  const inferred = inferFolderFromPages(name, chapters, currentPages);
  if (inferred) {
    chapterFolders[name] = inferred;
    return inferred;
  }

  const existing = new Set(Object.values(chapterFolders || {}));
  const legacyNumber = name.match(/\d+/)?.[0];
  let base = legacyNumber ? `chapters/${legacyNumber.padStart(2, '0')}` : sanitizeFolderFromName(name);
  let candidate = base;
  let counter = 1;
  while (existing.has(candidate)) {
    candidate = `${base}-${counter++}`;
  }
  chapterFolders[name] = candidate;
  return candidate;
}

export function getChapterFolder(chapterName = '', chapterFolders = {}, chapters = {}, currentPages = []) {
  if (chapterFolders[chapterName]) return chapterFolders[chapterName];
  return ensureChapterFolder(chapterName || 'Chapter', chapterFolders, chapters, currentPages);
}

export function normalizePages(pages = []) {
  return (Array.isArray(pages) ? pages : [])
    .filter(p => typeof p === 'string')
    .map(p => p.trim())
    .filter(Boolean);
}

export function pagesEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function generateMediaId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `media-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}
