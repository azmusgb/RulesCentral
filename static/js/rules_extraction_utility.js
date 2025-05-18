document.addEventListener('DOMContentLoaded', () => {
  // Auto initialize Materialize components
  M.AutoInit();
  // Animate content after short delay
  setTimeout(() => {
    document.querySelector('.animated-content')?.classList.add('show');
  }, 100);

  const executeButton = document.getElementById('executeButton');
  const executionMessage = document.getElementById('execution-message');
  const outputMessage = document.getElementById('output-message');
  const spinner = document.getElementById('spinner');

  executeButton.addEventListener('click', async () => {
    executionMessage.textContent = 'Processing...';
    outputMessage.classList.add('hide');
    executeButton.disabled = true;
    executeButton.classList.add('disabled');
    spinner.style.display = 'block';

    try {
      const response = await fetch('{{ url_for("routes.execute_file") }}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      executionMessage.textContent = 'Execution Success';
      outputMessage.textContent = JSON.stringify(data, null, 2);
      outputMessage.classList.remove('hide');
      M.toast({ html: 'Rules extracted successfully!', classes: 'green' });
    } catch (error) {
      console.error('Error during execution:', error);
      executionMessage.textContent = 'Execution Failed';
      M.toast({ html: 'Error extracting rules. Please try again.', classes: 'red' });
    } finally {
      executeButton.disabled = false;
      executeButton.classList.remove('disabled');
      spinner.style.display = 'none';
    }
  });
});