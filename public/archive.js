document.addEventListener('DOMContentLoaded', () => {
    const postsContainer = document.getElementById('archive-posts-container');
    const filterSelect = document.getElementById('archive-filter');
    
    // Hem filtreleme hem de listeleme yapan ana fonksiyon
    const fetchPosts = async (filterValue = null) => {
        postsContainer.innerHTML = '<p>Duyurular yükleniyor...</p>';
        
        try {
            // Şimdilik sadece tüm onaylanmış paylaşımları çekiyoruz.
            // İleride filtreleme için backend'i güncelleyebiliriz.
            const response = await fetch('/api/posts'); 
            
            if (!response.ok) {
                throw new Error('Arşiv yüklenirken bir hata oluştu.');
            }

            let posts = await response.json(); 
            
            // Eğer posts.length çok büyükse, burada performansı artırmak için sınırlandırma yaparız.
            // Örneğin, post.slice(0, 50) ile son 50 duyuruyu gösteririz.
            
            postsContainer.innerHTML = ''; 

            if (posts.length === 0) {
                postsContainer.innerHTML = '<p>Arşivde henüz bir duyuru bulunmamaktadır.</p>';
                return;
            }
            
            // Filtreleme yap
            if (filterValue) {
                // Şimdilik filtreleme yapmıyoruz. İleride tarih kontrolü buraya gelecek.
            }


            // Duyuruları ekrana yazdır
            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.classList.add('post-card'); 

                const date = new Date(post.created_at).toLocaleDateString('tr-TR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });

                postElement.innerHTML = `
                    <div class="post-header">
                        <h3>${post.title}</h3>
                        <span class="category-tag">${post.category}</span>
                    </div>
                    <p class="post-meta">Yayınlayan: ${post.author_email} (${date})</p>
                    <div class="post-content">
                        ${post.content.substring(0, 200)}... <a href="#">Devamını Oku</a>
                    </div>
                `;
                postsContainer.appendChild(postElement);
            });

        } catch (error) {
            console.error(error);
            postsContainer.innerHTML = `<p style="color: red;">Arşiv yüklenirken hata oluştu.</p>`;
        }
    };

    // Filtre değiştiğinde yeniden yükle
    filterSelect.addEventListener('change', (e) => {
        fetchPosts(e.target.value);
    });

    fetchPosts(); 
});