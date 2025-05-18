document.addEventListener("DOMContentLoaded", () => {
  let configData = {};

  // Show loading spinner while fetching config
  const spinner = document.getElementById("config-spinner");
  spinner.style.display = "block";

  // ================== LOAD CONFIG ==================
  async function loadConfig() {
    try {
      const response = await fetch("/config/config.json");
      if (!response.ok) throw new Error("Failed to load config.json");
      configData = await response.json();
      console.log("✅ Config loaded:", configData);
      populateTranslations();
      populateNodeAttributes();
      populateAttributes();
      populateRuleAttributes();
    } catch (error) {
      console.error("Error loading config:", error);
      M.toast({ html: "Error loading config.json", classes: "red" });
    } finally {
      spinner.style.display = "none";
    }
  }

  // ================== UPDATE CONFIG (POST) ==================
  async function updateConfig() {
    try {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configData)
      });
      if (!response.ok) throw new Error("Failed to update config");
      M.toast({ html: "Configuration updated successfully!", classes: "green" });
    } catch (error) {
      console.error("Error updating config:", error);
      M.toast({ html: "Error updating config", classes: "red" });
    }
  }

  // ================== TRANSLATIONS ==================
  function populateTranslations() {
    const translationsBody = document.getElementById("translations-body");
    translationsBody.innerHTML = "";
    const translations = configData.translations || {};
    Object.entries(translations).forEach(([key, value]) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${key}</td>
        <td><input type="text" class="translation-value" data-key="${key}" value="${value}"></td>
        <td class="center-align">
          <button class="btn-small red waves-effect waves-light delete-btn" data-key="${key}">
            <i class="material-icons">delete</i>
          </button>
        </td>
      `;
      translationsBody.appendChild(row);
    });

    // Confirm deletion before removing a translation
    document.querySelectorAll(".delete-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        if (confirm("Are you sure you want to delete this translation?")) {
          delete configData.translations[btn.dataset.key];
          populateTranslations();
        }
      });
    });

    // Update config only when Save All Changes is pressed
  }

  // ================== NODE & DISPLAYED ATTRIBUTES ==================
  function populateList(elementId, items, configKey) {
    const list = document.getElementById(elementId);
    list.innerHTML = "";
    items.forEach(attr => {
      const li = document.createElement("li");
      li.className = "collection-item";
      li.textContent = attr;
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn-small red waves-effect waves-light right";
      deleteBtn.innerHTML = `<i class="material-icons">delete</i>`;
      deleteBtn.addEventListener("click", () => {
        if (confirm("Delete this attribute?")) {
          configData[configKey] = configData[configKey].filter(a => a !== attr);
          populateList(elementId, configData[configKey], configKey);
        }
      });
      li.appendChild(deleteBtn);
      list.appendChild(li);
    });
  }

  function populateNodeAttributes() {
    populateList("node-attribute-list", configData.nodeDisplayAttributes || [], "nodeDisplayAttributes");
  }

  function populateAttributes() {
    populateList("attribute-list", configData.displayed_attributes || [], "displayed_attributes");
  }

  // ================== RULE ATTRIBUTES (OBJECT) ==================
  function populateRuleAttributes() {
    const ruleAttributeList = document.getElementById("rule-attribute-list");
    ruleAttributeList.innerHTML = "";
    const ruleAttributes = configData.ruleAttributes || {};
    Object.entries(ruleAttributes).forEach(([key, value]) => {
      const li = document.createElement("li");
      li.className = "collection-item";
      li.innerHTML = `
        <strong>${key}</strong>: <span>${value}</span>
        <button class="btn-small red waves-effect waves-light right delete-rule-attribute" data-key="${key}">
          <i class="material-icons">delete</i>
        </button>
      `;
      ruleAttributeList.appendChild(li);
    });
    document.querySelectorAll(".delete-rule-attribute").forEach(btn => {
      btn.addEventListener("click", () => {
        if (confirm("Delete this rule attribute?")) {
          delete configData.ruleAttributes[btn.dataset.key];
          populateRuleAttributes();
        }
      });
    });
  }

  // ================== EVENT HANDLERS ==================
  document.getElementById("add-translation").addEventListener("click", () => {
    const key = document.getElementById("new-translation-key").value.trim();
    const value = document.getElementById("new-translation-value").value.trim();
    if (key && value) {
      configData.translations = configData.translations || {};
      configData.translations[key] = value;
      populateTranslations();
      document.getElementById("new-translation-key").value = '';
      document.getElementById("new-translation-value").value = '';
    }
  });

  document.getElementById("add-node-attribute").addEventListener("click", () => {
    const newAttr = document.getElementById("new-node-attribute").value.trim();
    if (newAttr) {
      configData.nodeDisplayAttributes = configData.nodeDisplayAttributes || [];
      configData.nodeDisplayAttributes.push(newAttr);
      populateNodeAttributes();
      document.getElementById("new-node-attribute").value = '';
    }
  });

  document.getElementById("add-attribute").addEventListener("click", () => {
    const newAttr = document.getElementById("new-attribute").value.trim();
    if (newAttr) {
      configData.displayed_attributes = configData.displayed_attributes || [];
      configData.displayed_attributes.push(newAttr);
      populateAttributes();
      document.getElementById("new-attribute").value = '';
    }
  });

  document.getElementById("add-rule-attribute").addEventListener("click", () => {
    const key = document.getElementById("new-rule-attribute-key").value.trim();
    const value = document.getElementById("new-rule-attribute-value").value.trim();
    if (key && value) {
      configData.ruleAttributes = configData.ruleAttributes || {};
      configData.ruleAttributes[key] = value;
      populateRuleAttributes();
      document.getElementById("new-rule-attribute-key").value = '';
      document.getElementById("new-rule-attribute-value").value = '';
    }
  });

  // Save button will update the config on the server
  document.getElementById("save-button").addEventListener("click", updateConfig);

  // ================== INITIAL LOAD ==================
  loadConfig();
});