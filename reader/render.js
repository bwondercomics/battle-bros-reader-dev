import { CONFIG } from './config.js';
import { state } from './state.js';
import { el } from './dom.js';

export function renderStatusPanel(message, statusTimerRef) {
  const statusMessage = message || '';
  if (!el.statusText) return;
  el.statusText.textContent = '';
  if (statusTimerRef.current) {
    clearTimeout(statusTimerRef.current);
    statusTimerRef.current = null;
  }

  const text = statusMessage || 'ready';
  let i = 0;
  const step = () => {
    if (i < text.length) {
      el.statusText.textContent += text[i++];
      statusTimerRef.current = setTimeout(step, 35);
    }
  };
  step();
}

export function preloadImage(url) {
  if (!url) return Promise.reject('no-url');
  if (state.imageCache.has(url)) return state.imageCache.get(url);

  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      state.imageCache.delete(url);
      reject(new Error('Image load failed: ' + url));
    };
    img.src = url;
  });

  state.imageCache.set(url, promise);

  if (state.imageCache.size > CONFIG.IMAGE_CACHE_SIZE) {
    const firstKey = state.imageCache.keys().next().value;
    state.imageCache.delete(firstKey);
  }

  return promise;
}

export function loadImage(imgEl, spinnerEl, url) {
  if (!imgEl) return;

  if (!url) {
    imgEl.removeAttribute('src');
    imgEl.alt = '';
    if (spinnerEl) spinnerEl.style.display = 'none';
    return;
  }

  if (spinnerEl) spinnerEl.style.display = '';

  const hideSpinner = () => {
    if (spinnerEl) spinnerEl.style.display = 'none';
    imgEl.removeEventListener('load', hideSpinner);
    imgEl.removeEventListener('error', hideSpinner);
  };

  imgEl.addEventListener('load', hideSpinner);
  imgEl.addEventListener('error', hideSpinner);

  const pageNum = state.pages.indexOf(url) + 1;
  imgEl.alt = `${state.currentChapter} - page ${pageNum}`;

  imgEl.src = url;

  preloadImage(url).catch(() => {});
}

export function preloadUpcoming() {
  const startIdx = state.pageIndex + 2;
  const endIdx = Math.min(state.pages.length, startIdx + CONFIG.PRELOAD_AHEAD);

  for (let i = startIdx; i < endIdx; i++) {
    preloadImage(state.pages[i]).catch(() => {});
  }
}

export function isTwoPageMode() {
  const aspectRatio = window.innerWidth / window.innerHeight;
  const hasMinWidth = window.innerWidth >= CONFIG.TWO_PAGE_BREAKPOINT;
  const isWideEnough = aspectRatio > 0.714;
  return hasMinWidth && isWideEnough;
}

export function canShowTwoPages() {
  return isTwoPageMode() && state.pageIndex + 1 < state.pages.length;
}

export function render() {
  state.isTransitioning = true;
  if (el.stage) el.stage.classList.add('transitioning');
  setTimeout(() => {
    if (el.stage) el.stage.classList.remove('transitioning');
    state.isTransitioning = false;
  }, CONFIG.ANIMATION_DURATION);

  const twoPageMode = canShowTwoPages();
  const leftUrl = state.pages[state.pageIndex] || '';
  const rightUrl = state.pages[state.pageIndex + 1] || '';

  if (!twoPageMode) {
    if (el.rightPage) el.rightPage.style.display = 'none';
    loadImage(el.leftImg, el.leftSpinner, leftUrl);
  } else {
    if (el.rightPage) el.rightPage.style.display = '';
    loadImage(el.leftImg, el.leftSpinner, leftUrl);
    loadImage(el.rightImg, el.rightSpinner, rightUrl);
  }

  updateUI();
  preloadUpcoming();
}

export function updateUI() {
  const total = state.pages.length || 1;
  const current = state.pageIndex + 1;
  const twoPageMode = canShowTwoPages();

  if (el.indicator) {
    el.indicator.textContent = twoPageMode
      ? `PAGE ${current}-${Math.min(current + 1, total)} / ${total}`
      : `PAGE ${current} / ${total}`;
  }

  if (el.progressFill) {
    const displayed = Math.min(total, state.pageIndex + (twoPageMode ? 2 : 1));
    el.progressFill.style.width = ((displayed / total) * 100) + '%';
  }

  if (el.prevBtn) {
    el.prevBtn.disabled = state.pageIndex === 0;
  }

  if (el.nextBtn) {
    const isAtEnd = state.pageIndex >= total - 1;
    const rightIsLast = twoPageMode && state.pageIndex + 1 === total - 1;
    el.nextBtn.disabled = isAtEnd || rightIsLast;
  }
}
