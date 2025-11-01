// public/script.js
document.addEventListener('DOMContentLoaded', async () => { 
    const postsContainer = document.getElementById('posts-container');
    let isAdmin = false;

    // Kullanıcı durumunu kontrol et (Admin mi?)
    try {
        const response = await fetch('/api/user-status', {
            credentials: 'include' 
        });
        const data = await response.json();
        if (data.loggedIn && data.user.role === 'admin') {
            isAdmin = true;
        }
    } catch (error) {
        console.warn('Kullanıcı durumu kontrol edilemedi.');
    }
    
    // --- Moderasyon Fonksiyonları (Aynı kaldı) ---
    const updatePostPinStatus = async (postId, isCurrentlyPinned) => {
        // ... (Bu fonksiyonun içi aynı)
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
                const safeContent = DOMPurify.sanitize(post.content);
                // DEĞİŞTİ: author_email yerine author_username
                const safeAuthorUsername = DOMPurify.sanitize(post.author_username); 
                const safeCategoryName = DOMPurify.sanitize(post.category_name);

                postElement.innerHTML = `
                    <div class="post-header">
                        <h3><a href="/thread.html?id=${post.id}">${safeTitle}</a></h3>
                        <span class="category-tag">${safeCategoryName}</span>
                        ${post.is_pinned ? '<span class="pinned-badge">⭐ SABİTLENMİŞ</span>' : ''}
                        ${adminControls} 
                    </div>
                    
                    <p class="post-meta">Yayınlayan: ${safeAuthorUsername} (${date})</p>
                    
                    <div class="post-content">
                        ${safeContent.substring(0, 200)}... 
                        <a href="/thread.html?id=${post.id}">Devamını Oku</a>
                    </div>
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

    fetchPosts();
});