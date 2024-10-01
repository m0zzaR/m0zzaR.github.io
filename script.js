document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    const blogGrid = document.querySelector('.blog-grid');
    const blogPosts = Array.from(document.querySelectorAll('.blog-post'));

    // Function to filter and sort blog posts
    function updateBlogPosts() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const sortOrder = sortSelect.value;

        // Filter blog posts based on search term
        const filteredPosts = blogPosts.filter(post => {
            const title = post.querySelector('h2').textContent.toLowerCase();
            const description = post.querySelector('p').textContent.toLowerCase();
            const tags = post.getAttribute('data-tags') ? post.getAttribute('data-tags').toLowerCase() : '';

            // Check if search term is in title, description, or tags
            return title.includes(searchTerm) || description.includes(searchTerm) || tags.includes(searchTerm);
        });

        // Sort blog posts based on date
        filteredPosts.sort((a, b) => {
            const dateA = new Date(a.getAttribute('data-date'));
            const dateB = new Date(b.getAttribute('data-date'));
            return sortOrder === 'latest' ? dateB - dateA : dateA - dateB;
        });

        // Clear the blog grid
        blogGrid.innerHTML = '';

        // Append the filtered and sorted posts
        filteredPosts.forEach(post => {
            blogGrid.appendChild(post);
        });
    }

    // Initial display of blog posts
    updateBlogPosts();

    // Event listeners
    searchInput.addEventListener('input', updateBlogPosts);
    sortSelect.addEventListener('change', updateBlogPosts);
});
