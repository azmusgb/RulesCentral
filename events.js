document.addEventListener('DOMContentLoaded', () => {
    const toggleSidebarButton = document.getElementById("toggleSidebar");
    const sidebar = document.getElementById("sidebar");
    const darkModeToggle = document.getElementById("darkModeToggle");

    // Toggle sidebar visibility
    if (toggleSidebarButton && sidebar) {
        toggleSidebarButton.addEventListener("click", () => {
            sidebar.classList.toggle("d-none");
            toggleSidebarButton.setAttribute('aria-expanded', sidebar.classList.contains("d-none") ? "false" : "true");
        });
        toggleSidebarButton.setAttribute('aria-expanded', 'false');
        toggleSidebarButton.setAttribute('aria-controls', 'sidebar');
    }

    // Dark mode toggle functionality
    if (darkModeToggle) {
        darkModeToggle.addEventListener("click", () => {
            document.body.classList.toggle("dark-mode-body");
            darkModeToggle.setAttribute('aria-pressed', document.body.classList.contains("dark-mode-body") ? "true" : "false");
        });
        darkModeToggle.setAttribute('aria-pressed', 'false');
    }

    // Improved search functionality with debounce
    const searchBar = document.getElementById("searchBar");
    if (searchBar) {
        let debounceTimeout;
        searchBar.addEventListener("input", () => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                const filter = searchBar.value.toLowerCase();
                const navLinksContainer = document.getElementById("navLinks");
                if (navLinksContainer) {
                    const links = navLinksContainer.getElementsByTagName("a");
                    for (let i = 0; i < links.length; i++) {
                        const txtValue = links[i].textContent || links[i].innerText;
                        links[i].style.display = txtValue.toLowerCase().indexOf(filter) > -1 ? "" : "none";
                    }
                }
            }, 300);
        });
    }
});
