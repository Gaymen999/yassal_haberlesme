document.addEventListener('DOMContentLoaded', async () => { 
    const postsContainer = document.getElementById('posts-container');
    const newPostButtonContainer = document.getElementById('new-post-button-container');

    let isAdmin = false;
    let isLoggedIn = false; 

    // --- 1. KULLANICI DURUMUNU KONTROL ET ---
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

    // --- 2. FONKSİYON TANIMLAMALARI ---
    
    // (renderNewPostButton fonksiyonu aynı kaldı)
    const renderNewPostButton = () => {
        if (isLoggedIn) {
            newPostButtonContainer.innerHTML = `<a href="submit.html" class="new-post-btn">Yeni Konu Aç</a>`;
        } else {
             newPostButtonContainer.innerHTML = `<p class="login-prompt">Konu açmak için lütfen <a href="login.html">giriş yapın</a>.</p>`;
        }
    };
    
    // Konuları Çek
    const fetchPosts = async () => {
        try {
            const response = await fetch('/api/posts', { credentials: 'include' });
            if (!response.ok) throw new Error('Konular yüklenirken bir hata oluştu: ' + response.statusText);

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
                
                // DEĞİŞTİ: Kategori linki oluşturuyoruz
                const categoryName = post.category_name || 'Kategorisiz';
                const categorySlug = post.category_slug; // Slug'ı al
                const safeTitle = DOMPurify.sanitize(post.title);
                const safeAuthorUsername = DOMPurify.sanitize(post.author_username); 
                const safeCategoryName = DOMPurify.sanitize(categoryName);
                
                // Kategori linkini oluştur
                const categoryLink = categorySlug 
                    ? `<a href="category.html?slug=${categorySlug}" class="category-tag">${safeCategoryName}</a>`
                    : `<span class="category-tag">${safeCategoryName}</span>`; // Slug yoksa link yapma

                
                // (Admin pin butonu kodu aynı kaldı)
                let adminPinButton = '';
                if (isAdmin) {
                    const pinButtonText = post.is_pinned ? 'Sabitlemeyi Kaldır' : 'Konuyu Sabitle';
                    adminPinButton = `
                        <button class="admin-pin-btn" data-id="${post.id}" data-is-pinned="${post.is_pinned}">
                            ${pinButtonText}
                        </button>
                    `;
                }

                postElement.innerHTML = `
                    <div class="post-header">
                        <h3><a href="/thread.html?id=${post.id}">${safeTitle}</a></h3>
                        
                        ${categoryLink} 
                        
                        ${post.is_pinned ? '<span class="pinned-badge">⭐ SABİTLENMİŞ</span>' : ''}
                    </div>
                    
                    <div class="post-footer">
                         <p class="post-meta">Yayınlayan: ${safeAuthorUsername} (${date})</p>
                         <div class="post-stats">
                            <span>Cevap: ${post.reply_count || 0}</span>
                            <span>Beğeni: ${post.like_count || 0}</span>
                         </div>
                    </div>
                    
                    <div class="admin-card-controls">
                        ${adminPinButton}
                    </div>
                `;
                postsContainer.appendChild(postElement);
            });

        } catch (error) {
            console.error(error);
            postsContainer.innerHTML = `<p style="color: red;">Konular yüklenirken hata oluştu. Lütfen daha sonra tekrar deneyin.</p>`;
        }
    };
    
    // (handleAdminActions fonksiyonu aynı kaldı)
    const handleAdminActions = async (e) => {
        if (!e.target.classList.contains('admin-pin-btn')) return;
        if (!isAdmin) return; 
        const btn = e.target;
        const postId = btn.dataset.id;
        const isCurrentlyPinned = btn.dataset.isPinned === 'true';
        const actionText = isCurrentlyPinned ? 'sabitlemesini kaldırmak' : 'sabitlemek';
        if (!confirm(`Bu konuyu ${actionText} istediğinize emin misiniz?`)) return;
        try {
            const response = await fetch(`/admin/posts/${postId}/pin`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_pinned: !isCurrentlyPinned }),
                credentials: 'include'
            });
            if (response.ok) {
                alert(`Konu başarıyla ${isCurrentlyPinned ? 'sabitlendi' : 'sabitlemesi kaldırıldı'}.`);
                fetchPosts(); 
            } else {
                const data = await response.json();
                alert(`İşlem başarısız: ${data.message || 'Sunucu hatası.'}`);
            }
        } catch (error) {
            console.error('Sabitleme hatası:', error);
            alert('Sunucuya bağlanılamadı.');
        }
    };

    // --- 3. KODU ÇALIŞTIRMA ---
    fetchPosts();
    postsContainer.addEventListener('click', handleAdminActions);
});