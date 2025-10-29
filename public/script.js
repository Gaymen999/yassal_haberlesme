// Helper function to decode JWT token (Aynı global.js'de olduğu gibi)
const decodeToken = (token) => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
};


document.addEventListener('DOMContentLoaded', () => {
    const postsContainer = document.getElementById('posts-container');
    const token = localStorage.getItem('authToken');
    let isAdmin = false;

    // Token varsa ve çözülebiliyorsa rolü kontrol et
    if (token) {
        const user = decodeToken(token);
        if (user && user.role === 'admin') {
            isAdmin = true;
        }
    }
    
    // --- Post Güncelleme Fonksiyonu (Sabitleme/Kaldırma) ---
    const updatePostPinStatus = async (postId, isCurrentlyPinned) => {
        if (!isAdmin) return alert('Yetkisiz işlem!');

        const actionText = isCurrentlyPinned ? 'Sabitlemeyi Kaldır' : 'Sabitle';
        if (!confirm(`Bu içeriği ${actionText}mak istediğinize emin misiniz?`)) {
            return;
        }
        
        try {
            const response = await fetch(`/admin/posts/${postId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ is_pinned: !isCurrentlyPinned }) // Sabitleme durumunu tersine çevir
            });

            if (response.ok) {
                alert(`Paylaşım başarıyla ${isCurrentlyPinned ? 'Sabitlemesi Kaldırıldı' : 'Sabitlendi'}!`);
                fetchPosts(); // Listeyi yeniden çek ve güncelle
            } else {
                const data = await response.json();
                alert(`İşlem başarısız: ${data.message || 'Sunucu hatası.'}`);
            }

        } catch (error) {
            console.error('Sabitleme hatası:', error);
            alert('Sunucuya bağlanılamadı.');
        }
    };
    
    // --- YENİ EKLENDİ: Yayından Kaldırma (Unpublish) Fonksiyonu ---
    const removePostFromSite = async (postId) => {
        if (!isAdmin) return alert('Yetkisiz işlem!');

        // Yayından kaldırma işlemi için 'reject' (reddet) action'ı gönderiyoruz
        if (!confirm('DİKKAT: Bu gönderiyi ana sayfadan ve arşivden KALDIRMAK istediğinizden emin misiniz? (Admin Panelinde onay bekleyen olarak görünmeye devam edecektir)')) {
            return;
        }
        
        try {
            const response = await fetch(`/admin/posts/${postId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ action: 'reject' }) // Durumu 'rejected' yap
            });

            if (response.ok) {
                alert('Paylaşım başarıyla yayından kaldırıldı!');
                fetchPosts(); // Listeyi yeniden çek ve güncelle
            } else {
                const data = await response.json();
                alert(`İşlem başarısız: ${data.message || 'Sunucu hatası.'}`);
            }

        } catch (error) {
            console.error('Yayından kaldırma hatası:', error);
            alert('Sunucuya bağlanılamadı.');
        }
    };


    // --- Duyuruları Çeken Ana Fonksiyon ---
    const fetchPosts = async () => {
        try {
            const response = await fetch('/api/posts');
            if (!response.ok) throw new Error('Duyurular yüklenirken bir hata oluştu: ' + response.statusText);

            const posts = await response.json();
            postsContainer.innerHTML = ''; 

            if (posts.length === 0) {
                postsContainer.innerHTML = '<p>Şu an yayınlanmış onaylı bir duyuru bulunmamaktadır.</p>';
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
                
                // Sabitleme butonu ve metni
                const pinButtonText = post.is_pinned ? 'Sabitlemeyi Kaldır' : 'Sabitle';
                
                // Admin Butonları HTML'i - Yayından Kaldır butonu eklendi
                const adminControls = isAdmin ? `
                    <div class="admin-actions">
                        <button class="pin-toggle-btn" 
                                data-id="${post.id}" 
                                data-pinned="${post.is_pinned}"
                                style="background-color: #2196F3; color: white;">
                                ${pinButtonText}
                        </button>
                        <button class="remove-btn" 
                                data-id="${post.id}" 
                                style="background-color: darkred; color: white;">
                                Yayından Kaldır
                        </button>
                    </div>
                ` : '';

                postElement.innerHTML = `
                    <div class="post-header">
                        <h3>${post.title}</h3>
                        <span class="category-tag">${post.category}</span>
                        ${post.is_pinned ? '<span class="pinned-badge">⭐ SABİTLENMİŞ</span>' : ''}
                        ${adminControls} 
                    </div>
                    <p class="post-meta">Yayınlayan: ${post.author_email} (${date})</p>
                    <div class="post-content">
                        ${post.content}
                    </div>
                `;
                postsContainer.appendChild(postElement);
            });
            
            // Sadece Admin ise buton olay dinleyicilerini ekle
            if (isAdmin) {
                postsContainer.querySelectorAll('.pin-toggle-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const postId = btn.dataset.id;
                        const isPinned = btn.dataset.pinned === 'true'; 
                        updatePostPinStatus(postId, isPinned);
                    });
                });
                
                // YENİ: Yayından Kaldır butonu dinleyicisi
                postsContainer.querySelectorAll('.remove-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const postId = btn.dataset.id;
                        removePostFromSite(postId);
                    });
                });
            }

        } catch (error) {
            console.error(error);
            postsContainer.innerHTML = `<p style="color: red;">Duyurular yüklenirken hata oluştu. Lütfen daha sonra tekrar deneyin.</p>`;
        }
    };

    fetchPosts();
});