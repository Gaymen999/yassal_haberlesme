// public/script.js (YENİ HALİ - Animasyon 1 Eklendi)

document.addEventListener('DOMContentLoaded', async () => { 
    // --- 1. ELEMENTLERİ SEÇ ---
    const postsContainer = document.getElementById('posts-container');
    const newPostButtonContainer = document.getElementById('new-post-button-container');

    // --- 2. DURUM DEĞİŞKENLERİ ---
    let isAdmin = false;
    let isLoggedIn = false; 
    
    // --- YENİ: KAYDIRMA ANİMASYONU İÇİN OBSERVER ---
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.remove('hidden');
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Animasyon 1 kez çalışsın
            }
        });
    }, { threshold: 0.1 }); // %10'u görünürse animasyon başlasın
    
    const observeNewPosts = () => {
        postsContainer.querySelectorAll('.post-card.hidden').forEach(card => {
            observer.observe(card);
        });
    };
    // ------------------------------------------------

    // --- 3. FONKSİYON TANIMLAMALARI ---

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
            // GET istekleri secureFetch GEREKTİRMEZ
            const res = await fetch('/api/posts/recent', { credentials: 'include' });
            if (!res.ok) throw new Error('Konular yüklenemedi.');
            
            const posts = await res.json();
            postsContainer.innerHTML = ''; // "Yükleniyor..." yazısını sil
            
            if (posts.length === 0) {
                postsContainer.innerHTML = `<p class="no-posts">Henüz onaylanmış bir konu bulunmamaktadır.</p>`;
                return;
            }

            posts.forEach((post, index) => {
                const postElement = document.createElement('div');
                // post-card sınıfının yanına "hidden" sınıfını ekle
                postElement.classList.add('post-card', 'hidden'); 

                if (post.is_pinned) {
                    postElement.classList.add('pinned');
                }

                const date = new Date(post.created_at).toLocaleDateString('tr-TR', {
                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                
                const safeTitle = DOMPurify.sanitize(post.title);
                const safeCategoryName = DOMPurify.sanitize(post.category_name);
                const safeAuthorUsername = DOMPurify.sanitize(post.author_username);
                
                let adminControls = '';
                if (isAdmin) {
                    const pinText = post.is_pinned ? 'SABİTLEMEĞİ KALDIR' : 'KONUYU SABİTLE';
                    adminControls = `
                        <div class="admin-card-controls">
                            <button class="admin-pin-btn pin-toggle-btn" data-id="${post.id}" data-pinned="${post.is_pinned}">
                                ${pinText}
                            </button>
                        </div>
                    `;
                }

                postElement.innerHTML = `
                    <div class="post-header">
                        <h3><a href="/thread.html?id=${post.id}">${safeTitle}</a></h3>
                        <span class="category-tag"><a href="/category.html?slug=${post.category_slug}">${safeCategoryName}</a></span>
                    </div>
                    <div class="post-meta">
                        <p>Yayınlayan: <a href="profile.html?username=${safeAuthorUsername}">${safeAuthorUsername}</a> (${date})</p>
                    </div>
                    <div class="post-stats">
                        <span>Cevap: ${post.reply_count || 0}</span>
                        <span>Beğeni: ${post.like_count || 0}</span>
                    </div>
                    ${adminControls}
                `;
                postsContainer.appendChild(postElement);
            });
            
            // YENİ: Postları DOM'a ekledikten sonra gözlemlemeye başla
            observeNewPosts(); 

        } catch (error) {
            console.error(error);
            postsContainer.innerHTML = `<p style="color: red;">Konular yüklenirken hata oluştu.</p>`;
        }
    };

    // Konu sabitleme/kaldırma (Admin için)
    const updatePostPinStatus = async (postId, isCurrentlyPinned) => {
        const actionText = isCurrentlyPinned ? 'Sabitlemeyi Kaldır' : 'Sabitle';
        if (!confirm(`Bu konuyu ${actionText}mak istediğinize emin misiniz?`)) return;
        
        try {
            // secureFetch kullanır
            const response = await window.secureFetch(`/admin/posts/${postId}`, {
                method: 'PUT',
                body: { is_pinned: !isCurrentlyPinned }
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
        
        renderNewPostButton(); 
        fetchPosts(); 

    } catch (error) {
        console.warn('Kullanıcı durumu kontrol edilemedi.');
        renderNewPostButton();
        fetchPosts(); 
    }
    
    // Admin Sabitleme butonu için dinleyici (delegate et)
    postsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('pin-toggle-btn')) {
            const btn = e.target;
            updatePostPinStatus(btn.dataset.id, btn.dataset.pinned === 'true');
        }
    });

});