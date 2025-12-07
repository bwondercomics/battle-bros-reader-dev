(function () {
      'use strict';

      const CONFIG_KEY = 'battlebros_page_config';

      // Default config matches original HTML
      const SUPPORT_TEXT_HTML = `<span class="bubble-em">WANT TO SUPPORT THE COMIC?</span>
              <span class="bubble-bold">Buy the physical book</span> at the
              <a class="bubble-highlight" href="https://bwondercomics.bigcartel.com/product/battle-bros-volume-1" target="_blank" rel="noopener noreferrer" aria-label="bwondercomics store link">bwondercomics store!</a>`;
      const SUPPORT_TEXT_PLAIN = "WANT TO SUPPORT THE COMIC? Buy the physical book at the bwondercomics store!";

      const defaultConfig = {
        theme: {
          primary: '#00d9ff',
          secondary: '#ff00ea',
          accent: '#ffed00',
          bgDark: '#0a0a12',
          bgPanel: '#1a1a2e',
          text: '#ffffff',
          danger: '#ff3838'
        },
        layout: {
          leftPanel: { enabled: true, order: 1 },
          viewport: { enabled: true, order: 2 },
          rightPanel: { enabled: true, order: 3 }
        },
        content: {
          header: {
            title: "BATTLE BROS",
            subtitle: "",
            subtitles: []
          },
          leftPanel: {
            topText: "TO GO EVEN FURTHER BEYOND",
            bottomText: SUPPORT_TEXT_HTML,
            image: "bookturn.gif"
          },
          rightPanel: {
            image: "banner3.png",
            buttons: [
              { icon: "B", text: "Bluesky", url: "https://bsky.app/profile/bwondercomics.com" },
              { icon: "P", text: "Patreon", url: "https://patreon.com/doylemelville2" },
              { icon: "A", text: "ArtStation", url: "https://doyle-melvilleii.artstation.com" },
              { icon: "S", text: "Buy Print", url: "https://bwondercomics.bigcartel.com/product/battle-bros-volume-1" }
            ]
          }
        }
      };

      async function initCustomization() {
        let config = null;
        const urlParams = new URLSearchParams(window.location.search);
        const isPreview = urlParams.get('preview') === 'true';

        try {
          if (isPreview) {
            // Try loading draft from localStorage
            const draft = localStorage.getItem(CONFIG_KEY);
            if (draft) {
              config = JSON.parse(draft);
              console.log('Loaded config from localStorage (Preview Mode)');
            }
          }

          if (!config) {
            // Try loading from file
            const response = await fetch('admin/page-config.json');
            if (response.ok) {
              config = await response.json();
              console.log('Loaded config from page-config.json');
            }
          }
        } catch (e) {
          console.warn('Failed to load config, using defaults', e);
        }

        applyConfig(config || defaultConfig);
      }

      function applyConfig(config) {
        if (!config) return;

        // 1. Apply Theme
        if (config.theme) {
          const root = document.documentElement;
          Object.entries(config.theme).forEach(([key, value]) => {
            // Convert camelCase to kebab-case for CSS vars (e.g. bgDark -> --bg-dark)
            const cssVar = '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
            root.style.setProperty(cssVar, value);
          });
        }

        // 2. Apply Content
        if (config.content) {
          // Header
          if (config.content.header) {
            const titleEl = document.querySelector('.title h1');
            if (titleEl) titleEl.textContent = config.content.header.title;

            const customSubs = Array.isArray(config.content.header.subtitles)
              ? config.content.header.subtitles.filter(Boolean)
              : [];
            if (window.BattleBros?.setSubtitles) {
              window.BattleBros.setSubtitles(customSubs);
            }
          }

          // Left Panel
          if (config.content.leftPanel) {
            const topText = document.querySelector('.left-panel-text-top');
            if (topText) topText.textContent = config.content.leftPanel.topText;

            const botText = document.querySelector('.left-panel-text-bottom');
            if (botText && config.content.leftPanel.bottomText) {
              const val = config.content.leftPanel.bottomText;
              if (typeof val === 'string') {
                if (val.includes('<')) {
                  botText.innerHTML = val;
                } else if (val.trim() === SUPPORT_TEXT_PLAIN) {
                  botText.innerHTML = SUPPORT_TEXT_HTML;
                } else {
                  botText.textContent = val;
                }
              } else {
                botText.innerHTML = SUPPORT_TEXT_HTML;
              }
            }

            const img = document.querySelector('#leftPreview img');
            if (img && config.content.leftPanel.image) {
              img.src = config.content.leftPanel.image;
            }
          }

          // Right Panel
          if (config.content.rightPanel) {
            const img = document.querySelector('#rightPreview img');
            if (img && config.content.rightPanel.image) {
              img.src = config.content.rightPanel.image;
            }

            // Buttons
            if (config.content.rightPanel.buttons) {
              const btnContainer = document.querySelector('.panel-buttons');
              if (btnContainer) {
                btnContainer.innerHTML = config.content.rightPanel.buttons.map(btn => `
              <a href="${btn.url}" target="_blank" rel="noopener noreferrer" class="panel-btn">
                <div class="panel-btn-icon">${btn.icon}</div>
                <div class="panel-btn-text">${btn.text}</div>
              </a>
            `).join('');
              }
            }
          }
        }

        // 3. Apply Layout
        if (config.layout) {
          const container = document.querySelector('.viewerWrap');
          const leftPanel = document.getElementById('leftPanel');
          const mainContent = document.getElementById('mainContent');
          const rightPanel = document.getElementById('rightPanel');

          if (container && leftPanel && mainContent && rightPanel) {
            const elements = [
              { el: leftPanel, conf: config.layout.leftPanel },
              { el: mainContent, conf: config.layout.viewport },
              { el: rightPanel, conf: config.layout.rightPanel }
            ];

            // Sort by order
            elements.sort((a, b) => (a.conf?.order || 0) - (b.conf?.order || 0));

            // Re-append in new order
            elements.forEach(item => {
              if (item.conf && item.conf.enabled === false) {
                item.el.style.display = 'none';
              } else {
                item.el.style.display = ''; // Reset display
                container.appendChild(item.el);
              }
            });
          }
        }
      }

      // Run initialization
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCustomization);
      } else {
        initCustomization();
      }

    })();

