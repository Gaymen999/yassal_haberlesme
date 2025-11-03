document.addEventListener('DOMContentLoaded', async () => { 
    // --- 1. ELEMENTLERİ SEÇ ---
    const postsContainer = document.getElementById('posts-container');
    const newPostButtonContainer = document.getElementById('new-post-button-container');

    // --- 2. DURUM DEĞİŞKENLERİ ---
    let isAdmin = false;
    let isLoggedIn = false; 

    // --- 3. FONKSİYON TANIMLAMALARI (HATANIN ÇÖZÜMÜ) ---
    // BU FONKSİYONLAR, ÇAĞRILMADAN ÖNCE TANIMLANMALIDIR

    // "Yeni Konu Aç" butonunu çizer
    const renderNewPostButton = () => {
        if (isLoggedIn) {
            newPostButtonContainer.innerHTML = `<a href="submit.html" class="new-post-btn">Yeni Konu Aç</a>`;
        } else {
             newPostButtonContainer.innerHTML = `<p class="login-prompt">Konu açmak için lütfen <a href="login.html">giriş yapın</a>.</p>`;
        }
    };
    
    // Konuları çeker ve listeler
    const fetchPosts = async () => {
        try {
            const res = await fetch('/api/posts/recent', { credentials: 'include' });
            if (!res.ok) throw new Error('Konular yüklenemedi.');
            
            const posts = await res.json();
            postsContainer.innerHTML = ''; // "Yükleniyor..." yazısını temizle

            if (posts.length === 0) {
                postsContainer.innerHTML = '<p>Gösterilecek konu bulunamadı.</p>';
                return;
            }

            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.className = 'post-card';
                if (post.is_pinned) {
                    postElement.classList.add('pinned');
                }
                
                const date = new Date(post.created_at).toLocaleDateString('tr-TR', {
                    year: 'numeric', month: 'long', day: 'numeric'
                });
                
                // Güvenli (XSS korumalı) HTML oluştur
                const safeTitle = DOMPurify.sanitize(post.title);
                const safeCategoryName = DOMPurify.sanitize(post.category_name);
                const safeAuthorUsername = DOMPurify.sanitize(post.author_username);
                const categorySlug = DOMPurify.sanitize(post.category_slug);

                // Admin butonları (Sadece adminse ve konu kilitli değilse göster)
                let adminControls = '';
                if (isAdmin && !post.is_locked) {
                    adminControls = `
                        <div class="admin-card-controls">
                            <button class="admin-pin-btn" 
                                data-id="${post.id}" 
                                data-is-pinned="${post.is_pinned}">
                                ${post.is_pinned ? 'Sabitlemeyi Kaldır' : 'Sabitle'}
                            </button>
                        </div>
                    `;
                }
                
                postElement.innerHTML = `
                    <div class="post-header">
                        <h3><a href="/thread.html?id=${post.id}">${safeTitle}</a></h3>
                        <a href="/category.html?slug=${categorySlug}" class="category-tag">${safeCategoryName}</a>
                    </div>
                    <div class="post-footer">
                         <p class="post-meta">
                            Yayınlayan: <a href="/profile.html?username=${encodeURIComponent(safeAuthorUsername)}">${safeAuthorUsername}</a> (${date})
                         </p>
                         <div class="post-stats">
                            <span>${post.reply_count || 0} Cevap</span>
                            <span>${post.like_count || 0} Beğeni</span>
                        </div>
                    </div>
                    ${adminControls}
                `;
                postsContainer.appendChild(postElement);
            });

        } catch (error) {
            console.error('Konu yükleme hatası:', error);
            postsContainer.innerHTML = `<p style="color: red;">Konular yüklenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.</p>`;
        }
    };
    
    // Admin sabitleme/kaldırma işlemleri
    const handleAdminActions = async (e) => {
        if (!e.target.classList.contains('admin-pin-btn')) return;
        if (!isAdmin) return; 
        
        const btn = e.target;
        const postId = btn.dataset.id;
        const isCurrentlyPinned = btn.dataset.isPinned === 'true';
        const actionText = isCurrentlyPinned ? 'sabitlemesini kaldırmak' : 'sabitlemek';

        if (!confirm(`Bu konuyu ${actionText} istediğinize emin misiniz?`)) return;

        try {
            // DİKKAT: Ana sayfada sadece pin/unpin (sabitleme) işlemi yapıyoruz.
            // Bu yüzden adminRoutes.js'deki PUT /admin/posts/:id rotasını kullanıyoruz.
            const response = await fetch(`/admin/posts/${postId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_pinned: !isCurrentlyPinned }),
                credentials: 'include'
            });

            if (response.ok) {
                alert(`Konu başarıyla ${isCurrentlyPinned ? 'sabitlemesi kaldırıldı' : 'sabitlendi'}.`);
                fetchPosts(); // Listeyi yenile
            } else {
                const data = await response.json();
                alert(`İşlem başarısız: ${data.message || 'Sunucu hatası.'}`);
            }
        } catch (error) {
            console.error('Sabitleme hatası:', error);
            alert('Sunucuya bağlanılamadı.');
        }
    };

    // --- 4. KODU BAŞLAT ---
    
    // (Önce kullanıcı durumunu kontrol et)
    try {
        const response = await fetch('/api/user-status', {
            credentials: 'include' 
        });
        const data = await response.json();
        
        if (data.loggedIn) {
            isLoggedIn = true; 
            if (data.user.role === 'admin') {
                isAdmin = true;
            }
        }
        
        // Artık fonksiyonlar tanımlı olduğu için burası çalışacak
        renderNewPostButton(); 

    } catch (error) {
        console.warn('Kullanıcı durumu kontrol edilemedi.');
        // Hata olsa bile buton (giriş yap) çizilmeli
        renderNewPostButton();
    }

    // (Sonra konuları çek)
    await fetchPosts();

    // (Event listener'ı en son ekle)
    postsContainer.addEventListener('click', handleAdminActions);
});