import { CONFIG } from './config.js';

export const state = {
  currentChapter: '',
  pages: [],
  pageIndex: 0,
  scale: 1,
  pan: { x: 0, y: 0 },
  pointers: new Map(),
  isDragging: false,
  dragStart: null,
  panStart: null,
  touchStart: null,
  pinchDistance: null,
  pinchCenter: null,
  pinchScale: 1,
  imageCache: new Map(),
  lastTap: 0,
  isTransitioning: false,
  rafId: null,
  prevTransformOrigin: null
};

export function saveProgress(stateObj = state) {
  try {
    const data = {
      chapter: stateObj.currentChapter,
      page: stateObj.pageIndex,
      timestamp: Date.now()
    };
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save progress:', e);
  }
}

export function loadProgress() {
  try {
    const json = localStorage.getItem(CONFIG.STORAGE_KEY);
    return json ? JSON.parse(json) : null;
  } catch (e) {
    return null;
  }
}
