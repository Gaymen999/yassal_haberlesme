// public/script.js (YAZIM HATASI DÜZELTİLDİ)
document.addEventListener('DOMContentLoaded', async () => { 
    // DEĞİŞTİ: Artık 'posts-container'ı seçiyoruz
    const postsContainer = document.getElementById('posts-container');
    const newPostButtonContainer = document.getElementById('new-post-button-container');

    let isAdmin = false;
    let isLoggedIn = false; 

    // --- 1. FONKSİYON TANIMLAMALARI ---
    
    // "Yeni Konu Aç" butonunu render etme (Aynı kaldı)
    const renderNewPostButton = () => {
        if (isLoggedIn) {
            newPostButtonContainer.innerHTML = `<a href="submit.html" class="new-post-btn">Yeni Konu Aç</a>`;
        } else {
             newPostButtonContainer.innerHTML = `<p class="login-prompt">Konu açmak için lütfen <a href="login.html">giriş yapın</a>.</p>`;
        }
    };
    
    // DEĞİŞTİ: 'fetchPosts' (Konuları Çek)
    const fetchPosts = async () => {
        try {
            // DEĞİŞTİ: API rotası (artık ?page= yok)
            const response = await fetch('/api/posts', { credentials: 'include' });
            
            // DÜZELTME: Yazım hatası düzeltildi ('D + yerine ' +)
            if (!response.ok) throw new Error('Konular yüklenirken bir hata oluştu: ' + response.statusText);

            // DEĞİŞTİ: API artık { posts: [...] } döndürüyor
            const data = await response.json(); 
            const posts = data.posts;
            
            postsContainer.innerHTML = ''; 

            if (posts.length === 0) {
                postsContainer.innerHTML = '<p>Şu an yayınlanmış konu bulunmamaktadır.</p>';
                return;
            }

            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.classList.add('post-card'); 
                if (post.is_pinned) postElement.classList.add('pinned');

                const date = new Date(post.created_at).toLocaleDateString('tr-TR', {
                    year: 'numeric', month: 'long', day: 'numeric'
                });
                
                // Kategori adı NULL ise "Kategorisiz" yaz
                const categoryName = post.category_name || 'Kategorisiz';

                const safeTitle = DOMPurify.sanitize(post.title);
                const safeAuthorUsername = DOMPurify.sanitize(post.author_username); 
                const safeCategoryName = DOMPurify.sanitize(categoryName);

                // YENİ: Konu kartı HTML'i (Eskisi gibi)
                postElement.innerHTML = `
                    <div class="post-header">
                        <h3><a href="/thread.html?id=${post.id}">${safeTitle}</a></h3>
                        <span class="category-tag">${safeCategoryName}</span>
                        ${post.is_pinned ? '<span class="pinned-badge">⭐ SABİTLENMİŞ</span>' : ''}
                    </div>
                    
                    <div class="post-footer">
                         <p class="post-meta">Yayınlayan: ${safeAuthorUsername} (${date})</p>
                         <div class="post-stats">
                            <span>Cevap: ${post.reply_count || 0}</span>
                            <span>Beğeni: ${post.like_count || 0}</span>
                         </div>
                    </div>
                `;
                postsContainer.appendChild(postElement);
            });
            
            // Not: Admin pinleme butonu ana sayfadan kaldırıldı (şimdilik)
            // İstersen geri ekleyebiliriz.

        } catch (error) {
            console.error(error);
            postsContainer.innerHTML = `<p style="color: red;">Konular yüklenirken hata oluştu. Lütfen daha sonra tekrar deneyin.</p>`;
        }
    };
    
    // --- 2. KODU ÇALIŞTIRMA ---
    
    // Önce kullanıcı durumunu kontrol et
    try {
        const response = await fetch('/api/user-status', {
            credentials: 'include' 
        });
        const data = await response.json();
        
        if (data.loggedIn) {
            isLoggedIn = true; 
            if (data.user.role === 'admin') {
                isAdmin = true;
            }
        }
        renderNewPostButton();
    } catch (error) {
        console.warn('Kullanıcı durumu kontrol edilemedi.');
        renderNewPostButton();
    }

    // Konuları çek
    fetchPosts();
});