import { CONFIG } from './config.js';
import { state } from './state.js';
import { el } from './dom.js';

export function applyTransform() {
  if (state.rafId) cancelAnimationFrame(state.rafId);

  state.rafId = requestAnimationFrame(() => {
    if (el.stage) {
      el.stage.style.transform = `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.scale})`;
    }
    state.rafId = null;
  });
}

export function resetView() {
  state.scale = 1;
  state.pan = { x: 0, y: 0 };
  applyTransform();
}

export function zoomIn() {
  state.scale = Math.min(CONFIG.ZOOM_MAX, state.scale * CONFIG.ZOOM_STEP);
  applyTransform();
}

export function zoomOut() {
  state.scale = Math.max(CONFIG.ZOOM_MIN, state.scale / CONFIG.ZOOM_STEP);
  applyTransform();
}

export function fitToScreen() {
  if (document.fullscreenElement) {
    fitHeightFullscreen();
  } else {
    resetView();
  }
}

export function fitHeightFullscreen() {
  const img = el.leftImg;
  const stage = el.stage;
  if (!img || !img.complete || !img.naturalHeight || !stage) {
    state.scale = 1;
    state.pan = { x: 0, y: 0 };
    applyTransform();
    return;
  }

  if (el.stage) {
    if (state.prevTransformOrigin === null) {
      state.prevTransformOrigin = window.getComputedStyle(el.stage).transformOrigin || '50% 50%';
    }
    el.stage.style.transformOrigin = 'center center';
  }

  const vpWidth = el.viewport.clientWidth;
  const vpHeight = el.viewport.clientHeight;

  state.scale = 1;
  state.pan = { x: 0, y: 0 };

  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
  stage.style.transform = `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.scale})`;

  void stage.offsetHeight;

  const stageBounds = stage.getBoundingClientRect();
  const stageWidth = stageBounds.width;
  const stageHeight = stageBounds.height;

  let targetScale = Math.min(vpWidth / stageWidth, vpHeight / stageHeight);
  targetScale = Math.max(CONFIG.ZOOM_MIN, Math.min(CONFIG.ZOOM_MAX, targetScale));

  state.scale = targetScale;
  state.pan = { x: 0, y: 0 };
  applyTransform();
}
