// public/admin.js

document.addEventListener('DOMContentLoaded', async () => {
    // 1. HTML'deki elementleri seç
    const container = document.getElementById('posts-management-container');
    const loadingMessage = document.getElementById('loading-message');
    
    // --- 2. Moderasyon İşlemleri (API Çağrıları) ---

    // Konu Sabitleme / Sabitlemeyi Kaldırma
    const updatePostPinStatus = async (postId, isCurrentlyPinned) => {
        const actionText = isCurrentlyPinned ? 'Sabitlemeyi Kaldır' : 'Sabitle';
        if (!confirm(`Bu konuyu ${actionText}mak istediğinize emin misiniz?`)) return;
        
        try {
            // Bu rota doğru: /admin/posts/:id
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
        if (!confirm(`"${postTitle}" başlıklı konuyu SİLMEK istediğinize emin misiniz? Bu işlem geri alınamaz!`)) return;
        
        try {
            // Bu rota doğru: /admin/posts/:id
            const response = await fetch(`/admin/posts/${postId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            if (response.ok) {
                alert('Konu başarıyla silindi.');
                fetchAllPosts(); // Listeyi yenile
            } else {
                const data = await response.json();
                alert(`Silme işlemi başarısız: ${data.message || 'Sunucu hatası.'}`);
            }
        } catch (error) {
            console.error('Silme hatası:', error);
            alert('Sunucuya bağlanılamadı.');
        }
    };

    // --- 3. Veri Yükleme Fonksiyonu ---
    const fetchAllPosts = async () => {
        try {
            loadingMessage.style.display = 'block';
            container.innerHTML = ''; 

            // ***** DEĞİŞİKLİK BURADA *****
            // Hatalı/Eksik adres '/api/posts/archive' idi.
            // Doğru adres (Arşiv ve Arama için kullandığımız) '/api/archive' olacak.
            const response = await fetch('/api/archive', { credentials: 'include' });
            // ***** DEĞİŞİKLİK BİTTİ *****

            if (!response.ok) {
                throw new Error('Sunucudan konular çekilemedi.');
            }
            
            const posts = await response.json();
            loadingMessage.style.display = 'none';

            if (posts.length === 0) {
                container.innerHTML = '<p>Yönetilecek konu bulunamadı.</p>';
                return;
            }

            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.className = 'admin-post-card'; // CSS için class
                
                // XSS Koruması
                const safeTitle = DOMPurify.sanitize(post.title);
                const safeAuthor = DOMPurify.sanitize(post.author_username);
                const safeCategory = DOMPurify.sanitize(post.category_name);
                const date = new Date(post.created_at).toLocaleString('tr-TR');
                
                postElement.innerHTML = `
                    <div class="admin-post-header">
                        <a href="/thread.html?id=${post.id}" target="_blank">${safeTitle}</a>
                        <div class="admin-controls">
                            <button class="admin-btn pin-toggle-btn" 
                                data-id="${post.id}" 
                                data-pinned="${post.is_pinned}">
                                ${post.is_pinned ? 'SABİTLEMEYİ KALDIR' : 'KONUYU SABİTLE'}
                            </button>
                            <button class="admin-btn delete delete-post-btn" 
                                data-id="${post.id}" 
                                data-title="${safeTitle}">
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

    // 4. Başlat
    fetchAllPosts();
});