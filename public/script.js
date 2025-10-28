document.addEventListener('DOMContentLoaded', () => {
    const postsContainer = document.getElementById('posts-container');
    
    const fetchPosts = async () => {
        try {
            const response = await fetch('/api/posts');
            if (!response.ok) {
                throw new Error('Duyurular yüklenirken bir hata oluştu: ' + response.statusText);
            }

            const posts = await response.json();
            postsContainer.innerHTML = ''; 

            if (posts.length === 0) {
                postsContainer.innerHTML = '<p>Şu an yayınlanmış onaylı bir duyuru bulunmamaktadır.</p>';
                return;
            }

            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.classList.add('post-card'); 
                
                // Eğer sabitlenmişse, özel bir class ekle
                if (post.is_pinned) {
                    postElement.classList.add('pinned');
                }

                const date = new Date(post.created_at).toLocaleDateString('tr-TR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                
                // Sabitlenme durumunu, kategoriyi ve içeriği göster
                postElement.innerHTML = `
                    <div class="post-header">
                        <h3>${post.title}</h3>
                        <span class="category-tag">${post.category}</span>
                        ${post.is_pinned ? '<span class="pinned-badge">⭐ SABİTLENMİŞ</span>' : ''}
                    </div>
                    <p class="post-meta">Yayınlayan: ${post.author_email} (${date})</p>
                    <div class="post-content">
                        ${post.content}
                    </div>
                `;
                postsContainer.appendChild(postElement);
            });

        } catch (error) {
            console.error(error);
            postsContainer.innerHTML = `<p style="color: red;">Duyurular yüklenirken hata oluştu. Lütfen daha sonra tekrar deneyin.</p>`;
        }
    };

    fetchPosts();
});