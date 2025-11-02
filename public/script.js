// public/script.js
document.addEventListener('DOMContentLoaded', async () => { 
    const postsContainer = document.getElementById('posts-container');
    // YENİ: Yeni buton konteynerini seç
    const newPostButtonContainer = document.getElementById('new-post-button-container');
    
    let isAdmin = false;
    let isLoggedIn = false; // YENİ: Giriş durumunu tut

    // Kullanıcı durumunu kontrol et (Admin mi? Giriş yapmış mı?)
    try {
        const response = await fetch('/api/user-status', {
            credentials: 'include' 
        });
        const data = await response.json();
        
        if (data.loggedIn) {
            isLoggedIn = true; // YENİ
            if (data.user.role === 'admin') {
                isAdmin = true;
            }
        }
        
        // YENİ: Giriş durumuna göre "Yeni Konu Aç" butonunu render et
        renderNewPostButton();

    } catch (error) {
        console.warn('Kullanıcı durumu kontrol edilemedi.');
        // Giriş yapmamış gibi devam et
        renderNewPostButton();
    }
    
    // --- YENİ: "Yeni Konu Aç" Butonunu Render Etme Fonksiyonu ---
    const renderNewPostButton = () => {
        if (isLoggedIn) {
            newPostButtonContainer.innerHTML = `
                <a href="submit.html" class="new-post-btn">Yeni Konu Aç</a>
            `;
        } else {
            // Giriş yapmamışsa bir şey gösterme veya mesaj göster
             newPostButtonContainer.innerHTML = `
                <p class="login-prompt">Konu açmak için lütfen <a href="login.html">giriş yapın</a>.</p>
            `;
        }
    };

    // --- Moderasyon Fonksiyonları (Aynı kaldı) ---
    const updatePostPinStatus = async (postId, isCurrentlyPinned) => {
        if (!isAdmin) return alert('Yetkisiz işlem!');
        const actionText = isCurrentlyPinned ? 'Sabitlemeyi Kaldır' : 'Sabitle';
        if (!confirm(`Bu konuyu ${actionText}mak istediğinize emin misiniz?`)) return;
        
        try {
            const response = await fetch(`/admin/posts/${postId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_pinned: !isCurrentlyPinned }),
                credentials: 'include' 
            });

            if (response.ok) {
                alert(`Konu başarıyla ${isCurrentlyPinned ? 'Sabitlemesi Kaldırıldı' : 'Sabitlendi'}!`);
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
    
    // --- Konuları Çeken Ana Fonksiyon ---
    const fetchPosts = async () => {
        try {
            // TODO: Bu API rotasını da (/api/posts) sayfalama için güncellememiz gerekecek.
            // Şimdilik aynı bırakıyorum.
            const response = await fetch('/api/posts', { credentials: 'include' });
            if (!response.ok) throw new Error('Konular yüklenirken bir hata oluştu: ' + response.statusText);

            const posts = await response.json();
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
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                
                const pinButtonText = post.is_pinned ? 'Sabitlemeyi Kaldır' : 'Sabitle';
                
                const adminControls = isAdmin ? `
                    <div class="admin-actions">
                        <button class="pin-toggle-btn" 
                                data-id="${post.id}" 
                                data-pinned="${post.is_pinned}"
                                style="background-color: #2196F3; color: white;">
                                ${pinButtonText}
                        </button>
                    </div>
                ` : '';

                const safeTitle = DOMPurify.sanitize(post.title);
                const safeAuthorUsername = DOMPurify.sanitize(post.author_username); 
                const safeCategoryName = DOMPurify.sanitize(post.category_name);

                // DEĞİŞTİ: Ana sayfadan post.content'i kaldırdım,
                // sadece başlık, yazar ve kategori (Technopat gibi)
                postElement.innerHTML = `
                    <div class="post-header">
                        <h3><a href="/thread.html?id=${post.id}">${safeTitle}</a></h3>
                        <span class="category-tag">${safeCategoryName}</span>
                        ${post.is_pinned ? '<span class="pinned-badge">⭐ SABİTLENMİŞ</span>' : ''}
                        ${adminControls} 
                    </div>
                    
                    <p class="post-meta">Yayınlayan: ${safeAuthorUsername} (${date})</p>
                `;
                postsContainer.appendChild(postElement);
            });
            
            // Olay dinleyicileri (Aynı kaldı)
            if (isAdmin) {
                postsContainer.querySelectorAll('.pin-toggle-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const postId = btn.dataset.id;
                        const isPinned = btn.dataset.pinned === 'true'; 
                        updatePostPinStatus(postId, isPinned);
                    });
                });
            }

        } catch (error) {
            console.error(error);
            postsContainer.innerHTML = `<p style="color: red;">Konular yüklenirken hata oluştu. Lütfen daha sonra tekrar deneyin.</p>`;
        }
    };

    // fetchPosts'u, kullanıcı durumu kontrolü bittikten sonra çağır
    fetchPosts();
});