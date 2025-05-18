let debounceTimer;
$(document).ready(function() {
  // Attach event listeners for search
  $('#search-button').click(performSearch);
  $('#search-input').on('keyup', function(e) {
    // If Enter pressed, perform search immediately
    if (e.which === 13) {
      e.preventDefault();
      performSearch();
    } else {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(performSearch, 300);
    }
  });

  $('#clear-button').click(function() {
    $('#search-input').val('');
    $('#results').empty();
  });
});

function performSearch() {
  const query = $('#search-input').val().trim();
  if (!query) {
    M.toast({ html: 'Please enter a search query.' });
    return;
  }
  // Optionally, get additional parameters from URL
  const urlParams = new URLSearchParams(window.location.search);
  const rootName = urlParams.get('root_name') || '';
  const diagramName = urlParams.get('diagram') || '';

  $('#spinner').fadeIn();

  const searchParams = {
    q: query,
    root_name: rootName,
    diagram_name: diagramName
  };

  $.getJSON('/api/search_diagrams', searchParams, function(data) {
    $('#results').empty();

    if (data.length === 0) {
      $('#results').append('<div class="col s12"><p class="center-align">No results found for "' + query + '".</p></div>');
    } else {
      data.forEach(function(item) {
        // Ensure match_snippet is a string before processing
        const snippetText = item.match_snippet || "";
        const highlightedSnippet = highlightQuery(snippetText, query);
        const cardHtml = `
          <div class="col s12 m6">
            <div class="card result-card">
              <div class="card-content">
                <span class="card-title">
                  <i class="material-icons left">folder</i> ${item.catalog}
                </span>
                <p><strong>Filename:</strong> ${item.filename}</p>
                <p class="snippet">${highlightedSnippet}</p>
              </div>
              <div class="card-action">
                <a href="/view_diagram?root_name=${encodeURIComponent(item.catalog)}&diagramName=${encodeURIComponent(item.filename)}" class="btn-small">
                  <i class="material-icons left">visibility</i> View Diagram
                </a>
                <a href="/view_hierarchy?root_name=${encodeURIComponent(item.catalog)}&diagramName=${encodeURIComponent(item.filename)}" class="btn-small">
                  <i class="material-icons left">account_tree</i> View Hierarchy
                </a>
              </div>
            </div>
          </div>
        `;
        $('#results').append(cardHtml);
      });
    }
  })
  .fail(function() {
    M.toast({ html: 'Error during search. Please try again.' });
  })
  .always(function() {
    $('#spinner').fadeOut();
  });
}

function highlightQuery(text, query) {
  // Ensure text is a string, fallback to empty string if undefined or null
  text = text || "";
  if (!query) return text;
  // Escape special characters for regex
  const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return text.replace(regex, '<span class="highlight">$1</span>');
}