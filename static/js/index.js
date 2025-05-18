// index.js

document.addEventListener('DOMContentLoaded', () => {
  console.log("JavaScript Loaded.");

  // -----------------------------
  // 1) Initialize Tooltips
  // -----------------------------
  const tooltips = document.querySelectorAll('.tooltipped');
  if (tooltips.length) {
    M.Tooltip.init(tooltips);
  }

  // -----------------------------
  // 2) File Upload Initialization
  // -----------------------------
  const uploadForm = document.getElementById('uploadForm');
  if (uploadForm) {
    const fileInput      = document.getElementById('fileInput');
    const errorMessage   = document.getElementById('errorMessage');
    const feedback       = document.getElementById('feedback');
    const feedbackMessage= document.getElementById('feedback-message');

    if (fileInput && errorMessage && feedback && feedbackMessage) {
      uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (fileInput.files.length === 0) {
          errorMessage.innerText = 'Please select a file to upload.';
          return;
        } else {
          errorMessage.innerText = ''; // Clear any previous error messages
        }

        // Create FormData from the form
        const formData = new FormData(uploadForm);

        // Show uploading feedback
        showFeedback('Uploading...', ['yellow', 'lighten-4']);

        try {
          const response = await fetch(uploadForm.action, {
            method: 'POST',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            body: formData,
          });
          const data = await response.json();

          if (data.success) {
            showFeedback('File uploaded successfully!', ['green']);
            if (data.redirect_url) {
              window.location.href = data.redirect_url;
            }
          } else {
            throw new Error(data.message || 'Upload failed.');
          }
        } catch (err) {
          showFeedback('Error: ' + err.message, ['red']);
        }
      });

      /**
       * Updates the feedback element with the provided message and color classes.
       * @param {string} message - The feedback message.
       * @param {Array<string>} colorClasses - Array of CSS classes (e.g., ['green']).
       */
      function showFeedback(message, colorClasses) {
        feedback.classList.remove('hide', 'green', 'red', 'yellow', 'lighten-4');
        feedback.classList.add(...colorClasses);
        feedbackMessage.textContent = message;
      }
    } else {
      console.info("Upload form present, but required child elements missing. Skipping upload init.");
    }
  } else {
    console.info("No upload form found. Skipping file upload initialization.");
  }

  // -----------------------------
  // 3) Initialize Sidenav
  // -----------------------------
  const sidenavElems = document.querySelectorAll('.sidenav');
  if (sidenavElems.length) {
    M.Sidenav.init(sidenavElems, { edge: 'left' });
  }

  // -----------------------------
  // 4) Passive Touchmove
  // -----------------------------
  document.addEventListener("touchmove", (e) => {
    // Custom code if needed
  }, { passive: true });

  // -----------------------------
  // 5) Animate Main Content
  // -----------------------------
  const animatedContent = document.querySelector('.animated-content');
  if (animatedContent) {
    setTimeout(() => {
      animatedContent.classList.add('show');
    }, 100);
  }
});
