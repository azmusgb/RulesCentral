document.addEventListener("DOMContentLoaded", function () {
  const uploadForm = document.getElementById("uploadForm");
  const feedback = document.getElementById("feedback");
  const feedbackMessage = document.getElementById("feedback-message");
  const fileInput = document.getElementById("fileInput");
  const dropZone = document.getElementById("dropZone");
  const fileSummary = document.getElementById("fileSummary");
  const progressContainer = document.getElementById("progressContainer");
  const submitButton = uploadForm.querySelector('button[type="submit"]');

  // Trigger file input when drop zone is clicked
  dropZone.addEventListener("click", () => fileInput.click());

  // Handle drag & drop
  dropZone.addEventListener("dragover", function (e) {
    e.preventDefault();
    dropZone.classList.add("hover");
  });
  dropZone.addEventListener("dragleave", function (e) {
    e.preventDefault();
    dropZone.classList.remove("hover");
  });
  dropZone.addEventListener("drop", function (e) {
    e.preventDefault();
    dropZone.classList.remove("hover");
    fileInput.files = e.dataTransfer.files;
    updateFileSummary();
  });

  // Update file summary when files are selected
  fileInput.addEventListener("change", updateFileSummary);
  function updateFileSummary() {
    const files = fileInput.files;
    if (files.length === 0) {
      fileSummary.textContent = "No files selected.";
    } else if (files.length > 5) {
      fileSummary.textContent = files.length + " files selected.";
    } else {
      // If few files, list them
      let names = [];
      for (let file of files) {
        names.push(file.name);
      }
      fileSummary.textContent = names.join(", ");
    }
  }

  // Handle form submission
  uploadForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const files = fileInput.files;
    if (files.length === 0) {
      feedbackMessage.textContent = "Please select at least one JSON file.";
      feedback.classList.remove("hide", "green", "yellow");
      feedback.classList.add("red");
      return;
    }
    const formData = new FormData();
    for (let file of files) {
      formData.append("files", file);
    }
    feedback.classList.remove("hide", "green", "red");
    feedback.classList.add("yellow", "lighten-4");
    feedbackMessage.textContent = "Uploading...";
    submitButton.disabled = true;
    submitButton.classList.add("disabled");
    progressContainer.style.display = "block";

    fetch(uploadForm.action, {
      method: "POST",
      headers: { "X-Requested-With": "XMLHttpRequest" },
      body: formData
    })
    .then((response) => {
      if (!response.ok) {
        return response.text().then((text) => {
          throw new Error(text || `HTTP error! status: ${response.status}`);
        });
      }
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        feedback.classList.remove("yellow", "lighten-4");
        feedback.classList.add("green");
        feedbackMessage.textContent = "Files uploaded successfully!";
        if (data.redirect_url) {
          setTimeout(() => {
            window.location.href = data.redirect_url;
          }, 1200);
        } else {
          const fileName = fileInput.files[0].name;
          const rootName = fileName.replace(/\.[^/.]+$/, "");
          const diagramUrl = `/view_diagram?root_name=${rootName}&diagramName=${rootName}.mmd`;
          setTimeout(() => {
            window.location.href = diagramUrl;
          }, 1200);
        }
      } else {
        throw new Error(data.message || "Upload failed.");
      }
    })
    .catch((error) => {
      feedback.classList.remove("yellow", "lighten-4");
      feedback.classList.add("red");
      feedbackMessage.textContent = "Error: " + error.message;
    })
    .finally(() => {
      submitButton.disabled = false;
      submitButton.classList.remove("disabled");
      progressContainer.style.display = "none";
    });
  });
});