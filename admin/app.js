import {
  ADMIN_PASSWORD,
  STORAGE_KEY,
  SESSION_KEY,
  GITHUB_TOKEN_KEY,
  GITHUB_CONFIG,
  API_ENDPOINT,
  POSTS_FILE,
  MEDIA_FILE,
} from "./config.js";
import { el } from "./dom.js";
import { checkSession, login, logout } from "./auth.js";
import { createChaptersApi } from "./chapters.js";
import {
  escapeHtml,
  parseTags,
  sortPagesByFilename,
  generateMediaId,
  inferFolderFromPages,
  ensureChapterFolder,
  getChapterFolder,
} from "./utils.js";

const state = {
  chapters: {},
  chapterFolders: {},
  statusMessage: "",
  currentEditingChapter: null,
  posts: [],
  mediaItems: [],
  editingPostId: null,
  previewState: { chapter: "", pages: [], index: 0 },
  pendingMediaSelection: null,
  selectedFiles: [],
  uploadQueue: [],
  currentPages: [],
  hasUnsavedChanges: false,
  draggingIndex: null,
  isUploading: false,
  isDeletingPost: false,
};

function showError(message) {
  // Fallback to alert to keep UX functional even if a banner is missing
  alert(`ERROR: ${message}`);
}

function showSuccess(message) {
  alert(`SUCCESS: ${message}`);
}

async function saveToServer(filename, content) {
  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, content }),
  });

  if (!response.ok) {
    let message = `Failed to save ${filename}`;
    try {
      const errorText = await response.text();
      if (errorText) message += `: ${errorText}`;
    } catch (err) {
      console.error("Error reading save response", err);
    }
    throw new Error(message);
  }

  return true;
}

const chaptersApi = createChaptersApi({
  state,
  el,
  saveToServer,
  showSuccess,
  showError,
  STORAGE_KEY,
});

// ---------------- BLOG / POSTS ----------------
function getPostsUrl() {
  return POSTS_FILE.startsWith("/") ? POSTS_FILE : `/${POSTS_FILE}`;
}

async function persistPosts() {
  state.posts = [...state.posts].sort(
    (a, b) => new Date(b.date || 0) - new Date(a.date || 0),
  );
  try {
    await saveToServer(POSTS_FILE, state.posts);
    setPostStatus("Post saved and feed updated.");
  } catch (error) {
    console.error("Failed to save posts:", error);
    setPostStatus(
      "Failed to save posts to disk. Copy your text before refreshing.",
      true,
    );
    throw error;
  }
}

function setPostStatus(message, isError = false) {
  if (!el.postStatus) return;
  el.postStatus.textContent = message;
  el.postStatus.style.display = "block";
  el.postStatus.style.background = isError ? "var(--danger)" : "var(--success)";
  el.postStatus.style.color = isError ? "var(--text)" : "var(--bg-dark)";
  setTimeout(() => {
    el.postStatus.style.display = "none";
  }, 3000);
}

function resetPostForm() {
  state.editingPostId = null;
  el.postTitle.value = "";
  el.postImage.value = "";
  if (el.postImageFile) el.postImageFile.value = "";
  if (el.postImageTags) el.postImageTags.value = "";
  el.postContent.value = "";
  el.postShare.checked = true;
  el.btnSavePost.textContent = "Publish Post";
}

function getPostPreview(content = "") {
  const trimmed = content.trim();
  if (trimmed.length <= 140) return trimmed || "No preview text";
  return `${trimmed.slice(0, 140)}...`;
}

