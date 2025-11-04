// public/admin.js

document.addEventListener('DOMContentLoaded', async () => {
    // 1. HTML'deki elementleri seç
    const approvedContainer = document.getElementById('posts-management-container');
    const approvedLoading = document.getElementById('approved-loading-message');
    
    // YENİ: Onay bekleyenler elementleri
    const pendingContainer = document.getElementById('pending-posts-container');
    const pendingLoading = document.getElementById('pending-loading-message');
    
    
    // --- 2. GENEL MODERASYON İŞLEMLERİ ---

    // YENİ: Konu Durumunu Güncelle (Onayla / Reddet)
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
                // Her iki listeyi de yenile
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

    // Konu Sabitleme (Aynı, değişmedi)
    const updatePostPinStatus = async (postId, isCurrentlyPinned) => {
        // ... (Bu fonksiyonun içi aynı) ...
        try {
            // ...
            if (response.ok) {
                // ...
                fetchApprovedPosts(); // Sadece onaylıları yenile
            } // ...
        } catch (error) {
            // ...
        }
    };
    
    // Konu Silme (Aynı, değişmedi)
    const deletePost = async (postId, postTitle) => {
        // ... (Bu fonksiyonun içi aynı) ...
        try {
            // ...
            if (response.ok) {
                // ...
                fetchApprovedPosts(); // Sadece onaylıları yenile
            } // ...
        } catch (error) {
            // ...
        }
    };

    // --- 3. VERİ YÜKLEME FONKSİYONLARI ---

    // YENİ: Onay Bekleyen Konuları Çek
    const fetchPendingPosts = async () => {
        try {
            pendingLoading.style.display = 'block';
            
            // YENİ ROTA: /admin/posts/pending
            const response = await fetch('/admin/posts/pending', { credentials: 'include' });
            if (!response.ok) throw new Error('Onay bekleyenler çekilemedi.');
            
            const posts = await response.json();
            pendingLoading.style.display = 'none';
            
            // Konteynerin içini temizle (başlık hariç)
            pendingContainer.querySelectorAll('.admin-post-card').forEach(card => card.remove());

            if (posts.length === 0) {
                pendingContainer.insertAdjacentHTML('beforeend', '<p>Onay bekleyen konu bulunmamaktadır.</p>');
                return;
            }

            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.className = 'admin-post-card pending-post-card'; // YENİ CSS
                
                const safeTitle = DOMPurify.sanitize(post.title);
                const safeAuthor = DOMPurify.sanitize(post.author_username);
                const safeCategory = DOMPurify.sanitize(post.category_name || 'Bilinmiyor');
                const date = new Date(post.created_at).toLocaleString('tr-TR');

                postElement.innerHTML = `
                    <div class="admin-post-header">
                        <a href="/thread.html?id=${post.id}" target="_blank">${safeTitle}</a>
                        
                        <div class="admin-controls pending-controls">
                            <button class="admin-btn approve-btn" data-id="${post.id}" data-title="${safeTitle}">
                                ONAYLA
                            </button>
                            <button class="admin-btn reject reject-btn" data-id="${post.id}" data-title="${safeTitle}">
                                REDDET
                            </button>
                        </div>
                    </div>
                    <p class="post-meta">
                        Yazar: ${safeAuthor} | Tarih: ${date} | Kategori: <strong>${safeCategory}</strong>
                    </p>
                `;
                pendingContainer.appendChild(postElement);
            });
            
            // YENİ: Buton Olay Dinleyicileri
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
    
    
    // GÜNCELLENDİ: Onaylanmış Konuları Çek
    // (Eski fetchAllPosts fonksiyonu)
    const fetchApprovedPosts = async () => {
        try {
            approvedLoading.style.display = 'block';
            
            // Rota aynı: /api/archive (Bu rota artık sadece onaylıları getiriyor)
            const response = await fetch('/api/archive', { credentials: 'include' });
            if (!response.ok) throw new Error('Onaylı konular çekilemedi.');
            
            const posts = await response.json();
            approvedLoading.style.display = 'none';

            // Konteynerin içini temizle (başlık hariç)
            approvedContainer.querySelectorAll('.admin-post-card').forEach(card => card.remove());

            if (posts.length === 0) {
                approvedContainer.insertAdjacentHTML('beforeend', '<p>Yönetilecek onaylı konu bulunamadı.</p>');
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
                            <button class="admin-btn pin-toggle-btn" 
                                data-id="${post.id}" 
                                data-pinned="${isPinned}">
                                ${isPinned ? 'SABİTLEMEYİ KALDIR' : 'KONUYU SABİTLE'}
                            </button>
                            <button class="admin-btn delete delete-post-btn" 
                                data-id="${post.id}" 
                                data-title="${safeTitle}">
                                KONUYU SİL
                            </button>
                        </div>
                    </div>
                    <p class="post-meta">
                        Yazar: ${safeAuthor} | Tarih: ${date} | Kategori: <strong>${safeCategory}</strong>
                    </p>
                `;
                approvedContainer.appendChild(postElement);
            });
            
            // Buton Olay Dinleyicileri (Sabitle/Sil)
            approvedContainer.querySelectorAll('.pin-toggle-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const postId = btn.dataset.id;
                    const isPinned = btn.dataset.pinned === 'true';
                    updatePostPinStatus(postId, isPinned);
                });
            });
            
            approvedContainer.querySelectorAll('.delete-post-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const postId = btn.dataset.id;
                    const postTitle = btn.dataset.title;
                    deletePost(postId, postTitle);
                });
            });

        } catch (error) {
            console.error('Onaylıları yükleme hatası:', error);
            approvedLoading.style.display = 'none';
            approvedContainer.innerHTML += '<p style="color: red;">Sunucuya bağlanırken bir sorun oluştu.</p>';
        }
    };

    // 4. Başlat
    fetchPendingPosts();   // Onay bekleyenleri çek
    fetchApprovedPosts();  // Onaylıları çek
});