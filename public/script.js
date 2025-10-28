document.addEventListener('DOMContentLoaded', () => {
    const postsContainer = document.getElementById('posts-container');
    
    // Duyuruları API'den çeken fonksiyon
    const fetchPosts = async () => {
        try {
            // Sunucumuzdaki /api/posts rotasına istek at
            const response = await fetch('/api/posts');
            
            // Eğer HTTP hatası varsa (örn. 404, 500)
            if (!response.ok) {
                throw new Error('Duyurular yüklenirken bir hata oluştu: ' + response.statusText);
            }

            const posts = await response.json(); // Gelen JSON verisini çöz
            
            // Konteyneri temizle
            postsContainer.innerHTML = ''; 

            if (posts.length === 0) {
                postsContainer.innerHTML = '<p>Şu an yayınlanmış onaylı bir duyuru bulunmamaktadır.</p>';
                return;
            }

            // Her bir duyuru için HTML oluştur
            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.classList.add('post-card'); // CSS için bir class ekleyelim

                // Tarihi daha okunaklı hale getir
                const date = new Date(post.created_at).toLocaleDateString('tr-TR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });

                postElement.innerHTML = `
                    <h3>${post.title}</h3>
                    <p>Yayınlayan: ${post.author_email} (${date})</p>
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

    fetchPosts(); // Sayfa yüklendiğinde duyuruları çekmeye başla
});