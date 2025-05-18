// hierarchy_viewer.js

// Initialize Materialize components (Modal and Collapsible)
document.addEventListener('DOMContentLoaded', function() {
  M.Modal.init(document.querySelectorAll('.modal'));
  M.Collapsible.init(document.querySelectorAll('.collapsible'));
  const closeModalBtn = document.getElementById('close-modal');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', function() {
      const modalInstance = M.Modal.getInstance(document.getElementById('rule-modal'));
      modalInstance.close();
    });
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  // Get attributes from body
  const rootName = document.body.getAttribute("data-root-name");
  const diagramName = document.body.getAttribute("data-diagram-name");
  document.getElementById("root-name-display").textContent = rootName || "";

  // Global state variables
  let hierarchyData = [];
  let currentRule = null;
  let searchDebounce;

  // DOM references
  const outlineEl           = document.getElementById("diagram-outline");
  const searchInput         = document.getElementById("hierarchy-search");
  const searchBtn           = document.getElementById("search-btn");
  const filterResetBtn      = document.getElementById("filter-reset");
  const expandAllBtn        = document.getElementById("expand-all");
  const collapseAllBtn      = document.getElementById("collapse-all");
  const ruleTitleEl         = document.getElementById("rule-title");
  const attributesTableBody = document.getElementById("attributes-table-body");
  const actionsTableBody    = document.getElementById("actions-table-body");
  const showMoreJsonBtn     = document.getElementById("show-more-json");
  const rawJsonBlock        = document.getElementById("raw-json-block");
  const spinner             = document.getElementById("hierarchy-spinner");
  const paramTableBody      = document.getElementById("paramlist-table-body");

  // -------------------------------
  // 1) LOAD THE DIAGRAM CATALOG
  // -------------------------------
  async function loadDiagramCatalog() {
    try {
      const response = await fetch('/api/diagram_catalogs');
      if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);
      const catalogs = await response.json();
      console.log("📂 Loaded Catalogs:", catalogs);

      // Process catalogs: we want to extract entries from groups starting with "Function_"
      let functionEntries = [];
      catalogs.forEach(cat => {
        if (cat.category.startsWith("Function_")) {
          // In your catalog.js you grouped these into subgroups;
          // We assume that the entries are inside cat.entries.
          functionEntries = functionEntries.concat(cat.entries);
        }
      });
      window.diagramCatalog = functionEntries;
      console.log("Global diagramCatalog for functions:", window.diagramCatalog);
    } catch (error) {
      console.error("Error loading diagram catalog:", error);
      window.diagramCatalog = [];
    }
  }

  // Call the catalog loader before building the tree.
  await loadDiagramCatalog();

  // -------------------------------
  // 2) BUILD THE TREE
  // -------------------------------
  function createTreeNode(node, parentElement) {
    if (!node.RuleName && !node.ActionName) return;
    const li = document.createElement("li");
    li.classList.add("tree-node");

    const isAction    = Boolean(node.ActionName);
    const displayText = node.RuleName || node.ActionName;
    const defaultIcon = isAction ? "folder" : "chevron_right";

    li.innerHTML = `
      <span class="toggle-btn material-icons">${defaultIcon}</span>
      <span>${displayText}</span>
    `;
    const toggleBtn = li.querySelector(".toggle-btn");
    const childList = document.createElement("ul");
    childList.classList.add("child-list");

    // Process children (normal rules)
    if (node.Children && node.Children.length > 0) {
      node.Children.forEach(child => createTreeNode(child, childList));
    }
    // Process actions (action nodes)
    if (node.Actions && node.Actions.length > 0) {
      node.Actions.forEach(action => {
        if (action.ActionName) {
          const actionNode = document.createElement("li");
          actionNode.classList.add("tree-node", "action-node");
          actionNode.innerHTML = `
            <span class="toggle-btn material-icons">folder</span>
            <span class="action-label">${action.ActionName}</span>
          `;
          const actionToggleBtn = actionNode.querySelector(".toggle-btn");
          const actionChildList = document.createElement("ul");
          actionChildList.classList.add("child-list");

          if (action.ChildRules && action.ChildRules.length > 0) {
            action.ChildRules.forEach(child => createTreeNode(child, actionChildList));
            actionToggleBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              actionChildList.classList.toggle("expanded");
              actionToggleBtn.textContent = actionChildList.classList.contains("expanded")
                ? "folder_open"
                : "folder";
            });
          } else {
            actionToggleBtn.style.display = "none";
          }
          actionNode.appendChild(actionChildList);
          childList.appendChild(actionNode);
        }
      });
    }

    if (childList.children.length > 0) {
      li.appendChild(childList);
      toggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        childList.classList.toggle("expanded");
        toggleBtn.textContent = childList.classList.contains("expanded")
          ? (isAction ? "folder_open" : "expand_more")
          : (isAction ? "folder" : "chevron_right");
      });
    } else {
      toggleBtn.style.display = "none";
    }

    li.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelectorAll(".tree-node.focused").forEach(n => n.classList.remove("focused"));
      li.classList.add("focused");
      showRuleDetails(node);
    });

    parentElement.appendChild(li);
  }

  function renderHierarchy(data) {
    outlineEl.innerHTML = "";
    const ul = document.createElement("ul");
    ul.classList.add("tree-outline");
    const topLevelNodes = data.filter(node => !node.ParentGUID);
    if (topLevelNodes.length === 0) {
      outlineEl.innerHTML = "<p>No valid hierarchy data found.</p>";
      return;
    }
    topLevelNodes.forEach(rule => createTreeNode(rule, ul));
    outlineEl.appendChild(ul);
  }

  // -------------------------------
  // 3) SHOW RULE DETAILS
  // -------------------------------
  function showRuleDetails(ruleObj) {
    currentRule = ruleObj;
    rawJsonBlock.style.display = "none";
    showMoreJsonBtn.textContent = "SHOW RAW JSON";
    ruleTitleEl.textContent = ruleObj.RuleName || ruleObj.ActionName || "Untitled Rule";
    attributesTableBody.innerHTML = "";
    actionsTableBody.innerHTML = "";

    // Basic fields
    if (ruleObj.RuleName) addDetailRow("Rule Name", ruleObj.RuleName);

    // Process Function field:
    if (ruleObj.FunctionName) {
      const functionValue = ruleObj.FunctionName;
      let functionDisplay = functionValue;
      // Only link if function name does NOT start with '_' and if catalog has a match.
      if (!functionValue.startsWith("_") && window.diagramCatalog) {
        // Expected catalog entry: root should equal "Function_" + functionValue.
        const expectedRoot = "Function_" + functionValue;
        const match = window.diagramCatalog.find(item => item.root === expectedRoot);
        if (match) {
          const hierarchyFileName = functionValue + ".json";
          const hierarchyUrl = `/view_hierarchy?root_name=${encodeURIComponent(expectedRoot)}&diagramName=${encodeURIComponent(hierarchyFileName)}`;
          functionDisplay = `<a href="${hierarchyUrl}">${functionValue}</a>`;
        }
      }
      addDetailRow("Function", functionDisplay);
    }

    if (ruleObj.ParentGUID) addDetailRow("Parent GUID", ruleObj.ParentGUID);

    // Process other attributes (remove leading underscores)
    if (ruleObj.Attributes && Object.keys(ruleObj.Attributes).length > 0) {
      // Group parameters into one collapsible; all others display normally.
      const paramGroups = {};
      Object.entries(ruleObj.Attributes).forEach(([rawKey, val]) => {
        const key = rawKey.replace(/^_/, "");
        const displayVal = (typeof val === "string") ? val.replace(/^\{+|\}+$/g, "") : val;
        // Check for ParamList or ParamListOMRIndex keys.
        const m = key.match(/^(ParamList|ParamListOMRIndex)(\d+)$/);
        if (m) {
          const idx = m[2];
          if (!paramGroups[idx]) paramGroups[idx] = {};
          paramGroups[idx][m[1]] = displayVal;
        } else {
          addDetailRow(key, displayVal);
        }
      });
      // Populate the single Parameters collapsible table:
      paramTableBody.innerHTML = "";
      Object.keys(paramGroups).sort((a, b) => parseInt(a) - parseInt(b)).forEach(idx => {
        const group = paramGroups[idx];
        const col1 = group.ParamList || "";
        const col2 = group.ParamListOMRIndex || "";
        const row = document.createElement("tr");
        const td1 = document.createElement("td");
        td1.textContent = col1;
        const td2 = document.createElement("td");
        td2.textContent = col2;
        row.appendChild(td1);
        row.appendChild(td2);
        paramTableBody.appendChild(row);
      });
    } else {
      addDetailRow("Attributes", "No attributes available.");
    }

    // Process ChildRules for Actions (if any)
    if (ruleObj.ChildRules && ruleObj.ChildRules.length > 0) {
      ruleObj.ChildRules.forEach((child, idx) => {
        addActionRow(`SubRule ${idx + 1}`, child.RuleName || "Untitled SubRule");
      });
    }

    // Re-initialize the collapsible for Parameters
    const paramCollapsible = document.getElementById("param-collapsible");
    M.Collapsible.init(paramCollapsible);

    // Show raw JSON of selected rule
    rawJsonBlock.textContent = JSON.stringify(ruleObj, null, 2);
  }

  // Helper function using innerHTML for hyperlink support.
  function addDetailRow(fieldName, fieldValue) {
    const row = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = fieldName;
    const td = document.createElement("td");
    td.innerHTML = fieldValue;
    row.appendChild(th);
    row.appendChild(td);
    attributesTableBody.appendChild(row);
  }
  function addActionRow(fieldName, fieldValue) {
    const row = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = fieldName;
    const td = document.createElement("td");
    td.textContent = fieldValue;
    row.appendChild(th);
    row.appendChild(td);
    actionsTableBody.appendChild(row);
  }

  // -------------------------------
  // 4) SEARCH & FILTER
  // -------------------------------
  function applySearchFilter(term) {
    const allNodes = document.querySelectorAll(".tree-node");
    if (!term) {
      allNodes.forEach(node => node.style.display = "");
      return;
    }
    const lowerTerm = term.toLowerCase();
    allNodes.forEach(node => {
      const nodeText = node.textContent.toLowerCase();
      if (nodeText.includes(lowerTerm)) {
        node.style.display = "";
        // Expand ancestors so that matching node is visible.
        let ancestor = node.parentElement.closest(".tree-node");
        while (ancestor) {
          ancestor.style.display = "";
          const childList = ancestor.querySelector(".child-list");
          if (childList) {
            childList.classList.add("expanded");
            const toggleBtn = ancestor.querySelector(".toggle-btn");
            if (toggleBtn) toggleBtn.textContent = "expand_more";
          }
          ancestor = ancestor.parentElement.closest(".tree-node");
        }
      } else {
        node.style.display = "none";
      }
    });
  }
  searchBtn.addEventListener("click", () => {
    applySearchFilter(searchInput.value.trim());
  });
  searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      applySearchFilter(searchInput.value.trim());
    }, 300);
  });
  filterResetBtn.addEventListener("click", () => {
    searchInput.value = "";
    applySearchFilter("");
  });

  // -------------------------------
  // 5) EXPAND / COLLAPSE ALL
  // -------------------------------
  expandAllBtn.addEventListener("click", () => {
    document.querySelectorAll(".child-list").forEach(ul => ul.classList.add("expanded"));
    document.querySelectorAll(".toggle-btn").forEach(icon => {
      if (icon.textContent === "folder" || icon.textContent === "folder_open") {
        icon.textContent = "folder_open";
      } else {
        icon.textContent = "expand_more";
      }
    });
  });
  collapseAllBtn.addEventListener("click", () => {
    document.querySelectorAll(".child-list").forEach(ul => ul.classList.remove("expanded"));
    document.querySelectorAll(".toggle-btn").forEach(icon => {
      if (icon.textContent === "folder" || icon.textContent === "folder_open") {
        icon.textContent = "folder";
      } else {
        icon.textContent = "chevron_right";
      }
    });
  });

  // -------------------------------
  // 6) TOGGLE RAW JSON
  // -------------------------------
  showMoreJsonBtn.addEventListener("click", () => {
    if (!currentRule) return;
    if (rawJsonBlock.style.display === "none" || !rawJsonBlock.style.display) {
      rawJsonBlock.style.display = "block";
      showMoreJsonBtn.textContent = "HIDE RAW JSON";
    } else {
      rawJsonBlock.style.display = "none";
      showMoreJsonBtn.textContent = "SHOW RAW JSON";
    }
  });

  // -------------------------------
  // 7) LOAD HIERARCHY (FETCH)
  // -------------------------------
  async function loadHierarchy() {
    outlineEl.innerHTML = "<li>Loading...</li>";
    spinner.style.display = "block";
    try {
      const url = `/api/hierarchy/${encodeURIComponent(rootName)}/${encodeURIComponent(diagramName)}`;
      const res = await fetch(url);
      const text = await res.text();
      console.log("🔍 API Response:", text);

      if (!res.ok) {
        outlineEl.innerHTML = `<li style="color:red;">Error: ${res.status} ${text}</li>`;
        throw new Error(`API Error ${res.status}: ${text}`);
      }
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error("Invalid JSON response from server");
      }
      if (data.error) {
        outlineEl.innerHTML = `<li style="color:red;">Error: ${data.error}</li>`;
        return;
      }
      hierarchyData = data;
      renderHierarchy(hierarchyData);
    } catch (err) {
      console.error("❌ Error loading hierarchy:", err);
      outlineEl.innerHTML = `<li style="color:red;">Failed to load hierarchy. Check console.</li>`;
      M.toast({ html: `Error: ${err.message}`, classes: "red darken-1" });
    } finally {
      spinner.style.display = "none";
    }
  }

  loadHierarchy();
});
