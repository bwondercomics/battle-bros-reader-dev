import { el } from "./dom.js";
import { state } from "./state.js";
import { changeChapter as changeChapterFromOverlays } from "./overlays.js";
import { PATREON_COVERS, VOLUME_EXCLUSIVES } from "./patreon.js";

export function renderGallery(chapterOrder, chapters) {
  const grid = document.getElementById("galleryGrid");
  if (!grid) return;

  grid.innerHTML = "";

  const names = chapterOrder.length ? chapterOrder : Object.keys(chapters);
  let cardIndex = 0;

  names.forEach((name) => {
    const pages = chapters[name];
    if (!pages || pages.length === 0) return;

    const coverUrl = pages[0];

    const card = document.createElement("div");
    card.className = "chapter-card";
    card.style.setProperty("--card-index", cardIndex++);
    if (name === state.currentChapter) {
      card.classList.add("active");
    }

    card.onclick = () => {
      if (el.chapter) el.chapter.value = name;
      changeChapterFromOverlays(name, chapters);
      toggleGallery();
    };

    const thumb = document.createElement("img");
    thumb.className = "chapter-thumb";
    thumb.src = coverUrl;
    thumb.alt = name;
    thumb.loading = "lazy";

    const info = document.createElement("div");
    info.className = "chapter-info";

    const title = document.createElement("div");
    title.className = "chapter-title";
    title.textContent = name;

    info.appendChild(title);
    card.appendChild(thumb);
    card.appendChild(info);
    grid.appendChild(card);
  });

  const addPromoCard = (cover, variantClass, badgeText) => {
    const card = document.createElement("div");
    card.className = `chapter-card ${variantClass}`;
    card.style.setProperty("--card-index", cardIndex++);

    card.onclick = () => {
      window.open(cover.href, "_blank", "noopener,noreferrer");
    };

    const thumb = document.createElement("img");
    thumb.className = "chapter-thumb";
    thumb.src = cover.image;
    thumb.alt = cover.title;
    thumb.loading = "lazy";

    const info = document.createElement("div");
    info.className = "chapter-info";

    const title = document.createElement("div");
    title.className = "chapter-title";
    title.textContent = cover.title;

    const badge = document.createElement("div");
    badge.className = `${variantClass}-badge`;
    badge.textContent = badgeText;

    info.appendChild(title);
    info.appendChild(badge);
    card.appendChild(thumb);
    card.appendChild(info);
    grid.appendChild(card);
  };

  PATREON_COVERS.forEach((cover) => addPromoCard(cover, "patreon-card", "Patreon Exclusive"));
  VOLUME_EXCLUSIVES.forEach((cover) => addPromoCard(cover, "volume-card", "Physical Volume"));

  const closeBtn = document.getElementById("galleryClose");
  if (closeBtn) {
    closeBtn.onclick = toggleGallery;
  }
}

export function toggleGallery() {
  const overlay = document.getElementById("galleryOverlay");
  if (overlay) {
    overlay.classList.toggle("active");
  }
}

export function attachGalleryButton() {
  const galleryBtn = document.getElementById("galleryBtn");
  if (galleryBtn) galleryBtn.addEventListener("click", toggleGallery);
}

// changeChapter handled via imported alias; no local implementation
