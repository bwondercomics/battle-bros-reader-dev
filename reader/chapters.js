import { CHAPTER_NUMBER_PATTERN } from './config.js';

export function extractChapterNumber(name = '') {
  const match = name.match(CHAPTER_NUMBER_PATTERN);
  return match ? parseInt(match[1], 10) : null;
}

export function sortChapterNames(names = []) {
  return [...names].sort((a, b) => {
    const aNum = extractChapterNumber(a);
    const bNum = extractChapterNumber(b);
    if (aNum != null && bNum != null && aNum !== bNum) {
      return aNum - bNum;
    }
    if (aNum != null && bNum == null) return -1;
    if (aNum == null && bNum != null) return 1;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });
}

export function sanitizeChapters(rawChapters = {}) {
  const clean = {};
  const seen = new Set();

  Object.entries(rawChapters).forEach(([name, pages]) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      console.warn(`Duplicate chapter name ignored: ${trimmed}`);
      return;
    }

    const normalizedPages = Array.isArray(pages) ? pages.filter(Boolean) : [];
    clean[trimmed] = normalizedPages;
    seen.add(key);
  });

  return {
    chapters: clean,
    order: sortChapterNames(Object.keys(clean))
  };
}