function formatPostDate(dateStr) {
  if (!dateStr) return "Date not set";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "Date not set";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function renderPosts() {
  el.postList.innerHTML = "";

  if (!state.posts.length) {
    const empty = document.createElement("div");
    empty.className = "chapter-item";
    empty.textContent = "No posts yet. Create the first update!";
    el.postList.appendChild(empty);
    return;
  }

  const sorted = [...state.posts].sort(
    (a, b) => new Date(b.date || 0) - new Date(a.date || 0),
  );

  sorted.forEach((post) => {
    const item = document.createElement("div");
    item.className = "chapter-item";
    const dateLabel = formatPostDate(post.date);
    const preview = getPostPreview(post.content);
    const shareLabel =
      post.share === false
        ? '<span style="color: var(--danger); font-size: 0.85rem;">Not broadcasting</span>'
        : '<span style="color: var(--success); font-size: 0.85rem;">Broadcasting</span>';
    const tagText =
      post.imageTags && post.imageTags.length
        ? `Tags: ${post.imageTags.join(", ")}`
        : "";

    item.innerHTML = `
      <div class="chapter-info">
        <div class="chapter-name">${escapeHtml(post.title || "Untitled")}</div>
        <div class="chapter-meta">${dateLabel} - ${shareLabel}</div>
        ${tagText ? `<div class="chapter-meta" style="opacity:0.8;">${escapeHtml(tagText)}</div>` : ""}
        <div class="chapter-meta" style="opacity:0.8;">${escapeHtml(preview)}</div>
      </div>
      <div class="chapter-actions">
        <button type="button" class="btn-small btn-edit" data-post="${post.id}">Edit</button>
        <button type="button" class="btn-small btn-delete" data-post="${post.id}">Delete</button>
      </div>
    `;
    el.postList.appendChild(item);
  });

  el.postList.querySelectorAll("[data-post]").forEach((btn) => {
    const id = btn.getAttribute("data-post");
    if (btn.classList.contains("btn-edit")) {
      btn.addEventListener("click", () => populatePostForm(id));
    } else if (btn.classList.contains("btn-delete")) {
      btn.addEventListener("click", () => deletePost(id));
    }
  });
}

async function loadPosts() {
  try {
    const response = await fetch(getPostsUrl(), { cache: "no-cache" });
    if (!response.ok) throw new Error("Failed to load posts.json");
    const data = await response.json();
    state.posts = Array.isArray(data)
      ? data.map((p) => ({
          ...p,
          share: p.share !== false,
          imageTags: Array.isArray(p.imageTags)
            ? p.imageTags
            : parseTags(p.imageTags || ""),
        }))
      : [];
    renderPosts();
  } catch (error) {
    console.error("Error loading posts:", error);
    state.posts = [];
    renderPosts();
    setPostStatus(
      "Could not load existing posts. Create a new one to get started.",
      true,
    );
  }
}

function populatePostForm(postId) {
  const post = state.posts.find((p) => p.id === postId);
  if (!post) return;
  state.editingPostId = post.id;
  el.postTitle.value = post.title || "";
  el.postImage.value = post.image || "";
  if (el.postImageTags)
    el.postImageTags.value = (post.imageTags || []).join(", ");
  el.postContent.value = post.content || "";
  el.postShare.checked = post.share !== false;
  el.btnSavePost.textContent = "Update Post";
  if (el.blogSection) {
    el.blogSection.style.display = "block";
    el.blogSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function deletePost(postId) {
  if (state.isDeletingPost) return;
  state.isDeletingPost = true;

  const post = state.posts.find((p) => p.id === postId);
  if (!post) {
    state.isDeletingPost = false;
    return;
  }

  const confirmed = window.confirm(
    `Delete the post "${post.title}"? This cannot be undone.`,
  );
  if (!confirmed) {
    state.isDeletingPost = false;
    return;
  }

  // Prevent double clicks while saving
  el.postList.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.disabled = true;
  });

  try {
    state.posts = state.posts.filter((p) => p.id !== postId);
    await persistPosts();
    renderPosts();
  } finally {
    state.isDeletingPost = false;
    el.postList.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.disabled = false;
    });
  }
}

