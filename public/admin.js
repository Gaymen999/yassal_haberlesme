// public/admin.js (KULLANICI LİSTESİ EKLENMİŞ HALİ)

document.addEventListener('DOMContentLoaded', async () => {
    // 1. HTML'deki elementleri seç
    const approvedContainer = document.getElementById('posts-management-container');
    const approvedLoading = document.getElementById('approved-loading-message');
    const pendingContainer = document.getElementById('pending-posts-container');
    const pendingLoading = document.getElementById('pending-loading-message');
    
    // YENİ EKLENEN ELEMENTLER (Kullanıcı listesi için)
    const userListContainer = document.getElementById('user-list-container');
    const userLoading = document.getElementById('user-loading-message');
    // ---------------------------------------------
    
    
    // --- 2. GENEL MODERASYON İŞLEMLERİ ---

    // Konu Durumunu Güncelle (Onayla / Reddet)
    const updatePostStatus = async (postId, postTitle, newStatus) => {
        // ... (Bu fonksiyonun tamamı SİZİN KODUNUZLA AYNI)
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
    }; //

    // Konu Sabitleme
    const updatePostPinStatus = async (postId, isCurrentlyPinned) => {
        // ... (Bu fonksiyonun tamamı SİZİN KODUNUZLA AYNI)
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
    }; //
    
    // Konu Silme
    const deletePost = async (postId, postTitle) => {
        // ... (Bu fonksiyonun tamamı SİZİN KODUNUZLA AYNI)
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
    }; //

    // --- 3. VERİ YÜKLEME FONKSİYONLARI ---

    // Onay Bekleyen Konuları Çek
    const fetchPendingPosts = async () => {
        // ... (Bu fonksiyonun tamamı SİZİN KODUNUZLA AYNI)
        try {
            pendingLoading.style.display = 'block';
            const response = await fetch('api/admin/posts/pending', { credentials: 'include' });
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
    }; //
    
    // Onaylanmış Konuları Çek
    const fetchApprovedPosts = async () => {
        // ... (Bu fonksiyonun tamamı SİZİN KODUNUZLA AYNI)
        try {
            approvedLoading.style.display = 'block';
            // NOT: Buradaki fetch URL'ini senin kodundaki gibi bıraktım
            const response = await fetch('/api/posts/archive', { credentials: 'include' });
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
    }; //

    // --- YENİ KULLANICI LİSTELEME FONKSİYONU ---
    const fetchAllUsers = async () => {
        try {
            userLoading.style.display = 'block';
            
            // Backend'de oluşturduğumuz yeni rotayı çağırıyoruz
            // Senin kod stilinle (credentials: 'include') uyumlu hale getirdim
            const response = await fetch('/api/admin/users', { credentials: 'include' });

            if (!response.ok) {
                throw new Error('Kullanıcı listesi alınamadı.');
            }

            const users = await response.json();
            userLoading.style.display = 'none';

            // Mevcut listeyi (veya "bulunamadı" p'sini) temizle
            userListContainer.querySelectorAll('p, table').forEach(el => {
                if(el.id !== 'user-loading-message') el.remove();
            });

            if (users.length === 0) {
                userListContainer.insertAdjacentHTML('beforeend', '<p>Sistemde kayıtlı kullanıcı bulunamadı.</p>');
                return;
            }

            // Kullanıcıları tablo olarak oluştur
            // Güvenlik için DOMPurify kullanıyoruz (senin kodunda olduğu gibi)
            let tableHTML = `
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #f4f4f4;">
                            <th style="padding: 8px; border: 1px solid #ddd;">ID</th>
                            <th style="padding: 8px; border: 1px solid #ddd;">Kullanıcı Adı</th>
                            <th style="padding: 8px; border: 1px solid #ddd;">Email</th>
                            <th style="padding: 8px; border: 1px solid #ddd;">Rol</th>
                            <th style="padding: 8px; border: 1px solid #ddd;">Kayıt Tarihi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(user => `
                            <tr>
                                <td style="padding: 8px; border: 1px solid #ddd;">${user.id}</td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${DOMPurify.sanitize(user.username)}</td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${DOMPurify.sanitize(user.email)}</td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${DOMPurify.sanitize(user.role)}</td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${new Date(user.created_at).toLocaleDateString('tr-TR')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            // HTML'e tabloyu ekle
            userListContainer.insertAdjacentHTML('beforeend', tableHTML);

        } catch (error) {
            console.error('Kullanıcıları yükleme hatası:', error);
            userLoading.style.display = 'none';
            userListContainer.innerHTML += '<p style="color: red;">Kullanıcılar yüklenirken bir hata oluştu.</p>';
        }
    };
    // --- YENİ FONKSİYON SONU ---

    // 4. Başlat
    fetchPendingPosts();
    fetchApprovedPosts();
    fetchAllUsers(); // YENİ EKLENEN ÇAĞRI
});