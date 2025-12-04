import os

file_path = 'index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
js_funcs_inserted = False
listener_inserted = False
init_inserted = False

js_funcs_content = """      // ==================== COVER GALLERY ====================

      function initChapterGallery() {
        const grid = document.getElementById('galleryGrid');
        if (!grid) return;

        grid.innerHTML = '';

        Object.keys(chapters).forEach(name => {
          const pages = chapters[name];
          if (!pages || pages.length === 0) return;

          const coverUrl = pages[0]; // Assume first page is cover

          const card = document.createElement('div');
          card.className = 'chapter-card';
          card.onclick = () => {
            if (el.chapter) el.chapter.value = name;
            changeChapter(name);
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

        // Close button
        const closeBtn = document.getElementById('galleryClose');
        if (closeBtn) {
          closeBtn.onclick = toggleGallery;
        }
      }

      function toggleGallery() {
        const overlay = document.getElementById('galleryOverlay');
        if (overlay) {
          overlay.classList.toggle('active');
        }
      }

"""

listener_content = """        // Gallery button
        const galleryBtn = document.getElementById('galleryBtn');
        if (galleryBtn) galleryBtn.addEventListener('click', toggleGallery);
"""

init_content = """        initChapterGallery();
"""

for i, line in enumerate(lines):
    # JS Functions
    if not js_funcs_inserted and '// ==================== EVENT HANDLERS ====================' in line:
        new_lines.append(js_funcs_content)
        new_lines.append(line)
        js_funcs_inserted = True
        continue

    # Listener
    if not listener_inserted and "if (helpBtn) helpBtn.addEventListener('click', toggleShortcutsOverlay);" in line:
        new_lines.append(line)
        new_lines.append(listener_content)
        listener_inserted = True
        continue

    # Init
    if not init_inserted and 'initChapterSelect();' in line:
        new_lines.append(line)
        new_lines.append(init_content)
        init_inserted = True
        continue

    new_lines.append(line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"JS Functions Inserted: {js_funcs_inserted}")
print(f"Listener Inserted: {listener_inserted}")
print(f"Init Inserted: {init_inserted}")
