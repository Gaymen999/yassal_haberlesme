// Helper function to decode JWT token
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


document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('pending-posts-container');
    const loadingMessage = document.getElementById('loading-message');
    
    const token = localStorage.getItem('authToken');
    
    // --- Başlangıç Yetki Kontrolü ---
    if (!token) {
        // global.js bu kontrolü zaten yapıyor, ama burada da güvenliğimizi artıralım
        return; 
    }
    
    // Token'ı çözerek rolü alalım (Admin kontrolü için)
    const user = decodeToken(token);
    if (!user || user.role !== 'admin') {
        // Bu, global.js'in yapamadığı daha kesin bir kontroldür.
        container.innerHTML = '<h3>YETKİSİZ ERİŞİM</h3><p>Bu sayfaya sadece yöneticiler erişebilir.</p>';
        loadingMessage.style.display = 'none';
        return;
    }


    // --- Admin İşlemleri (API Call) ---
    const updatePostStatus = async (postId, action, category = null, is_pinned = null) => {
        try {
            const bodyData = { action }; // action (approve/reject) her zaman var
            
            // Sabitleme veya kategori güncellenecekse body'ye ekle
            if (category !== null) bodyData.category = category;
            if (is_pinned !== null) bodyData.is_pinned = is_pinned;
            
            const response = await fetch(`/admin/posts/${postId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(bodyData)
            });

            if (response.ok) {
                // İşlem başarılı, listeyi yenile
                fetchPendingPosts(); 
            } else {
                const data = await response.json();
                alert(`İşlem başarısız: ${data.message || 'Sunucu hatası.'}`);
            }

        } catch (error) {
            console.error('Gönderim hatası:', error);
            alert('Sunucuya bağlanılamadı.');
        }
    };


    // --- Onay Bekleyenleri Listeleme ---
    const fetchPendingPosts = async () => {
        container.innerHTML = ''; // Önceki listeyi temizle
        loadingMessage.style.display = 'block'; // Yükleniyor mesajını göster

        try {
            const response = await fetch('/admin/pending-posts', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}` 
                }
            });

            if (!response.ok) {
                if (response.status === 403) {
                     container.innerHTML = '<h3>Yetkiniz yok. Admin rolünde değilsiniz.</h3>';
                } else {
                     container.innerHTML = '<h3>Hata: Onay bekleyenleri çekerken sorun oluştu.</h3>';
                }
                loadingMessage.style.display = 'none';
                return;
            }

            const posts = await response.json();
            loadingMessage.style.display = 'none';

            if (posts.length === 0) {
                container.innerHTML = '<p>Şu an onay bekleyen hiçbir paylaşım yok. Her şey yolunda!</p>';
                return;
            }

            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.classList.add('post-card');
                
                const date = new Date(post.created_at).toLocaleDateString('tr-TR');

                postElement.innerHTML = `
                    <div class="post-header">
                        <h4 class="pending-title">${post.title} (ID: ${post.id})</h4>
                        <div class="actions">
                            <button class="approve" data-id="${post.id}">ONAYLA</button>
                            <button class="reject" data-id="${post.id}">REDDET</button>
                            <button class="pin" data-id="${post.id}" data-pinned="${post.is_pinned}">
                                ${post.is_pinned ? 'SABİTLEMEYİ KALDIR' : 'SABİTLE'}
                            </button>
                        </div>
                    </div>
                    <p class="post-meta">
                        Yazar: ${post.author_id} | 
                        Tarih: ${date} | 
                        Kategori: <strong>${post.category}</strong>
                    </p>
                    <div class="post-content">
                        ${post.content}
                    </div>
                `;
                container.appendChild(postElement);
            });
            
            // Buton Olay Dinleyicileri Ekle
            container.querySelectorAll('.approve').forEach(btn => {
                btn.addEventListener('click', () => updatePostStatus(btn.dataset.id, 'approve'));
            });
            container.querySelectorAll('.reject').forEach(btn => {
                btn.addEventListener('click', () => updatePostStatus(btn.dataset.id, 'reject'));
            });
            container.querySelectorAll('.pin').forEach(btn => {
                btn.addEventListener('click', () => {
                    // Sabitleme durumunu tersine çevir
                    const isPinned = btn.dataset.pinned === 'true'; 
                    updatePostStatus(btn.dataset.id, null, null, !isPinned);
                });
            });


        } catch (error) {
            console.error('Yükleme hatası:', error);
            loadingMessage.style.display = 'none';
            container.innerHTML = '<p style="color: red;">Sunucuya bağlanırken bir sorun oluştu.</p>';
        }
    };

    // Sayfa yüklendiğinde listeyi çek
    fetchPendingPosts();
});