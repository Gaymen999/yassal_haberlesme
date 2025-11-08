// public/category.js (YENİ HALİ - Animasyon 1 Eklendi)

document.addEventListener('DOMContentLoaded', () => {
    const postsContainer = document.getElementById('posts-container');
    const categoryTitleElement = document.getElementById('category-title');

    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug'); // URL'den ?slug=... değerini al

    // --- YENİ: KAYDIRMA ANİMASYONU İÇİN OBSERVER ---
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.remove('hidden');
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Animasyon 1 kez çalışsın
            }
        });
    }, { threshold: 0.1 }); 

    const observeNewPosts = () => {
        postsContainer.querySelectorAll('.post-card.hidden').forEach(card => {
            observer.observe(card);
        });
    };
    // ------------------------------------------------
    
    if (!slug) {
        categoryTitleElement.textContent = 'Kategori Bulunamadı';
        postsContainer.innerHTML = '<p>Geçerli bir kategori seçmediniz. <a href="index.html">Ana sayfaya dönmek için tıklayın</a>.</p>';
        return;
    }

    const fetchCategoryPosts = async () => {
        try {
            const response = await fetch(`/api/categories/${slug}`, { credentials: 'include' });
            
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
                categoryTitleElement.textContent = posts.length > 0 ? DOMPurify.sanitize(posts[0].category_name) : 'Kategori';
                postsContainer.innerHTML = `<p>Bu kategoriye ait konu bulunamadı.</p>`;
                return;
            }
            
            categoryTitleElement.textContent = DOMPurify.sanitize(posts[0].category_name);
            postsContainer.innerHTML = ''; // Önceki yükleniyor mesajını sil

            posts.forEach(post => {
                const postElement = document.createElement('div');
                // post-card sınıfının yanına "hidden" sınıfını ekle
                postElement.classList.add('post-card', 'hidden'); 
                
                if (post.is_pinned) {
                    postElement.classList.add('pinned');
                }

                const date = new Date(post.created_at).toLocaleDateString('tr-TR', {
                    year: 'numeric', month: 'long', day: 'numeric'
                });
                
                const safeTitle = DOMPurify.sanitize(post.title);
                const safeAuthorUsername = DOMPurify.sanitize(post.author_username); 
                
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
            
            // YENİ: Postları DOM'a ekledikten sonra gözlemlemeye başla
            observeNewPosts(); 

        } catch (error) {
            console.error(error);
            categoryTitleElement.textContent = 'Hata';
            postsContainer.innerHTML = `<p style="color: red;">Konular yüklenirken hata oluştu.</p>`;
        }
    };

    fetchCategoryPosts();
});