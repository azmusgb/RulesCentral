document.addEventListener('DOMContentLoaded', function () {
    // Initialization code for your application
    const elems = document.querySelectorAll('.tooltipped');
    M.Tooltip.init(elems, {});

    // Handling form submission
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', function (event) {
            const fileInput = document.getElementById('fileInput');
            const errorMessage = document.getElementById('errorMessage');
            if (fileInput.files.length === 0) {
                errorMessage.innerText = 'Please select a file to upload.';
                event.preventDefault();
            } else {
                errorMessage.innerText = ''; // Clear any previous error messages
            }
        });
    }

    // Loading diagrams if the function is defined
    if (typeof loadDiagrams === 'function') {
        const rootName = document.body.getAttribute('data-root-name');
        if (rootName) {
            loadDiagrams(rootName);
        }
    }
});
