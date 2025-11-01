document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('posts-management-container');
    const loadingMessage = document.getElementById('loading-message');
    
    // --- Moderasyon İşlemleri (API Çağrıları) ---

    // Konu Sabitleme / Sabitlemeyi Kaldırma
    const updatePostPinStatus = async (postId, isCurrentlyPinned) => {
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
                fetchAllPosts(); // Listeyi yenile
            } else {
                const data = await response.json();
                alert(`İşlem başarısız: ${data.message || 'Sunucu hatası.'}`);
            }
        } catch (error) {
            console.error('Sabitleme hatası:', error);
            alert('Sunucuya bağlanılamadı.');
        }
    };
    
    // Konu Silme
    const deletePost = async (postId, postTitle) => {
        if (!confirm(`DİKKAT! "${postTitle}" başlıklı konuyu ve TÜM CEVAPLARINI kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
            return;
        }
        
        try {
            const response = await fetch(`/admin/posts/${postId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                alert('Konu ve tüm cevapları başarıyla silindi.');
                fetchAllPosts(); // Listeyi yenile
            } else {
                const data = await response.json();
                alert(`Silme işlemi başarısız: ${data.message || 'Sunucu hatası.'}`);
            }
        } catch (error) {
            console.error('Konu silme hatası:', error);
            alert('Sunucuya bağlanılamadı.');
        }
    };

    // --- Tüm Konuları Listeleme Fonksiyonu ---
    const fetchAllPosts = async () => {
        container.innerHTML = ''; 
        loadingMessage.style.display = 'block'; 

        try {
            // DEĞİŞTİ: '/admin/pending-posts' yerine '/api/posts' çağırılıyor
            const response = await fetch('/api/posts', {
                method: 'GET',
                credentials: 'include' // Admin yetkimizi cookie ile gönderiyoruz
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                     // Bu durumun /api/posts'ta olmaması lazım ama olursa diye
                     window.location.href = '/login.html';
                } else {
                     container.innerHTML = '<h3>Hata: Konuları çekerken sorun oluştu.</h3>';
                }
                loadingMessage.style.display = 'none';
                return;
            }

            const posts = await response.json();
            loadingMessage.style.display = 'none';

            if (posts.length === 0) {
                container.innerHTML = '<p>Yönetilecek hiç konu bulunamadı.</p>';
                return;
            }
            
            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.classList.add('post-card');
                if (post.is_pinned) postElement.classList.add('pinned');
                
                const date = new Date(post.created_at).toLocaleDateString('tr-TR');

                // YENİ: XSS Koruması eklendi
                const safeTitle = DOMPurify.sanitize(post.title);
                const safeAuthor = DOMPurify.sanitize(post.author_email);
                const safeCategory = DOMPurify.sanitize(post.category_name);

                const pinButtonText = post.is_pinned ? 'Sabitlemeyi Kaldır' : 'Sabitle';
                
                postElement.innerHTML = `
                    <div class="post-header">
                        <h4 class="pending-title">
                            <a href="/thread.html?id=${post.id}" target="_blank">${safeTitle} (ID: ${post.id})</a>
                        </h4>
                        <div class="actions">
                            <button class="pin-toggle-btn" 
                                data-id="${post.id}" 
                                data-pinned="${post.is_pinned}" 
                                style="background-color: #2196F3;">
                                ${pinButtonText}
                            </button>
                            <button class="delete-post-btn" 
                                data-id="${post.id}" 
                                data-title="${safeTitle}" 
                                style="background-color: darkred;">
                                KONUYU SİL
                            </button>
                        </div>
                    </div>
                    <p class="post-meta">
                        Yazar: ${safeAuthor} | 
                        Tarih: ${date} | 
                        Kategori: <strong>${safeCategory}</strong>
                    </p>
                `;
                container.appendChild(postElement);
            });
            
            // Buton Olay Dinleyicileri Ekle
            container.querySelectorAll('.pin-toggle-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const postId = btn.dataset.id;
                    const isPinned = btn.dataset.pinned === 'true';
                    updatePostPinStatus(postId, isPinned);
                });
            });
            
            container.querySelectorAll('.delete-post-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const postId = btn.dataset.id;
                    const postTitle = btn.dataset.title;
                    deletePost(postId, postTitle);
                });
            });

        } catch (error) {
            console.error('Yükleme hatası:', error);
            loadingMessage.style.display = 'none';
            container.innerHTML = '<p style="color: red;">Sunucuya bağlanırken bir sorun oluştu.</p>';
        }
    };

    fetchAllPosts();
});