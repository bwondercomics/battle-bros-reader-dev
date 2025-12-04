import os

file_path = 'index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
css_inserted = False
button_inserted = False
overlay_inserted = False

css_content = """    /* ==================== GALLERY OVERLAY ==================== */
    .gallery-overlay {
      position: fixed;
      inset: 0;
      background: rgba(10, 10, 18, 0.95);
      backdrop-filter: blur(10px);
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }

    .gallery-overlay.active {
      opacity: 1;
      pointer-events: auto;
    }

    .gallery-panel {
      background: linear-gradient(135deg, rgba(26, 26, 46, 0.95), rgba(10, 10, 18, 0.95));
      border: 3px solid var(--primary);
      border-radius: 12px;
      padding: 30px;
      width: 90%;
      max-width: 1200px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      gap: 20px;
      box-shadow: 0 0 40px rgba(0, 217, 255, 0.2);
      position: relative;
    }

    .gallery-panel h2 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 32px;
      color: var(--accent);
      text-align: center;
      margin: 0;
      text-shadow: 0 0 10px rgba(255, 237, 0, 0.5);
      letter-spacing: 2px;
    }

    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 20px;
      overflow-y: auto;
      padding: 10px;
      /* Custom scrollbar */
      scrollbar-width: thin;
      scrollbar-color: var(--primary) var(--bg-dark);
    }

    .gallery-grid::-webkit-scrollbar {
      width: 8px;
    }

    .gallery-grid::-webkit-scrollbar-track {
      background: var(--bg-dark);
    }

    .gallery-grid::-webkit-scrollbar-thumb {
      background-color: var(--primary);
      border-radius: 4px;
    }

    .chapter-card {
      background: rgba(0, 0, 0, 0.3);
      border: 2px solid rgba(0, 217, 255, 0.3);
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
    }

    .chapter-card:hover {
      transform: translateY(-5px);
      border-color: var(--accent);
      box-shadow: 0 5px 15px rgba(0, 217, 255, 0.3);
    }

    .chapter-thumb {
      width: 100%;
      aspect-ratio: 2/3;
      object-fit: cover;
      background: #000;
    }

    .chapter-info {
      padding: 10px;
      text-align: center;
      background: rgba(0, 217, 255, 0.1);
    }

    .chapter-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 18px;
      color: var(--text);
      letter-spacing: 1px;
    }

    .gallery-close {
      align-self: center;
      padding: 10px 30px;
      background: transparent;
      border: 2px solid var(--danger);
      color: var(--danger);
      font-family: 'Bebas Neue', sans-serif;
      font-size: 18px;
      cursor: pointer;
      transition: all 0.2s;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .gallery-close:hover {
      background: var(--danger);
      color: var(--bg-dark);
      box-shadow: 0 0 15px rgba(255, 56, 56, 0.4);
    }

"""

button_content = """          <button id="galleryBtn" class="nav-link" aria-label="Open Chapter Gallery" title="Chapter Gallery">
            🖼️ GALLERY
          </button>
"""

overlay_content = """  <!-- Chapter Gallery Overlay -->
  <div class="gallery-overlay" id="galleryOverlay">
    <div class="gallery-panel">
      <h2>📚 Chapter Gallery</h2>
      <div class="gallery-grid" id="galleryGrid">
        <!-- Chapter cards populated by JS -->
      </div>
      <button class="gallery-close" id="galleryClose">Close</button>
    </div>
  </div>

"""

for i, line in enumerate(lines):
    # CSS Insertion
    if not css_inserted and '/* ==================== VIEWER LAYOUT ==================== */' in line:
        new_lines.append(css_content)
        new_lines.append(line)
        css_inserted = True
        continue

    # Button Insertion
    # We look for the closing tag of the select element
    if not button_inserted and '</select>' in line and 'id="chapter"' in lines[i-2]: # approximate check
         new_lines.append(line)
         new_lines.append(button_content)
         button_inserted = True
         continue
    
    # Better button check: look for the line after </select> if it's inside the header actions
    # The select is at line ~1796.
    # Let's just look for the specific line content
    if not button_inserted and line.strip() == '</select>' and 'id="chapter"' in lines[i-2]:
         new_lines.append(line)
         new_lines.append(button_content)
         button_inserted = True
         continue

    # Overlay Insertion
    if not overlay_inserted and '<!-- Keyboard Shortcuts Overlay -->' in line:
        new_lines.append(overlay_content)
        new_lines.append(line)
        overlay_inserted = True
        continue

    new_lines.append(line)

# Fallback for button if strict check failed (it might be on a different line or indented differently)
# Let's try to be more robust for the button.
# The select block is:
#           <select id="chapter" aria-label="Select Chapter">
#             <!-- Options populated by JS -->
#           </select>

# Re-reading to fix button logic if needed.
# I'll rewrite the loop to be safer.

new_lines = []
css_inserted = False
button_inserted = False
overlay_inserted = False

for i, line in enumerate(lines):
    # CSS
    if not css_inserted and '/* ==================== VIEWER LAYOUT ==================== */' in line:
        new_lines.append(css_content)
        new_lines.append(line)
        css_inserted = True
        continue

    # Button
    # We insert AFTER the select closing tag.
    # We can identify the select by its ID.
    if not button_inserted and '</select>' in line:
        # Check if this is the chapter select
        # Look backwards a few lines
        is_chapter_select = False
        for j in range(1, 5):
            if i - j >= 0 and 'id="chapter"' in lines[i-j]:
                is_chapter_select = True
                break
        
        if is_chapter_select:
            new_lines.append(line)
            new_lines.append(button_content)
            button_inserted = True
            continue

    # Overlay
    if not overlay_inserted and '<!-- Keyboard Shortcuts Overlay -->' in line:
        new_lines.append(overlay_content)
        new_lines.append(line)
        overlay_inserted = True
        continue

    new_lines.append(line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"CSS Inserted: {css_inserted}")
print(f"Button Inserted: {button_inserted}")
print(f"Overlay Inserted: {overlay_inserted}")
