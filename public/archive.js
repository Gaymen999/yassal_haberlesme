document.addEventListener('DOMContentLoaded', () => {
    const archiveContainer = document.getElementById('archive-posts-container');
    
    // Arşiv duyurularını API'den çeken fonksiyon
    const fetchArchivePosts = async () => {
        try {
            // Yeni oluşturduğumuz /api/archive-posts rotasına istek at
            const response = await fetch('/api/archive-posts');
            
            if (!response.ok) {
                throw new Error('Arşiv yüklenirken bir hata oluştu: ' + response.statusText);
            }

            const posts = await response.json(); 
            archiveContainer.innerHTML = ''; 

            if (posts.length === 0) {
                archiveContainer.innerHTML = '<p>Arşivde henüz yayınlanmış duyuru bulunmamaktadır.</p>';
                return;
            }

            // Her bir arşiv içeriği için HTML oluştur
            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.classList.add('archive-post-card'); 

                // Tarihi daha okunaklı hale getir
                const date = new Date(post.created_at).toLocaleDateString('tr-TR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });

                // YENİ: XSS Koruması için DOMPurify kullan
                const safeTitle = DOMPurify.sanitize(post.title);
                const safeContent = DOMPurify.sanitize(post.content);
                const safeAuthorEmail = DOMPurify.sanitize(post.author_email);

                postElement.innerHTML = `
                    <div class="post-header">
                        <h3>${safeTitle}</h3>
                        <span class="category-tag">${post.category}</span>
                    </div>
                    <p class="post-meta">Yayınlayan: ${safeAuthorEmail} (${date})</p>
                    <div class="post-content">
                        ${safeContent}
                    </div>
                `;
                archiveContainer.appendChild(postElement);
            });

        } catch (error) {
            console.error(error);
            archiveContainer.innerHTML = `<p style="color: red;">Arşiv yüklenirken hata oluştu. Lütfen daha sonra tekrar deneyin.</p>`;
        }
    };

    fetchArchivePosts(); 
});