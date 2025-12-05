import { el } from './dom.js';
import { state } from './state.js';
import { changeChapter as changeChapterFromOverlays } from './overlays.js';

export function renderGallery(chapterOrder, chapters) {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  grid.innerHTML = '';

  const names = chapterOrder.length ? chapterOrder : Object.keys(chapters);

  names.forEach((name, index) => {
    const pages = chapters[name];
    if (!pages || pages.length === 0) return;

    const coverUrl = pages[0];

    const card = document.createElement('div');
    card.className = 'chapter-card';
    if (name === state.currentChapter) {
      card.classList.add('active');
    }

    card.style.animationDelay = `${index * 50}ms`;

    card.onclick = () => {
    if (el.chapter) el.chapter.value = name;
      changeChapterFromOverlays(name, chapters);
      toggleGallery();
    };

    const thumb = document.createElement('img');
    thumb.className = 'chapter-thumb';
    thumb.src = coverUrl;
    thumb.alt = name;
    thumb.loading = 'lazy';

    const info = document.createElement('div');
    info.className = 'chapter-info';

    const title = document.createElement('div');
    title.className = 'chapter-title';
    title.textContent = name;

    info.appendChild(title);
    card.appendChild(thumb);
    card.appendChild(info);
    grid.appendChild(card);
  });

  const closeBtn = document.getElementById('galleryClose');
  if (closeBtn) {
    closeBtn.onclick = toggleGallery;
  }
}

export function toggleGallery() {
  const overlay = document.getElementById('galleryOverlay');
  if (overlay) {
    overlay.classList.toggle('active');
  }
}

export function attachGalleryButton() {
  const galleryBtn = document.getElementById('galleryBtn');
  if (galleryBtn) galleryBtn.addEventListener('click', toggleGallery);
}

// changeChapter handled via imported alias; no local implementation
