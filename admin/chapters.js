import {
  escapeHtml,
  sortPagesByFilename,
  inferFolderFromPages,
  ensureChapterFolder,
  getChapterFolder,
  normalizePages,
  pagesEqual
} from './utils.js';

/**
 * Chapter management logic extracted from app.js for reuse and readability.
 * All state is passed in by reference so the main app remains the source of truth.
 */
export function createChaptersApi({ state, el, saveToServer, showSuccess, showError, STORAGE_KEY }) {
  async function loadChapters() {
    try {
      const response = await fetch('data.json');
      if (response.ok) {
        const data = await response.json();
        if (data.chapters && typeof data.chapters === 'object') {
          state.chapters = data.chapters;
          state.chapterFolders = data.chapterFolders || {};
          state.statusMessage = data.statusMessage || '';
          Object.keys(state.chapters).forEach(name => {
            if (!state.chapterFolders[name]) {
              const inferred = inferFolderFromPages(name, state.chapters, state.currentPages);
              if (inferred) {
                state.chapterFolders[name] = inferred;
              }
            }
          });
          return;
        }
      }
    } catch (e) {
      console.warn('Could not load from data.json, trying localStorage:', e);
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.chapters) {
          state.chapters = parsed.chapters;
          state.chapterFolders = parsed.chapterFolders || {};
          state.statusMessage = parsed.statusMessage || '';
        } else {
          state.chapters = parsed || {};
          state.chapterFolders = {};
        }
        return;
      } catch (e) {
        console.error('Error loading saved data:', e);
      }
    }
    console.warn('No chapter data found, starting with empty chapters');
    state.chapters = {};
  }

  async function saveChapters(showMessage = false) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          chapters: state.chapters,
          chapterFolders: state.chapterFolders,
          statusMessage: state.statusMessage
        })
      );
    } catch (error) {
      console.warn('Unable to persist chapters to localStorage:', error);
    }

    const payload = {
      chapters: state.chapters,
      chapterFolders: state.chapterFolders,
      statusMessage: state.statusMessage,
      lastUpdated: new Date().toISOString(),
      publishedBy: 'Admin Panel'
    };

    try {
      await saveToServer('admin/data.json', payload);
      if (showMessage && showSuccess) {
        showSuccess('Chapters saved to disk.');
      }
    } catch (error) {
      console.error('Save chapters failed:', error);
      if (showError) {
        showError('Failed to save chapters to disk. A draft is stored in your browser.');
      }
    }
  }

  function renderStatusMessageInput() {
    if (el.statusMessageInput) {
      el.statusMessageInput.value = state.statusMessage || '';
    }
  }

  function setStatusMessageFeedback(message, isError = false) {
    if (!el.statusMessageStatus) return;
    el.statusMessageStatus.textContent = message;
    el.statusMessageStatus.style.display = 'block';
    el.statusMessageStatus.style.background = isError ? 'var(--danger)' : 'var(--success)';
    el.statusMessageStatus.style.color = isError ? 'var(--text)' : 'var(--bg-dark)';
    setTimeout(() => {
      el.statusMessageStatus.style.display = 'none';
    }, 2500);
  }

  async function saveStatusMessage() {
    state.statusMessage = (el.statusMessageInput?.value || '').trim();
    try {
      await saveChapters(false);
      setStatusMessageFeedback('Status updated.');
    } catch (error) {
      console.error('Save status failed:', error);
      setStatusMessageFeedback('Failed to save status.', true);
    }
  }

  function renderPageList(pages) {
    state.currentPages = [...pages];
    el.pageList.innerHTML = '';

    state.currentPages.forEach((path, index) => {
      const item = document.createElement('div');
      item.className = 'page-item';
      item.draggable = true;
      item.dataset.index = index;

      item.addEventListener('dragstart', e => {
        state.draggingIndex = index;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', item.innerHTML);
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        state.draggingIndex = null;
      });

      item.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        item.classList.add('drag-over');
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over');
      });

      item.addEventListener('drop', e => {
        e.preventDefault();
        item.classList.remove('drag-over');
        if (state.draggingIndex !== null && state.draggingIndex !== index) {
          const newPages = [...state.currentPages];
          const [moved] = newPages.splice(state.draggingIndex, 1);
          newPages.splice(index, 0, moved);
          renderPageList(newPages);
          markUnsaved();
        }
      });

      item.innerHTML = `
        <span class="page-number">#${index + 1}</span>
        <span class="page-path">${escapeHtml(path)}</span>
        <div class="page-actions">
          <button type="button" class="btn-move btn-move-up" data-index="${index}" title="Move up" ${index === 0 ? 'disabled' : ''}>UP</button>
          <button type="button" class="btn-move btn-move-down" data-index="${index}" title="Move down" ${index === state.currentPages.length - 1 ? 'disabled' : ''}>DOWN</button>
          <button type="button" class="btn-remove" data-index="${index}" data-path="${escapeHtml(path)}">Remove</button>
        </div>
      `;
      el.pageList.appendChild(item);
    });

    document.querySelectorAll('.btn-move-up').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        movePage(parseInt(btn.dataset.index, 10), -1);
      });
    });

    document.querySelectorAll('.btn-move-down').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        movePage(parseInt(btn.dataset.index, 10), 1);
      });
    });

    document.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        removePage(parseInt(btn.dataset.index, 10), btn.dataset.path);
      });
    });
  }

  function movePage(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= state.currentPages.length) return;
    const newPages = [...state.currentPages];
    const [item] = newPages.splice(index, 1);
    newPages.splice(newIndex, 0, item);
    renderPageList(newPages);
    markUnsaved();
  }

  function markUnsaved() {
    state.hasUnsavedChanges = true;
    if (el.unsavedIndicator) el.unsavedIndicator.style.display = 'block';
  }

  function clearUnsaved() {
    state.hasUnsavedChanges = false;
    if (el.unsavedIndicator) el.unsavedIndicator.style.display = 'none';
  }

  async function reconcileChapterPages(chapterName) {
    const stored = normalizePages(state.chapters[chapterName] || []);
    const diskPages = await fetchChapterImages(chapterName);
    const diskNormalized = normalizePages(diskPages || []);
    const preferred = diskNormalized.length ? diskNormalized : stored;
    const merged = sortPagesByFilename(Array.from(new Set(preferred)));
    if (!pagesEqual(merged, stored)) {
      state.chapters[chapterName] = merged;
      await saveChapters();
    }
    return merged;
  }

  async function editChapter(chapterName) {
    state.currentEditingChapter = chapterName;
    el.modalTitle.textContent = 'Edit Chapter';
    el.chapterName.value = chapterName;
    const combined = await reconcileChapterPages(chapterName);
    renderPageList(sortPagesByFilename(combined));
    showModal();
  }

  function addNewChapter() {
    state.currentEditingChapter = '';
    el.modalTitle.textContent = 'Add New Chapter';
    el.chapterName.value = '';
    renderPageList([]);
    showModal();
  }

  function deleteChapter(chapterName) {
    if (confirm(`Are you sure you want to delete "${chapterName}"?`)) {
      delete state.chapters[chapterName];
      saveChapters();
      renderChapterList();
    }
  }

  async function saveChapterEdit() {
    const newName = getActiveChapterName();
    if (!newName) {
      alert('Chapter name is required');
      return;
    }

    const pages = [...state.currentPages];
    const chapterFolder = ensureChapterFolder(newName, state.chapterFolders, state.chapters, state.currentPages);
    try {
      const resp = await fetch('/api/create-chapter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterFolder })
      });
      if (!resp.ok) {
        const result = await resp.json().catch(() => ({}));
        throw new Error(result.error || 'Unable to create chapter folder');
      }
    } catch (e) {
      console.warn('Create chapter folder failed:', e);
      if (showError) showError(`Could not create folder for ${newName}: ${e.message}`);
      return;
    }

    if (state.currentEditingChapter && state.currentEditingChapter !== newName) {
      delete state.chapters[state.currentEditingChapter];
      if (state.chapterFolders[state.currentEditingChapter]) {
        state.chapterFolders[newName] = state.chapterFolders[state.currentEditingChapter];
        delete state.chapterFolders[state.currentEditingChapter];
      }
    }

    state.chapters[newName] = pages;
    await saveChapters();
    renderChapterList();
    clearUnsaved();
    hideModal();
  }

  function addPage() {
    const path = prompt('Enter image path (e.g., chapters/01/01.png):');
    if (path) {
      state.currentPages.push(path.trim());
      state.currentPages = sortPagesByFilename(state.currentPages);
      renderPageList(state.currentPages);
      markUnsaved();
    }
  }

  async function removePage(index, imagePath) {
    const targetPath = imagePath || state.currentPages[index];
    if (targetPath && targetPath.startsWith('chapters/')) {
      try {
        const response = await fetch('/api/delete-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: targetPath })
        });
        if (!response.ok && response.status !== 404) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.error || 'Failed to delete file');
        }
      } catch (error) {
        console.error('Delete error:', error);
        if (showError) showError(`Delete failed: ${error.message}`);
        return;
      }
    }
    state.currentPages.splice(index, 1);
    renderPageList(state.currentPages);
    markUnsaved();
  }

  function renderChapterList() {
    el.chapterList.innerHTML = '';
    const chapterNames = Object.keys(state.chapters);
    chapterNames.forEach(name => {
      const pages = state.chapters[name];
      const item = document.createElement('div');
      item.className = 'chapter-item';
      item.innerHTML = `
        <div class="chapter-info">
          <div class="chapter-name">${escapeHtml(name)}</div>
          <div class="chapter-meta">${pages.length} pages</div>
        </div>
        <div class="chapter-actions">
          <button class="btn-small btn-edit" data-chapter="${escapeHtml(name)}">Edit</button>
          <button class="btn-small btn-delete" data-chapter="${escapeHtml(name)}">Delete</button>
        </div>
      `;
      el.chapterList.appendChild(item);
    });
    el.chapterList.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => editChapter(btn.dataset.chapter));
    });
    el.chapterList.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteChapter(btn.dataset.chapter));
    });
  }

  function getActiveChapterName() {
    const fromInput = el.chapterName?.value?.trim();
    return fromInput || state.currentEditingChapter || '';
  }

  async function fetchChapterImages(chapterName) {
    const chapterFolder = getChapterFolder(chapterName, state.chapterFolders, state.chapters, state.currentPages);
    try {
      const response = await fetch('/api/list-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterFolder })
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to load chapter files');
      }
      const data = await response.json();
      return sortPagesByFilename(data.paths || []);
    } catch (error) {
      console.warn('Unable to load files from disk for', chapterName, error);
      return null;
    }
  }

  function showModal() {
    if (el.editModal) el.editModal.style.display = 'flex';
  }

  function hideModal() {
    if (el.editModal) el.editModal.style.display = 'none';
  }

  return {
    loadChapters,
    saveChapters,
    renderStatusMessageInput,
    setStatusMessageFeedback,
    saveStatusMessage,
    renderPageList,
    movePage,
    markUnsaved,
    clearUnsaved,
    reconcileChapterPages,
    editChapter,
    addNewChapter,
    deleteChapter,
    saveChapterEdit,
    addPage,
    removePage,
    renderChapterList,
    getActiveChapterName,
    fetchChapterImages,
    showModal,
    hideModal
  };
}
