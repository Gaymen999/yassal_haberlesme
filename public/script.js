// public/script.js
document.addEventListener('DOMContentLoaded', async () => { 
    const postsContainer = document.getElementById('posts-container');
    const newPostButtonContainer = document.getElementById('new-post-button-container');
    
    // Sayfalama konteynerleri
    const paginationContainerTop = document.getElementById('pagination-container-top');
    const paginationContainerBottom = document.getElementById('pagination-container-bottom');

    // URL'den mevcut sayfayı al
    const params = new URLSearchParams(window.location.search);
    const currentPage = parseInt(params.get('page'), 10) || 1;
    
    let isAdmin = false;
    let isLoggedIn = false; 

    // --- 1. FONKSİYON TANIMLAMALARI (Önce fonksiyonları tanımla) ---
    
    const renderNewPostButton = () => {
        if (isLoggedIn) {
            newPostButtonContainer.innerHTML = `<a href="submit.html" class="new-post-btn">Yeni Konu Aç</a>`;
        } else {
             newPostButtonContainer.innerHTML = `<p class="login-prompt">Konu açmak için lütfen <a href="login.html">giriş yapın</a>.</p>`;
        }
    };

    const updatePostPinStatus = async (postId, isCurrentlyPinned) => {
        if (!isAdmin) return alert('Yetkisiz işlem!');
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
                fetchPosts(); 
            } else {
                const data = await response.json();
                alert(`İşlem başarısız: ${data.message || 'Sunucu hatası.'}`);
            }
        } catch (error) {
            console.error('Sabitleme hatası:', error);
            alert('Sunucuya bağlanılamadı.');
        }
    };
    
    const renderPagination = (pagination) => {
        const { currentPage, totalPages } = pagination;
        
        paginationContainerTop.innerHTML = '';
        paginationContainerBottom.innerHTML = '';

        if (totalPages <= 1) return; 

        let paginationHTML = '';
        
        if (currentPage > 1) {
            paginationHTML += `<a href="/index.html?page=${currentPage - 1}" class="page-link prev">Önceki</a>`;
        }
        if (currentPage > 2) {
             paginationHTML += `<a href="/index.html?page=1" class="page-link">1</a>`;
             if (currentPage > 3) paginationHTML += `<span class="page-dots">...</span>`;
        }
        if (currentPage > 1) {
             paginationHTML += `<a href="/index.html?page=${currentPage - 1}" class="page-link">${currentPage - 1}</a>`;
        }
        
        paginationHTML += `<span class="page-link current">${currentPage}</span>`;
        
        if (currentPage < totalPages) {
            paginationHTML += `<a href="/index.html?page=${currentPage + 1}" class="page-link">${currentPage + 1}</a>`;
        }
        if (currentPage < totalPages - 1) {
            if (currentPage < totalPages - 2) paginationHTML += `<span class="page-dots">...</span>`;
            paginationHTML += `<a href="/index.html?page=${totalPages}" class="page-link">${totalPages}</a>`;
        }
        if (currentPage < totalPages) {
            paginationHTML += `<a href="/index.html?page=${currentPage + 1}" class="page-link next">Sonraki</a>`;
        }
        
        paginationContainerTop.innerHTML = paginationHTML;
        paginationContainerBottom.innerHTML = paginationHTML;
    }

    const fetchPosts = async () => {
        try {
            const response = await fetch(`/api/posts?page=${currentPage}`, { credentials: 'include' });
            if (!response.ok) throw new Error('Konular yüklenirken bir hata oluştu: ' + response.statusText);

            const data = await response.json(); 
            const { posts, pagination } = data;
            
            postsContainer.innerHTML = ''; 

            if (posts.length === 0) {
                postsContainer.innerHTML = '<p>Şu an yayınlanmış konu bulunmamaktadır.</p>';
                return;
            }
            
            renderPagination(pagination);

            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.classList.add('post-card'); 
                if (post.is_pinned) postElement.classList.add('pinned');

                const date = new Date(post.created_at).toLocaleDateString('tr-TR', {
                    year: 'numeric', month: 'long', day: 'numeric'
                });
                
                const pinButtonText = post.is_pinned ? 'Sabitlemeyi Kaldır' : 'Sabitle';
                
                const adminControls = isAdmin ? `
                    <div class="admin-actions">
                        <button class="pin-toggle-btn" 
                                data-id="${post.id}" 
                                data-pinned="${post.is_pinned}"
                                style="background-color: #2196F3; color: white;">
                                ${pinButtonText}
                        </button>
                    </div>
                ` : '';

                const safeTitle = DOMPurify.sanitize(post.title);
                const safeAuthorUsername = DOMPurify.sanitize(post.author_username); 
                const safeCategoryName = DOMPurify.sanitize(post.category_name);

                postElement.innerHTML = `
                    <div class="post-header">
                        <h3><a href="/thread.html?id=${post.id}">${safeTitle}</a></h3>
                        <span class="category-tag">${safeCategoryName}</span>
                        ${post.is_pinned ? '<span class="pinned-badge">⭐ SABİTLENMİŞ</span>' : ''}
                        ${adminControls} 
                    </div>
                    
                    <div class="post-footer">
                         <p class="post-meta">Yayınlayan: ${safeAuthorUsername} (${date})</p>
                         <div class="post-stats">
                            <span>Cevap: ${post.reply_count || 0}</span>
                            <span>Beğeni: ${post.like_count || 0}</span>
                         </div>
                    </div>
                `;
                postsContainer.appendChild(postElement);
            });
            
            if (isAdmin) {
                postsContainer.querySelectorAll('.pin-toggle-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const postId = btn.dataset.id;
                        const isPinned = btn.dataset.pinned === 'true'; 
                        updatePostPinStatus(postId, isPinned);
                    });
                });
            }

        } catch (error) {
            console.error(error);
            postsContainer.innerHTML = `<p style="color: red;">Konular yüklenirken hata oluştu. Lütfen daha sonra tekrar deneyin.</p>`;
        }
    };
    
    // --- 2. KODU ÇALIŞTIRMA (Fonksiyonlar tanımlandıktan sonra) ---
    
    // DEĞİŞTİ: Bu blok dosyanın sonuna taşındı.
    // Önce kullanıcı durumunu kontrol et
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
        // Şimdi butonu render et (fonksiyon artık tanımlı)
        renderNewPostButton();

    } catch (error) {
        console.warn('Kullanıcı durumu kontrol edilemedi.');
        // Giriş yapmamış gibi devam et (fonksiyon artık tanımlı)
        renderNewPostButton();
    }

    // Kullanıcı durumu ve buton render edildikten sonra konuları çek
    fetchPosts();
});