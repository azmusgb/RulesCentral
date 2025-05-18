let debounceTimer;

document.addEventListener('DOMContentLoaded', async () => {
  M.Collapsible.init(document.querySelectorAll('.collapsible'));
  M.Tooltip.init(document.querySelectorAll('.tooltipped'));
  loadCatalog();

  document.getElementById('searchInput').addEventListener('input', function() {
    document.getElementById('clearSearch').style.display = this.value ? 'block' : 'none';
  });
});

async function loadCatalog() {
  try {
    const response = await fetch('/api/diagram_catalogs');
    if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);
    const catalogs = await response.json();
    console.log("📂 Loaded Catalogs:", catalogs);

    // Group catalogs by top-level parent.
    // For categories starting with "Function_", perform extra grouping by the second part.
    const groupedCatalogs = {};
    catalogs.forEach(cat => {
      if (cat.category.startsWith("Function_")) {
        const parts = cat.category.split('_');
        const top = parts[0];
        const subgroup = parts[1] || "General";
        if (!groupedCatalogs[top]) {
          groupedCatalogs[top] = {};
        }
        if (!groupedCatalogs[top][subgroup]) {
          groupedCatalogs[top][subgroup] = [];
        }
        groupedCatalogs[top][subgroup] = groupedCatalogs[top][subgroup].concat(cat.entries);
      } else {
        const parent = cat.category.split('_')[0];
        if (!groupedCatalogs[parent]) {
          groupedCatalogs[parent] = [];
        }
        groupedCatalogs[parent] = groupedCatalogs[parent].concat(cat.entries);
      }
    });

    const container = document.getElementById('catalogContainer');
    container.innerHTML = '';

    // Iterate over each top-level group.
    for (const group in groupedCatalogs) {
      const li = document.createElement('li');
      if (group === "Function" && typeof groupedCatalogs[group] === "object" && !Array.isArray(groupedCatalogs[group])) {
        let subgroupHTML = '';
        for (const sub in groupedCatalogs[group]) {
          const itemsHTML = groupedCatalogs[group][sub].map(entry => {
            let displayName = entry.root.replace('.mmd', '').replace('.json', '');
            if (displayName.startsWith("Function_")) {
              const parts = displayName.split('_');
              displayName = parts.length >= 3 ? parts.slice(2).join('_') : parts.slice(1).join('_');
            }
            const diagramName = entry.diagram ? (entry.diagram.endsWith('.mmd') ? entry.diagram : entry.diagram + '.mmd') : '';
            const hierarchyName = entry.hierarchy ? (entry.hierarchy.endsWith('.json') ? entry.hierarchy : entry.hierarchy + '.json') : '';
            return `
              <div class="diagram-item">
                <span>${displayName}</span>
                <span class="diagram-actions">
                  ${diagramName ? `<a href="/view_diagram?root_name=${encodeURIComponent(entry.root)}&diagramName=${encodeURIComponent(diagramName)}" class="tooltipped view-diagram teal-text" data-tooltip="View Diagram"><i class="material-icons">visibility</i></a>` : ''}
                  ${hierarchyName ? `<a href="/view_hierarchy?root_name=${encodeURIComponent(entry.root)}&diagramName=${encodeURIComponent(hierarchyName)}" class="tooltipped view-hierarchy blue-text" data-tooltip="View Hierarchy"><i class="material-icons">account_tree</i></a>` : ''}
                </span>
              </div>
            `;
          }).join('');
          subgroupHTML += `
            <li>
              <div class="collapsible-header"><i class="material-icons">folder_open</i> ${sub}</div>
              <div class="collapsible-body">
                ${itemsHTML}
              </div>
            </li>
          `;
        }
        li.innerHTML = `
          <div class="collapsible-header"><i class="material-icons">folder</i> ${group}</div>
          <div class="collapsible-body">
            <ul class="collapsible">
              ${subgroupHTML}
            </ul>
          </div>
        `;
      } else {
        const groupHTML = groupedCatalogs[group].map(entry => {
          let displayName = entry.root.replace('.mmd','').replace('.json','');
          const underscoreIndex = displayName.indexOf('_');
          if (underscoreIndex !== -1) {
            displayName = displayName.substring(underscoreIndex + 1);
          }
          const diagramName = entry.diagram ? (entry.diagram.endsWith('.mmd') ? entry.diagram : entry.diagram + '.mmd') : '';
          const hierarchyName = entry.hierarchy ? (entry.hierarchy.endsWith('.json') ? entry.hierarchy : entry.hierarchy + '.json') : '';
          return `
            <div class="diagram-item">
              <span>${displayName}</span>
              <span class="diagram-actions">
                ${diagramName ? `<a href="/view_diagram?root_name=${encodeURIComponent(entry.root)}&diagramName=${encodeURIComponent(diagramName)}" class="tooltipped view-diagram teal-text" data-tooltip="View Diagram"><i class="material-icons">visibility</i></a>` : ''}
                ${hierarchyName ? `<a href="/view_hierarchy?root_name=${encodeURIComponent(entry.root)}&diagramName=${encodeURIComponent(hierarchyName)}" class="tooltipped view-hierarchy blue-text" data-tooltip="View Hierarchy"><i class="material-icons">account_tree</i></a>` : ''}
              </span>
            </div>
          `;
        }).join('');
        li.innerHTML = `
          <div class="collapsible-header"><i class="material-icons">folder_open</i> ${group}</div>
          <div class="collapsible-body">
            ${groupHTML}
          </div>
        `;
      }
      container.appendChild(li);
    }

    // Initialize collapsible and tooltips.
    M.Collapsible.init(document.querySelectorAll('.collapsible'));
    M.Tooltip.init(document.querySelectorAll('.tooltipped'));

    // Show "no results" message if catalog is empty.
    document.getElementById('noResults').style.display = container.children.length === 0 ? 'block' : 'none';
  } catch (error) {
    console.error("❌ Error loading catalog:", error);
    M.toast({html: `Error: ${error.message}`, classes: 'red'});
  }
}

function debouncedFilterCatalog() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(filterCatalog, 300);
}

function filterCatalog() {
  const term = document.getElementById('searchInput').value.toLowerCase();
  let anyVisible = false;
  document.querySelectorAll('#catalogContainer .diagram-item').forEach(item => {
    if (item.innerText.toLowerCase().includes(term)) {
      item.style.display = '';
      anyVisible = true;
    } else {
      item.style.display = 'none';
    }
  });
  document.getElementById('noResults').style.display = anyVisible ? 'none' : 'block';
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  document.getElementById('clearSearch').style.display = 'none';
  filterCatalog();
}

function expandAll() {
  const collapsibles = document.querySelectorAll('.collapsible');
  M.Collapsible.getInstance(collapsibles[0]).open(0); // Open first group as example.
  // Alternatively, loop over all collapsible items and add "active" class.
  document.querySelectorAll('.collapsible-header').forEach(header => {
    header.classList.add('active');
  });
  document.querySelectorAll('.collapsible-body').forEach(body => {
    body.style.display = 'block';
  });
}

function collapseAll() {
  document.querySelectorAll('.collapsible-header').forEach(header => {
    header.classList.remove('active');
  });
  document.querySelectorAll('.collapsible-body').forEach(body => {
    body.style.display = 'none';
  });



}