function generatePostId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `post-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

async function savePost() {
  const title = el.postTitle.value.trim();
  const imageTags = parseTags(el.postImageTags?.value || "");
  const content = el.postContent.value.trim();
  const share = el.postShare.checked;
  let image = el.postImage.value.trim();
  const uploadFile = el.postImageFile?.files?.[0];

  if (!title || !content) {
    setPostStatus("Title and content are required.", true);
    return;
  }

  if (uploadFile) {
    try {
      setPostStatus("Uploading image...");
      const payload = {
        name: uploadFile.name,
        data: await readFileAsBase64(uploadFile),
      };
      const response = await fetch("/api/upload-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: payload }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed");
      image = result.path || image;
      el.postImage.value = image;
      if (el.postImageFile) el.postImageFile.value = "";
      await upsertMediaEntry(image, imageTags);
      setPostStatus("Image uploaded and added to media library.");
    } catch (error) {
      console.error("Post image upload failed:", error);
      setPostStatus(`Image upload failed: ${error.message}`, true);
      return;
    }
  } else if (image) {
    await upsertMediaEntry(image, imageTags);
  }

  const now = new Date().toISOString();

  if (state.editingPostId) {
    const idx = state.posts.findIndex((p) => p.id === state.editingPostId);
    if (idx !== -1) {
      state.posts[idx] = {
        ...state.posts[idx],
        title,
        image,
        imageTags,
        content,
        date: now,
        share,
      };
    }
  } else {
    state.posts.unshift({
      id: generatePostId(),
      title,
      image,
      imageTags,
      content,
      date: now,
      share,
    });
  }

  await persistPosts();
  renderPosts();
  resetPostForm();
  setPostStatus("Post saved.");
}

// ---------------- MEDIA ----------------
async function loadMedia() {
  try {
    const response = await fetch(MEDIA_FILE, { cache: "no-cache" });
    if (!response.ok) throw new Error("Failed to load media.json");
    const data = await response.json();
    state.mediaItems = Array.isArray(data)
      ? data.map((m) => ({
          id: m.id || generateMediaId(),
          path: m.path || "",
          tags: Array.isArray(m.tags) ? m.tags : parseTags(m.tags || ""),
        }))
      : [];
  } catch (error) {
    console.warn("Error loading media.json, starting empty:", error);
    state.mediaItems = [];
  }
  await syncMediaFromDisk(false);
  renderMedia();
}

async function saveMedia(showMessage = false) {
  try {
    await saveToServer(MEDIA_FILE, state.mediaItems);
    if (showMessage) setMediaStatus("Media library saved.");
  } catch (error) {
    console.error("Failed to save media:", error);
    setMediaStatus("Failed to save media.json", true);
  }
}

function setMediaStatus(message, isError = false) {
  if (!el.mediaStatus) return;
  el.mediaStatus.textContent = message;
  el.mediaStatus.style.display = "block";
  el.mediaStatus.style.background = isError
    ? "var(--danger)"
    : "var(--success)";
  el.mediaStatus.style.color = isError ? "var(--text)" : "var(--bg-dark)";
  setTimeout(() => {
    el.mediaStatus.style.display = "none";
  }, 2500);
}

function showMediaSection() {
  if (el.blogSection) el.blogSection.style.display = "none";
  if (el.previewSection) el.previewSection.style.display = "none";
  if (el.mediaSection) {
    el.mediaSection.style.display = "block";
    el.mediaSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  renderMedia();
}

function renderMedia() {
  if (!el.mediaList) return;
  const term = (el.mediaSearch?.value || "").trim().toLowerCase();
  el.mediaList.innerHTML = "";

  const filtered = state.mediaItems.filter((item) => {
    if (!term) return true;
    return (
      item.path.toLowerCase().includes(term) ||
      (item.tags || []).some((t) => t.toLowerCase().includes(term))
    );
  });

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "chapter-item";
    empty.textContent = "No media found. Add an item above.";
    el.mediaList.appendChild(empty);
    return;
  }

  filtered.forEach((item) => {
    const tagsText = (item.tags || []).join(", ");
    const div = document.createElement("div");
    div.className = "chapter-item";
    div.innerHTML = `
      <div class="chapter-info">
        <div class="chapter-name">${escapeHtml(item.path)}</div>
        <div class="chapter-meta" style="opacity:0.8;">${escapeHtml(tagsText || "No tags")}</div>
      </div>
      <div class="chapter-actions">
        <button class="btn-small btn-edit" data-use="${escapeHtml(item.id)}">Use</button>
      </div>
    `;
    el.mediaList.appendChild(div);
  });

  el.mediaList.querySelectorAll("[data-use]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-use");
      const item = state.mediaItems.find((m) => m.id === id);
      if (item) applyMediaToPost(item);
    });
  });
}

async function syncMediaFromDisk(showMessage = true) {
  try {
    const response = await fetch("/api/list-media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Failed to list media folder");

    const diskPaths = result.paths || [];
    const existingMap = new Map(state.mediaItems.map((m) => [m.path, m]));
    let added = 0;
    let updated = 0;

    // Map image paths to tags from posts (if any)
    const postTagMap = new Map(
      (state.posts || [])
        .filter((p) => p.image)
        .map((p) => [
          p.image,
          Array.isArray(p.imageTags) ? p.imageTags : parseTags(p.imageTags || ""),
        ]),
    );

    diskPaths.forEach((p) => {
      const inferredTags = inferTagsForPath(p);
      const postTags = normalizeTags(postTagMap.get(p));
      const existing = existingMap.get(p);
      if (existing) {
        const currentTags = normalizeTags(existing.tags);
        const merged = mergeTags(currentTags, inferredTags, postTags);
        if (!tagsEqual(currentTags, merged)) {
          existing.tags = merged;
          updated += 1;
        }
      } else {
        state.mediaItems.push({
          id: generateMediaId(),
          path: p,
          tags: mergeTags([], inferredTags, postTags),
        });
        added += 1;
      }
    });

    if (added > 0 || updated > 0) {
      await saveMedia();
      renderMedia();
    }

    if (showMessage) {
      setMediaStatus(
        added || updated
          ? `Synced ${added} new item(s)${updated ? `, updated ${updated} tag set(s)` : ""}.`
          : "Media folder is already synced.",
      );
    }
  } catch (error) {
    console.error("Media sync failed:", error);
    if (showMessage) setMediaStatus("Failed to sync media folder.", true);
  }
}

async function upsertMediaEntry(path, tags = []) {
  if (!path) return;
  const normalizedTags = normalizeTags(tags);
  const existing = state.mediaItems.find((m) => m.path === path);
  if (existing) {
    const merged = mergeTags(normalizeTags(existing.tags), normalizedTags);
    existing.tags = merged;
  } else {
    state.mediaItems.push({
      id: generateMediaId(),
      path,
      tags: normalizedTags,
    });
  }
  renderMedia();
  await saveMedia();
}

async function addMediaItem() {
  const path = (el.mediaPath?.value || "").trim();
  const tags = parseTags(el.mediaTags?.value || "");
  if (!path) {
    setMediaStatus("Path is required.", true);
    return;
  }

  const existing = state.mediaItems.find((m) => m.path === path);
  if (existing) {
    existing.tags = tags;
    setMediaStatus("Updated existing media tags.");
  } else {
    state.mediaItems.push({ id: generateMediaId(), path, tags });
    setMediaStatus("Added media item.");
  }

  el.mediaPath.value = "";
  if (el.mediaTags) el.mediaTags.value = "";
  renderMedia();
  await saveMedia();
}

function inferTagsForPath(path = "") {
  const lower = path.toLowerCase();
  const tags = [];
  if (lower.includes("patreon")) tags.push("patreon");
  if (lower.includes("volume")) tags.push("volume", "store");
  if (lower.includes("cover")) tags.push("cover");
  return tags;
}

function normalizeTags(tags) {
  if (!tags) return [];
  if (!Array.isArray(tags)) return parseTags(tags || "");
  return tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
}

function mergeTags(...tagGroups) {
  const out = [];
  tagGroups.flat().forEach((tag) => {
    const t = String(tag).trim().toLowerCase();
    if (t && !out.includes(t)) out.push(t);
  });
  return out;
}

function tagsEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function applyMediaToPost(item) {
  if (el.postImage) el.postImage.value = item.path || "";
  if (el.postImageTags) el.postImageTags.value = (item.tags || []).join(", ");
  state.pendingMediaSelection = null;
  if (el.blogSection) {
    el.blogSection.style.display = "block";
    el.blogSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  setPostStatus("Image selected from media.");
}

// ---------------- PREVIEW ----------------
function updatePreviewChapters(selectedName = "") {
  if (!el.previewChapterSelect) return;
  const names = Object.keys(state.chapters).filter(
    (name) => name && name !== "undefined",
  );
  if (
    state.currentEditingChapter &&
    state.currentEditingChapter !== "undefined" &&
    !names.includes(state.currentEditingChapter)
  ) {
    names.push(state.currentEditingChapter);
  }
  el.previewChapterSelect.innerHTML = "";
  names.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    el.previewChapterSelect.appendChild(opt);
  });
  const target = names.includes(selectedName) ? selectedName : names[0] || "";
  if (target) {
    el.previewChapterSelect.value = target;
    setPreviewChapter(target);
  } else {
    state.previewState = { chapter: "", pages: [], index: 0 };
    renderPreviewImage();
  }
}

function setPreviewChapter(name) {
  state.previewState.chapter = name;
  state.previewState.pages = sortPagesByFilename(getPreviewPages(name));
  state.previewState.index = 0;
  renderPreviewImage();
}

function getPreviewPages(name) {
  return sortPagesByFilename(state.chapters[name] || state.currentPages || []);
}

function renderPreviewImage() {
  if (!el.previewFrame || !el.previewEmpty) return;
  const { pages } = state.previewState;
  if (!pages.length) {
    el.previewFrame.style.display = "none";
    el.previewEmpty.style.display = "block";
    if (el.previewPageLabel) el.previewPageLabel.textContent = "";
    return;
  }

  if (state.previewState.index >= pages.length) {
    state.previewState.index = pages.length - 1;
  }

  const src = pages[state.previewState.index];
  const resolvedSrc = src.startsWith("http")
    ? src
    : src.startsWith("/")
      ? src
      : `../${src}`;
  if (el.previewImg) el.previewImg.src = resolvedSrc;
  if (el.previewPageLabel) {
    el.previewPageLabel.textContent = `Page ${state.previewState.index + 1} / ${pages.length}`;
  }

  el.previewFrame.style.display = "block";
  el.previewEmpty.style.display = "none";
  if (el.previewPrev) el.previewPrev.disabled = state.previewState.index <= 0;
  if (el.previewNext)
    el.previewNext.disabled = state.previewState.index >= pages.length - 1;
}

function copyToClipboard() {
  const jsonData = JSON.stringify(state.chapters, null, 2);
  navigator.clipboard
    .writeText(jsonData)
    .then(() => {
      el.copySuccess.textContent = "Copied to clipboard!";
      el.copySuccess.className = "success-message";
      el.copySuccess.style.display = "block";
      setTimeout(() => {
        el.copySuccess.style.display = "none";
      }, 3000);
    })
    .catch((err) => {
      alert("Failed to copy: " + err);
    });
}

function downloadJSON() {
  const jsonData = JSON.stringify(state.chapters, null, 2);
  const blob = new Blob([jsonData], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "battle-bros-chapters.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------- GITHUB ----------------
function showSettingsModal() {
  el.settingsModal.classList.add("active");
  const token = localStorage.getItem(GITHUB_TOKEN_KEY);
  if (token) el.githubToken.value = token;
}

function hideSettingsModal() {
  el.settingsModal.classList.remove("active");
}

function saveGitHubToken() {
  const token = el.githubToken.value.trim();
  if (!token) {
    alert("Please enter a valid GitHub token");
    return;
  }
  localStorage.setItem(GITHUB_TOKEN_KEY, token);
  el.tokenSaveSuccess.textContent = "Token saved successfully!";
  el.tokenSaveSuccess.className = "success-message";
  el.tokenSaveSuccess.style.display = "block";
  setTimeout(() => {
    el.tokenSaveSuccess.style.display = "none";
    hideSettingsModal();
  }, 2000);
}

async function publishToGitHub() {
  const token = localStorage.getItem(GITHUB_TOKEN_KEY);
  if (!token) {
    if (
      confirm("GitHub token not found. Would you like to configure it now?")
    ) {
      showSettingsModal();
    }
    return;
  }

  if (!confirm("Publish changes to GitHub? This updates the live website."))
    return;

  const publishBtn = el.btnPublish;
  const originalText = publishBtn.textContent;

  try {
    publishBtn.disabled = true;
    publishBtn.textContent = "Publishing...";

    const dataToCommit = {
      chapters: state.chapters,
      chapterFolders: state.chapterFolders,
      statusMessage: state.statusMessage,
      lastUpdated: new Date().toISOString(),
      publishedBy: "Admin Panel",
    };

    let sha = null;
    try {
      const currentFile = await fetch(
        `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.dataFile}?ref=${GITHUB_CONFIG.branch}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        },
      );
      if (currentFile.ok) {
        const fileData = await currentFile.json();
        sha = fileData.sha;
      }
    } catch (e) {
      console.log("File may not exist yet, creating new file");
    }

    const content = btoa(
      unescape(encodeURIComponent(JSON.stringify(dataToCommit, null, 2))),
    );

    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.dataFile}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Update chapters via Admin Panel - ${new Date().toISOString()}`,
          content,
          branch: GITHUB_CONFIG.branch,
          ...(sha && { sha }),
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `GitHub API error: ${response.status} - ${errorData.message || "Unknown error"}`,
      );
    }

    publishBtn.textContent = "Published!";
    alert("Published successfully! GitHub Action will deploy shortly.");
  } catch (error) {
    console.error("Publish error:", error);
    alert("Publish failed. Please ensure your token has repo permissions.");
  } finally {
    publishBtn.textContent = originalText;
    publishBtn.disabled = false;
  }
}

// ---------------- UPLOAD ----------------
function initUploadHandlers() {
  const uploadArea = document.getElementById("uploadArea");
  const fileInput = document.getElementById("imageUpload");
  const uploadPrompt = document.getElementById("uploadPrompt");
  const uploadPreview = document.getElementById("uploadPreview");
  const btnUploadImages = document.getElementById("btnUploadImages");
  const uploadProgress = document.getElementById("uploadProgress");

  if (!uploadArea || !fileInput || !uploadPrompt || !uploadPreview || !btnUploadImages || !uploadProgress) {
    return;
  }

  const clearDragState = () => uploadArea.classList.remove("drag-over");

  uploadArea.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => handleFileSelect(e.target.files));

  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.add("drag-over");
  });

  uploadArea.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearDragState();
  });

  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearDragState();
    handleFileSelect(e.dataTransfer?.files || []);
  });

  btnUploadImages.addEventListener("click", uploadImagesToServer);
}

function handleFileSelect(fileList) {
  const uploadPrompt = document.getElementById("uploadPrompt");
  const btnUploadImages = document.getElementById("btnUploadImages");
  const uploadPreview = document.getElementById("uploadPreview");
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const incoming = Array.from(fileList || []);
  if (!incoming.length) return;

  const validFiles = incoming.filter((file) => {
    if (!file.type.startsWith("image/")) {
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      showError(`File ${file.name} is too large (max 10MB)`);
      return false;
    }
    return true;
  });

  if (!validFiles.length) {
    showError("Please select valid image files under 10MB.");
    return;
  }

  validFiles.forEach((file) => {
    const exists = state.selectedFiles.find(
      (f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified,
    );
    if (!exists) state.selectedFiles.push(file);
  });

  uploadPrompt.style.display = state.selectedFiles.length ? "none" : "block";
  btnUploadImages.style.display = state.selectedFiles.length ? "block" : "none";
  renderFilePreview(uploadPreview);
  maybeAutoUpload();
}

function renderFilePreview(uploadPreview) {
  uploadPreview.innerHTML = "";

  state.selectedFiles.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const previewItem = document.createElement("div");
      previewItem.className = "preview-item";
      previewItem.innerHTML = `
        <img src="${e.target.result}" alt="${file.name}">
        <div class="preview-name" title="${file.name}">${file.name}</div>
        <button class="preview-remove" data-index="${index}" title="Remove">Remove</button>
      `;

      previewItem.querySelector(".preview-remove")?.addEventListener("click", (evt) => {
        evt.stopPropagation();
        removeSelectedFile(index);
      });

      uploadPreview.appendChild(previewItem);
    };
    reader.readAsDataURL(file);
  });
}

function removeSelectedFile(index) {
  const uploadPrompt = document.getElementById("uploadPrompt");
  const btnUploadImages = document.getElementById("btnUploadImages");
  const uploadPreview = document.getElementById("uploadPreview");

  state.selectedFiles.splice(index, 1);
  uploadPrompt.style.display = state.selectedFiles.length ? "none" : "block";
  btnUploadImages.style.display = state.selectedFiles.length ? "block" : "none";
  renderFilePreview(uploadPreview);
}

function clearSelectedFiles() {
  const uploadPrompt = document.getElementById("uploadPrompt");
  const uploadPreview = document.getElementById("uploadPreview");
  const btnUploadImages = document.getElementById("btnUploadImages");
  const fileInput = document.getElementById("imageUpload");

  state.selectedFiles = [];
  state.isUploading = false;
  if (uploadPrompt) uploadPrompt.style.display = "block";
  if (uploadPreview) uploadPreview.innerHTML = "";
  if (btnUploadImages) {
    btnUploadImages.style.display = "none";
    btnUploadImages.disabled = false;
    btnUploadImages.textContent = "Upload Selected Images";
  }
  if (fileInput) fileInput.value = "";
}

function maybeAutoUpload() {
  if (!state.selectedFiles.length || state.isUploading) return;
  const chapterName = chaptersApi.getActiveChapterName();
  const uploadProgress = document.getElementById("uploadProgress");
  if (!chapterName) {
    if (uploadProgress) uploadProgress.style.display = "none";
    return; // wait until user sets a chapter name
  }
  uploadImagesToServer();
}

async function uploadImagesToServer() {
  const btnUploadImages = document.getElementById("btnUploadImages");
  const uploadProgress = document.getElementById("uploadProgress");

  if (state.isUploading) return;
  const chapterName = chaptersApi.getActiveChapterName();
  if (!chapterName) {
    showError("Enter a chapter name first.");
    if (uploadProgress) {
      uploadProgress.style.display = "block";
      uploadProgress.textContent = "Enter a chapter name first.";
    }
    return;
  }

  if (!state.selectedFiles.length) {
    showError("No files selected for upload.");
    if (uploadProgress) {
      uploadProgress.style.display = "block";
      uploadProgress.textContent = "No files selected.";
    }
    return;
  }

  const chapterFolder = getChapterFolder(
    chapterName,
    state.chapterFolders,
    state.chapters,
    state.currentPages,
  );

  state.isUploading = true;
  if (uploadProgress) {
    uploadProgress.style.display = "block";
    uploadProgress.textContent = "Uploading...";
  }
  btnUploadImages.disabled = true;
  btnUploadImages.textContent = "Uploading...";

  try {
    await fetch("/api/create-chapter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterFolder }),
    });

    const filesPayload = await Promise.all(
      state.selectedFiles.map(async (file) => ({
        name: file.name,
        data: await readFileAsBase64(file),
      })),
    );

    const response = await fetch("/api/upload-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterFolder, files: filesPayload }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Upload failed");

    const newPaths = result.paths || [];
    state.currentPages = sortPagesByFilename([...state.currentPages, ...newPaths]);
    chaptersApi.renderPageList(state.currentPages);
    chaptersApi.markUnsaved();
    clearSelectedFiles();

    const errors = result.errors?.length || 0;
    if (errors > 0) {
      showError(`Uploaded ${newPaths.length} file(s), ${errors} failed.`);
    } else {
      showSuccess(`Successfully uploaded ${newPaths.length} image(s)!`);
    }
  } catch (error) {
    console.error("Upload error:", error);
    showError(`Upload failed: ${error.message}`);
    if (uploadProgress) uploadProgress.textContent = `Upload failed: ${error.message}`;
  } finally {
    state.isUploading = false;
    btnUploadImages.disabled = false;
    btnUploadImages.textContent = "Upload Selected Images";
    setTimeout(() => {
      if (uploadProgress) uploadProgress.style.display = "none";
    }, 1200);
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------------- RENUMBER ----------------
async function renumberPages() {
  const chapterName = chaptersApi.getActiveChapterName();
  const chapterFolder = getChapterFolder(
    chapterName,
    state.chapterFolders,
    state.chapters,
    state.currentPages,
  );
  const btnRenumber = el.btnRenumberPages;
  const originalText = btnRenumber?.textContent || "Renumber Pages";

  try {
    if (btnRenumber) {
      btnRenumber.disabled = true;
      btnRenumber.textContent = "Renumbering...";
    }
    const response = await fetch("/api/renumber-chapter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterFolder, order: state.currentPages }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Renumber failed");
    state.currentPages = result.paths || [];
    chaptersApi.renderPageList(state.currentPages);
    chaptersApi.markUnsaved();
    showSuccess(`Renumbered ${state.currentPages.length} file(s).`);
  } catch (error) {
    console.error("Renumber error:", error);
    showError(`Renumber failed: ${error.message}`);
  } finally {
    if (btnRenumber) {
      btnRenumber.textContent = originalText;
      btnRenumber.disabled = false;
    }
  }
}

// ---------------- INIT ----------------
async function showDashboard() {
  el.loginScreen.style.display = "none";
  el.adminDashboard.style.display = "block";
  try {
    await chaptersApi.loadChapters();
  } catch (e) {
    console.error("Chapters failed to load:", e);
  }
  try {
    await loadPosts();
  } catch (e) {
    console.error("Posts failed to load:", e);
  }
  try {
    await loadMedia();
  } catch (e) {
    console.error("Media failed to load:", e);
  }
  chaptersApi.renderStatusMessageInput();
  chaptersApi.renderChapterList();
}

function attachEventHandlers() {
  // Login
  el.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = document.getElementById("password").value;
    const success = await login(password, showDashboard);
    if (!success) {
      el.loginError.textContent = "Invalid password";
      el.loginError.className = "error-message";
      el.loginError.style.display = "block";
    } else {
      el.loginError.style.display = "none";
    }
  });

  el.btnLogout.addEventListener("click", logout);

  // Chapters
  el.btnAddChapter.addEventListener("click", chaptersApi.addNewChapter);
  if (el.btnSaveStatus) {
    el.btnSaveStatus.addEventListener("click", chaptersApi.saveStatusMessage);
  }
  el.btnCloseModal.addEventListener("click", chaptersApi.hideModal);
  el.btnCancelEdit.addEventListener("click", chaptersApi.hideModal);
  el.editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await chaptersApi.saveChapterEdit();
  });
  el.btnAddPage.addEventListener("click", chaptersApi.addPage);

  // Preview & export
  el.btnPreview.addEventListener("click", () => {
    const jsonData = JSON.stringify(state.chapters, null, 2);
    if (el.previewData) el.previewData.textContent = jsonData;
    if (el.previewSection) el.previewSection.style.display = "block";
    updatePreviewChapters(
      state.currentEditingChapter || Object.keys(state.chapters)[0] || "",
    );
    if (el.previewSection)
      el.previewSection.scrollIntoView({ behavior: "smooth" });
  });
  el.btnCopy.addEventListener("click", copyToClipboard);
  el.btnDownload.addEventListener("click", downloadJSON);
  el.btnBlog.addEventListener("click", () => {
    if (el.blogSection) {
      el.blogSection.style.display = "block";
      el.blogSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
  el.btnSavePost.addEventListener("click", async (e) => {
    e.preventDefault();
    await savePost();
  });

  if (el.btnMedia) {
    el.btnMedia.addEventListener("click", () => {
      state.pendingMediaSelection = null;
      showMediaSection();
    });
  }
  if (el.btnMediaPicker) {
    el.btnMediaPicker.addEventListener("click", () => {
      state.pendingMediaSelection = "post";
      showMediaSection();
    });
  }
  if (el.btnAddMedia) {
    el.btnAddMedia.addEventListener("click", addMediaItem);
  }
  if (el.btnSyncMedia) {
    el.btnSyncMedia.addEventListener("click", () => syncMediaFromDisk(true));
  }
  if (el.mediaSearch) {
    el.mediaSearch.addEventListener("input", renderMedia);
  }
  if (el.previewChapterSelect) {
    el.previewChapterSelect.addEventListener("change", (e) => {
      setPreviewChapter(e.target.value);
    });
  }
  if (el.previewPrev) {
    el.previewPrev.addEventListener("click", () => {
      state.previewState.index = Math.max(0, state.previewState.index - 1);
      renderPreviewImage();
    });
  }
  if (el.previewNext) {
    el.previewNext.addEventListener("click", () => {
      state.previewState.index = Math.min(
        (state.previewState.pages.length || 1) - 1,
        state.previewState.index + 1,
      );
      renderPreviewImage();
    });
  }

  // GitHub
  el.btnSettings.addEventListener("click", showSettingsModal);
  el.btnCloseSettings.addEventListener("click", hideSettingsModal);
  el.btnSaveToken.addEventListener("click", saveGitHubToken);
  el.btnPublish.addEventListener("click", publishToGitHub);

  // Renumber
  if (el.btnRenumberPages) {
    el.btnRenumberPages.addEventListener("click", renumberPages);
  }

  // Close modals on backdrop
  el.editModal.addEventListener("click", (e) => {
    if (e.target === el.editModal) chaptersApi.hideModal();
  });
  el.settingsModal.addEventListener("click", (e) => {
    if (e.target === el.settingsModal) hideSettingsModal();
  });
}

async function init() {
  attachEventHandlers();
  initUploadHandlers();
  const isAuthenticated = await checkSession(showDashboard);
  if (!isAuthenticated) {
    el.loginScreen.style.display = "flex";
    el.adminDashboard.style.display = "none";
  }
  console.log("Battle Bros Admin initialized");
}

if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  setTimeout(init, 0);
} else {
  document.addEventListener("DOMContentLoaded", init);
}
