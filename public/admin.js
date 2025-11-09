// public/admin.js

document.addEventListener('DOMContentLoaded', async () => {
    // 1. HTML'deki elementleri seç
    const approvedContainer = document.getElementById('posts-management-container');
    const approvedLoading = document.getElementById('approved-loading-message');
    const pendingContainer = document.getElementById('pending-posts-container');
    const pendingLoading = document.getElementById('pending-loading-message');
    
    
    // --- 2. GENEL MODERASYON İŞLEMLERİ ---

    // Konu Durumunu Güncelle (Onayla / Reddet)
    const updatePostStatus = async (postId, postTitle, newStatus) => {
        const actionText = newStatus === 'approved' ? 'ONAYLAMAK' : 'REDDETMEK';
        if (!confirm(`"${postTitle}" başlıklı konuyu ${actionText} istediğinize emin misiniz?`)) return;

        try {
            const response = await fetch(`/admin/posts/${postId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
                credentials: 'include'
            });

            if (response.ok) {
                alert('İşlem başarılı!');
                fetchPendingPosts();
                fetchApprovedPosts();
            } else {
                const data = await response.json();
                alert(`İşlem başarısız: ${data.message || 'Sunucu hatası.'}`);
            }
        } catch (error) {
            console.error('Durum güncelleme hatası:', error);
            alert('Sunucuya bağlanılamadı.');
        }
    };

    // DOLDURULDU: Konu Sabitleme (Çalışmayan kısım)
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
                fetchApprovedPosts(); // Listeyi yenile
            } else {
                const data = await response.json();
                alert(`İşlem başarısız: ${data.message || 'Sunucu hatası.'}`);
            }
        } catch (error) {
            console.error('Sabitleme hatası:', error);
            alert('Sunucuya bağlanılamadı.');
        }
    };
    
    // DOLDURULDU: Konu Silme (Çalışmayan kısım)
    const deletePost = async (postId, postTitle) => {
        if (!confirm(`"${postTitle}" başlıklı konuyu SİLMEK istediğinize emin misiniz? Bu işlem geri alınamaz!`)) return;
        
        try {
            const response = await fetch(`/admin/posts/${postId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            if (response.ok) {
                alert('Konu başarıyla silindi.');
                fetchApprovedPosts(); // Listeyi yenile
            } else {
                const data = await response.json();
                alert(`Silme işlemi başarısız: ${data.message || 'Sunucu hatası.'}`);
            }
        } catch (error) {
            console.error('Silme hatası:', error);
            alert('Sunucuya bağlanılamadı.');
        }
    };

    // --- 3. VERİ YÜKLEME FONKSİYONLARI ---

    // Onay Bekleyen Konuları Çek
    const fetchPendingPosts = async () => {
        try {
            pendingLoading.style.display = 'block';
            const response = await fetch('/admin/posts/pending', { credentials: 'include' });
            if (!response.ok) throw new Error('Onay bekleyenler çekilemedi.');
            
            const posts = await response.json();
            pendingLoading.style.display = 'none';
            
            pendingContainer.querySelectorAll('.admin-post-card, p').forEach(el => {
                if(el.id !== 'pending-loading-message') el.remove();
            });

            if (posts.length === 0) {
                pendingContainer.insertAdjacentHTML('beforeend', '<p>Onay bekleyen konu bulunmamaktadır.</p>');
                return;
            }

            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.className = 'admin-post-card pending-post-card';
                
                const safeTitle = DOMPurify.sanitize(post.title);
                const safeAuthor = DOMPurify.sanitize(post.author_username);
                const safeCategory = DOMPurify.sanitize(post.category_name || 'Bilinmiyor');
                const date = new Date(post.created_at).toLocaleString('tr-TR');

                postElement.innerHTML = `
                    <div class="admin-post-header">
                        <a href="/thread.html?id=${post.id}" target="_blank">${safeTitle}</a>
                        <div class="admin-controls pending-controls">
                            <button class="admin-btn approve-btn" data-id="${post.id}" data-title="${safeTitle}">ONAYLA</button>
                            <button class="admin-btn reject reject-btn" data-id="${post.id}" data-title="${safeTitle}">REDDET</button>
                        </div>
                    </div>
                    <p class="post-meta">Yazar: ${safeAuthor} | Tarih: ${date} | Kategori: <strong>${safeCategory}</strong></p>
                `;
                pendingContainer.appendChild(postElement);
            });
            
            // Onay/Red Butonları
            pendingContainer.querySelectorAll('.approve-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    updatePostStatus(btn.dataset.id, btn.dataset.title, 'approved');
                });
            });
            pendingContainer.querySelectorAll('.reject-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    updatePostStatus(btn.dataset.id, btn.dataset.title, 'rejected');
                });
            });

        } catch (error) {
            console.error('Onay bekleyenleri yükleme hatası:', error);
            pendingLoading.style.display = 'none';
            pendingContainer.innerHTML += '<p style="color: red;">Onay bekleyenler yüklenirken hata oluştu.</p>';
        }
    };
    
    // Onaylanmış Konuları Çek
    const fetchApprovedPosts = async () => {
        try {
            approvedLoading.style.display = 'block';
            const response = await fetch('https://yassal-haberlesme.onrender.com/api/posts/archive', { credentials: 'include' });
            if (!response.ok) throw new Error('Onaylı konular çekilemedi.');
            
            const posts = await response.json();
            approvedLoading.style.display = 'none';

            approvedContainer.querySelectorAll('.admin-post-card, p').forEach(el => {
                if(el.id !== 'approved-loading-message') el.remove();
            });

            if (posts.length === 0) {
                approvedContainer.insertAdjacentHTML('beforeend', '<p>Yönetilecek onaylı konu bulunmadı.</p>');
                return;
            }

            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.className = 'admin-post-card';
                
                const safeTitle = DOMPurify.sanitize(post.title);
                const safeAuthor = DOMPurify.sanitize(post.author_username);
                const safeCategory = DOMPurify.sanitize(post.category_name || 'Bilinmiyor');
                const date = new Date(post.created_at).toLocaleString('tr-TR');
                const isPinned = post.is_pinned || false;

                postElement.innerHTML = `
                    <div class="admin-post-header">
                        <a href="/thread.html?id=${post.id}" target="_blank">${safeTitle}</a>
                        <div class="admin-controls">
                            <button class="admin-btn pin-toggle-btn" data-id="${post.id}" data-pinned="${isPinned}">
                                ${isPinned ? 'SABİTLEMEYİ KALDIR' : 'KONUYU SABİTLE'}
                            </button>
                            <button class="admin-btn delete delete-post-btn" data-id="${post.id}" data-title="${safeTitle}">
                                KONUYU SİL
                            </button>
                        </div>
                    </div>
                    <p class="post-meta">Yazar: ${safeAuthor} | Tarih: ${date} | Kategori: <strong>${safeCategory}</strong></p>
                `;
                approvedContainer.appendChild(postElement);
            });
            
            // Sabitle/Sil Butonları
            approvedContainer.querySelectorAll('.pin-toggle-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    updatePostPinStatus(btn.dataset.id, btn.dataset.pinned === 'true');
                });
            });
            
            approvedContainer.querySelectorAll('.delete-post-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    deletePost(btn.dataset.id, btn.dataset.title);
                });
            });

        } catch (error) {
            console.error('Onaylıları yükleme hatası:', error);
            approvedLoading.style.display = 'none';
            approvedContainer.innerHTML += '<p style="color: red;">Sunucuya bağlanırken bir sorun oluştu.</p>';
        }
    };

    // 4. Başlat
    fetchPendingPosts();
    fetchApprovedPosts();
});