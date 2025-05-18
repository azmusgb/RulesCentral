document.addEventListener('DOMContentLoaded', () => {
    M.AutoInit();
    setTimeout(() => {
        document.querySelector('.animated-content')?.classList.add('show');
    }, 100);

    const apiForm = document.getElementById('apiForm');
    const resultSection = document.getElementById('result-section');
    const resultMessage = document.getElementById('result-message');
    const spinner = document.getElementById('spinner');
    const copyButton = document.getElementById('copyButton');

    // Simple JSON validation helper
    function isValidJSON(str) {
        try {
            JSON.parse(str);
            return true;
        } catch (e) {
            return false;
        }
    }

    // Handle API form submission using async/await
    apiForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const endpoint = document.getElementById('endpoint').value.trim();
        const body = document.getElementById('body').value.trim();

        if (!endpoint) {
            M.toast({ html: 'Endpoint cannot be empty.', classes: 'red' });
            return;
        }
        if (!body) {
            M.toast({ html: 'Body cannot be empty.', classes: 'red' });
            return;
        }
        if (!isValidJSON(body)) {
            M.toast({ html: 'Invalid JSON format in body.', classes: 'red' });
            return;
        }

        // Display spinner and clear previous result
        spinner.style.display = 'block';
        resultMessage.textContent = 'Processing...';
        resultSection.classList.remove('hide', 'green', 'red');
        resultSection.classList.add('teal', 'lighten-4');

        const submitButton = apiForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.classList.add('disabled');

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            resultMessage.textContent = JSON.stringify(data, null, 2);
            resultSection.classList.remove('teal', 'lighten-4');
            resultSection.classList.add('green', 'lighten-4');
            M.toast({ html: 'Request successful!', classes: 'green' });
        } catch (error) {
            resultMessage.textContent = `Error: ${error.message}`;
            resultSection.classList.remove('teal', 'lighten-4');
            resultSection.classList.add('red', 'lighten-4');
            M.toast({ html: 'Request failed!', classes: 'red' });
        } finally {
            submitButton.disabled = false;
            submitButton.classList.remove('disabled');
            spinner.style.display = 'none';
        }
    });

    // Copy-to-clipboard functionality for the response
    copyButton.addEventListener('click', () => {
        const text = resultMessage.textContent;
        navigator.clipboard.writeText(text)
            .then(() => M.toast({ html: 'Response copied to clipboard!', classes: 'green' }))
            .catch(err => M.toast({ html: 'Failed to copy response.', classes: 'red' }));
    });
});