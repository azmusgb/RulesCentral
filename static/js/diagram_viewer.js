  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

    document.addEventListener('DOMContentLoaded', () => {
        const editor = initializeEditor();
        const diagramPreview = document.getElementById('diagram-preview');
        const spinnerOverlay = document.getElementById('spinner-overlay');
        const toggleThemeButton = document.getElementById('toggle-theme');
        let isLightMode = document.body.classList.contains('light-mode');
        let panZoomInstance = null;

        function getThemeVariables(isLight) {
            return isLight
                ? {
                    backgroundColor: '#ffffff',
                    primaryColor: '#26a69a',
                    primaryTextColor: '#212121',
                    nodeBorder: '#26a69a',
                    nodeTextColor: '#000',
                    edgeLabelBackgroundColor: 'rgba(255, 255, 255, 0.95)',
                    edgeLabelColor: '#333',
                    edgeLabelFontSize: '1.4em',
                    edgeLabelFontWeight: '700',
                    edgeLabelBorderColor: '#4CAF50',
                    edgeLabelBorderWidth: '2px',
                    edgeLabelBorderRadius: '10px',
                    edgeLabelBoxShadow: '3px 3px 12px rgba(0, 0, 0, 0.25)',
                    edgeLabelPadding: '8px 12px'
                }
                : {
                    backgroundColor: '#121212',
                    primaryColor: '#26a69a',
                    primaryTextColor: '#ffffff',
                    nodeBorder: '#26a69a',
                    nodeTextColor: '#fff',
                    edgeLabelBackgroundColor: 'rgba(0, 0, 0, 0.7)',
                    edgeLabelColor: '#eee',
                    edgeLabelFontSize: '1.4em',
                    edgeLabelFontWeight: '700',
                    edgeLabelBorderColor: '#66bb6a',
                    edgeLabelBorderWidth: '2px',
                    edgeLabelBorderRadius: '10px',
                    edgeLabelBoxShadow: '3px 3px 12px rgba(255, 255, 255, 0.2)',
                    edgeLabelPadding: '8px 12px'
                };
        }

        function initializeMermaid() {
            mermaid.initialize({
                startOnLoad: false,
                securityLevel: 'loose',
                maxTextSize: 500000000,
                maxEdges: 1000000,
                htmlLabels: true,
                theme: isLightMode ? 'default' : 'dark',
                themeVariables: getThemeVariables(isLightMode),
                flowchart: { useMaxWidth: false, htmlLabels: true }
            });
        }

        async function renderMermaidDiagram(code) {
            if (!code.trim()) {
                console.warn("Cannot render: Diagram content is empty.");
                return;
            }

            spinnerOverlay.style.display = 'flex';
            diagramPreview.innerHTML = "";

            try {
                const { svg } = await mermaid.render('diagram', code);
                diagramPreview.innerHTML = svg;

                const svgElement = diagramPreview.querySelector('svg');
                if (svgElement) {
                    svgElement.removeAttribute("width");
                    svgElement.removeAttribute("height");
                    svgElement.style.width = "100%";
                    svgElement.style.height = "100%";
                    svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");
                }

                setTimeout(() => { initializePanZoom(); }, 300);
            } catch (error) {
                console.error("Mermaid rendering error:", error);
                diagramPreview.innerHTML = `<p class="red-text">Error rendering diagram: ${error.message}</p>`;
            } finally {
                spinnerOverlay.style.display = 'none';
            }
        }

        function applyTheme(isLight) {
            isLightMode = isLight;
            document.body.classList.toggle('light-mode', isLight);
            document.body.classList.toggle('dark-mode', !isLight);

            editor.setTheme(isLight ? "ace/theme/monokai" : "ace/theme/dracula");
            toggleThemeButton.querySelector('i.material-icons').textContent = isLight ? 'brightness_6' : 'brightness_4';

            mermaid.mermaidAPI.setConfig({
                theme: isLight ? 'default' : 'dark',
                themeVariables: getThemeVariables(isLight)
            });

            renderMermaidDiagram(editor.getValue().trim());
        }

        function initializeEditor() {
            const editor = ace.edit("editor", {
                mode: "ace/mode/markdown",
                theme: "ace/theme/monokai",
                enableBasicAutocompletion: true,
                enableLiveAutocompletion: true
            });
            editor.setOptions({ fontSize: "12px", wrap: true });
            return editor;
        }

        function initializePanZoom() {
            const svgElement = diagramPreview.querySelector('svg');
            if (!svgElement) return;

            if (panZoomInstance) panZoomInstance.destroy();

            panZoomInstance = svgPanZoom(svgElement, {
                zoomEnabled: true,
                controlIconsEnabled: false,
                fit: false,
                center: false,
                dblClickZoomEnabled: false,
                minZoom: 0.1,
                maxZoom: 50,
                zoomScaleSensitivity: 2
            });

            setTimeout(() => {
                const bbox = svgElement.getBBox();
                const container = diagramPreview.getBoundingClientRect();
                if (bbox.width && bbox.height) {
                    const scaleX = container.width / bbox.width;
                    const scaleY = container.height / bbox.height;
                    const scale = Math.min(scaleX, scaleY) * 0.95;

                    panZoomInstance.zoom(scale);
                    panZoomInstance.pan({
                        x: (container.width - bbox.width * scale) / 2 - bbox.x * scale,
                        y: (container.height - bbox.height * scale) / 2 - bbox.y * scale
                    });
                }
            }, 100);
        }

        function toggleTheme() {
            applyTheme(!isLightMode);
        }

        async function loadDiagramFromURL() {
            const urlParams = new URLSearchParams(window.location.search);
            const rootName = urlParams.get('root_name');
            const diagramName = urlParams.get('diagramName');

            if (!rootName || !diagramName) {
                console.error("Missing 'root_name' or 'diagramName' in URL parameters.");
                M.toast({ html: 'Missing diagram parameters in URL.', classes: 'red' });
                return;
            }

            await loadDiagram(rootName, diagramName);
        }

// Enhanced highlight function with improved styling.
    function highlightTextInDiagram(term) {
      const svgElement = diagramPreview.querySelector('svg');
      if (!svgElement) return;
      // Remove existing highlights
      svgElement.querySelectorAll('.highlight, .foreign-highlight').forEach(el => {
        el.classList.remove('highlight');
        el.classList.remove('foreign-highlight');
      });
      if (!term) return;
      const lowerTerm = term.toLowerCase();
      let matches = 0;
      // Highlight <text> elements
      svgElement.querySelectorAll('text').forEach(el => {
        if (el.textContent.toLowerCase().includes(lowerTerm)) {
          el.classList.add('highlight');
          matches++;
        }
      });
      // Highlight content within foreignObject
      svgElement.querySelectorAll('foreignObject > div').forEach(el => {
        if (el.textContent.toLowerCase().includes(lowerTerm)) {
          el.classList.add('foreign-highlight');
          matches++;
        }
      });
      console.log(matches, "match(es) found for", term);
    }
document.getElementById('search-svg-input').addEventListener('keydown', function(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    const term = this.value.trim();
    highlightTextInDiagram(term);
  }
});

        async function loadDiagram(rootName, diagramName) {
            try {
                const response = await fetch(`/diagrams/${rootName}/${diagramName}`);
                if (!response.ok) {
                    throw new Error(`Diagram file not found: ${diagramName} (HTTP ${response.status})`);
                }

                const diagramText = await response.text();
                document.title = `${rootName} - ${diagramName}`;
                editor.setValue(diagramText, -1);
                editor.clearSelection();
                renderMermaidDiagram(diagramText);

            } catch (error) {
                console.error("Error loading diagram:", error);
                M.toast({ html: 'Error loading diagram. Check console.', classes: 'red' });
            }
        }

        // Event Listeners
        toggleThemeButton.addEventListener('click', toggleTheme);

        document.getElementById('toggle-editor-button').addEventListener('click', () => {
            document.getElementById('editor-container').classList.toggle('collapsed');
        });

        document.getElementById('search-svg-button').addEventListener('click', () => {
            const term = document.getElementById('search-svg-input').value.trim();
            highlightTextInDiagram(term);
        });

        document.getElementById('clear-search').addEventListener('click', () => {
            document.getElementById('search-svg-input').value = '';
            highlightTextInDiagram('');
        });

        document.getElementById('zoom-in-button').addEventListener('click', () => { if (panZoomInstance) panZoomInstance.zoomIn(); });
        document.getElementById('zoom-out-button').addEventListener('click', () => { if (panZoomInstance) panZoomInstance.zoomOut(); });
        document.getElementById('reset-zoom-button').addEventListener('click', () => { if (panZoomInstance) panZoomInstance.resetZoom(); });

        initializeMermaid();
        loadDiagramFromURL();
    });