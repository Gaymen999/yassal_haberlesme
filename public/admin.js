document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('pending-posts-container');
    const loadingMessage = document.getElementById('loading-message');
    
    // --- Admin İşlemleri (API Call) ---
    const updatePostStatus = async (postId, action, category = null, is_pinned = null) => {
        try {
            const bodyData = { action }; 
            
            if (category !== null) bodyData.category = category;
            if (is_pinned !== null) bodyData.is_pinned = is_pinned;
            
            const response = await fetch(`/admin/posts/${postId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bodyData),
                credentials: 'include' // DÜZELTME: Cookie'yi göndermek için eklendi
            });

            if (response.ok) {
                fetchPendingPosts(); 
            } else {
                const data = await response.json();
                alert(`İşlem başarısız: ${data.message || 'Sunucu hatası.'}`);
            }

        } catch (error) {
            console.error('Gönderim hatası:', error);
            alert('Sunucuya bağlanılamadı.'); // Buraya düşüyordun
        }
    };


    // --- Onay Bekleyenleri Listeleme ---
    const fetchPendingPosts = async () => {
        container.innerHTML = ''; 
        loadingMessage.style.display = 'block'; 

        try {
            const response = await fetch('/admin/pending-posts', {
                method: 'GET',
                credentials: 'include' // DÜZELTME: Cookie'yi göndermek için eklendi
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                     container.innerHTML = '<h3>Yetkiniz yok veya oturum süreniz doldu.</h3>';
                     window.location.href = '/login.html';
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
            
            // ÖNEMLİ: admin.html'e DOMPurify script'ini eklemeyi unutma
            // (Bir önceki incelemede bahsettiğim XSS açığı)

            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.classList.add('post-card');
                
                const date = new Date(post.created_at).toLocaleDateString('tr-TR');
                
                // GÜVENLİK UYARISI: Burası hala XSS açığına sahip.
                // Lütfen admin.html'e DOMPurify ekle ve 
                // ${post.title} ile ${post.content}'i sanitize et.
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

    fetchPendingPosts();
});