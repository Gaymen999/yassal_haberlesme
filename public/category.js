document.addEventListener('DOMContentLoaded', () => {
    const postsContainer = document.getElementById('posts-container');
    const categoryTitleElement = document.getElementById('category-title');

    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug'); // URL'den ?slug=... değerini al

    if (!slug) {
        categoryTitleElement.textContent = 'Kategori Bulunamadı';
        postsContainer.innerHTML = '<p>Geçerli bir kategori seçmediniz. <a href="index.html">Ana sayfaya dönmek için tıklayın</a>.</p>';
        return;
    }

    const fetchCategoryPosts = async () => {
        try {
            // Backend'deki /api/categories/:slug rotasını çağır
            const response = await fetch(`/api/categories/${slug}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    categoryTitleElement.textContent = 'Kategori Bulunamadı';
                    postsContainer.innerHTML = `<p>Bu kategoriye ait konu bulunamadı.</p>`;
                } else {
                    throw new Error('Konular yüklenemedi.');
                }
                return;
            }

            const posts = await response.json();
            
            if (posts.length === 0) {
                categoryTitleElement.textContent = 'Kategori Bulunamadı';
                postsContainer.innerHTML = `<p>Bu kategoriye ait konu bulunamadı.</p>`;
                return;
            }

            // Kategori başlığını ilk posttan al
            const categoryName = posts[0].category_name;
            categoryTitleElement.textContent = `${DOMPurify.sanitize(categoryName)} Kategorisindeki Konular`;

            postsContainer.innerHTML = ''; 

            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.classList.add('post-card'); 
                if (post.is_pinned) postElement.classList.add('pinned');

                const date = new Date(post.created_at).toLocaleDateString('tr-TR', {
                    year: 'numeric', month: 'long', day: 'numeric'
                });
                
                const safeTitle = DOMPurify.sanitize(post.title);
                const safeAuthorUsername = DOMPurify.sanitize(post.author_username); 
                
                // Not: Bu API rotası (routes/postRoutes.js -> /api/categories/:slug)
                // cevap (reply_count) veya beğeni (like_count) sayılarını getirmiyor.
                // Bu yüzden kartlar ana sayfadakinden biraz daha sade görünecek.
                
                postElement.innerHTML = `
                    <div class="post-header">
                        <h3><a href="/thread.html?id=${post.id}">${safeTitle}</a></h3>
                        ${post.is_pinned ? '<span class="pinned-badge">⭐ SABİTLENMİŞ</span>' : ''}
                    </div>
                    <div class="post-footer">
                         <p class="post-meta">Yayınlayan: ${safeAuthorUsername} (${date})</p>
                    </div>
                `;
                postsContainer.appendChild(postElement);
            });

        } catch (error) {
            console.error(error);
            categoryTitleElement.textContent = 'Hata';
            postsContainer.innerHTML = `<p style="color: red;">Konular yüklenirken hata oluştu.</p>`;
        }
    };

    fetchCategoryPosts();
});