document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. ELEMENTLERİ SEÇ ---
    const threadMainPost = document.getElementById('thread-main-post');
    const repliesContainer = document.getElementById('replies-container');
    const repliesHeader = document.getElementById('replies-header');
    const replyFormContainer = document.getElementById('reply-form-container');
    const paginationContainerTop = document.getElementById('pagination-container-top');
    const paginationContainerBottom = document.getElementById('pagination-container-bottom');
    const adminControlsContainer = document.getElementById('admin-controls-container');
    const pageTitle = document.querySelector('title');

    // --- 2. GEREKLİ BİLGİLERİ AL ---
    const params = new URLSearchParams(window.location.search);
    const threadId = params.get('id');
    const page = params.get('page') || 1; 

    if (!threadId) {
        window.location.href = '/index.html';
        return;
    }

    let isAdmin = false;
    let userId = null;
    let currentThread = null; 
    let replyQuill = null; 

    // --- 3. KULLANICI DURUMUNU KONTROL ET ---
    try {
        const statusResponse = await fetch('/api/user-status', { credentials: 'include' });
        if (statusResponse.ok) {
            const data = await statusResponse.json();
            if (data.loggedIn) {
                userId = data.user.id;
                isAdmin = data.user.role === 'admin';
            }
        }
    } catch (error) {
        console.warn('Kullanıcı durumu kontrol edilemedi:', error);
    }

    // --- 4. YARDIMCI RENDER FONKSİYONLARI ---
    
    // Sol taraftaki yazar bilgisi kutusunu oluşturur
    const renderAuthorInfo = (username, avatar, title, postCount, joinDate) => {
        const joinDateFormatted = new Date(joinDate).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' });
        const safeAvatar = DOMPurify.sanitize(avatar || 'default_avatar.png');
        const safeUsername = DOMPurify.sanitize(username);
        const safeTitle = DOMPurify.sanitize(title || 'Yeni Üye');
        
        return `
            <div class="author-info">
                <img src="${safeAvatar}" alt="${safeUsername} avatar" class="avatar">
                <a href="profile.html?username=${safeUsername}" class="username">${safeUsername}</a>
                <span class="user-title">${safeTitle}</span>
                <span class="user-stat">Mesaj: ${postCount || 0}</span>
                <span class="user-stat">Katılım: ${joinDateFormatted}</span>
            </div>
        `;
    };

    // Sağ alttaki Beğen/Beğenmekten Vazgeç butonlarını oluşturur
    const renderPostActions = (item, type, currentUserId) => {
        const isLiked = currentUserId && item.liked_by_users && item.liked_by_users.includes(currentUserId);
        const likeAction = currentUserId ? 
            `<button class="like-btn ${isLiked ? 'liked' : ''}" data-id="${item.id}" data-type="${type}">
                ${isLiked ? 'Beğenmekten Vazgeç' : 'Beğen'} (${item.like_count || 0})
            </button>` :
            `<span class="like-count">Beğeni: ${item.like_count || 0}</span>`;
            
        return `<div class="post-actions">${likeAction}</div>`;
    };

    // Admin (Kilitle/Sil) butonlarını oluşturur
    const renderAdminControls = (thread) => {
        if (!isAdmin) {
            adminControlsContainer.innerHTML = '';
            return;
        }

        const lockButtonText = thread.is_locked ? 'Konu Kilidini Aç' : 'Konuyu Kilitle';
        
        adminControlsContainer.innerHTML = `
            <h4>Admin Kontrolleri</h4>
            <button id="lock-thread-btn" class="admin-btn">${lockButtonText}</button>
            <button id="delete-thread-btn" class="admin-btn delete">Konuyu Sil</button>
        `;

        // Event listener'ları ekle
        document.getElementById('lock-thread-btn').addEventListener('click', () => handleLockThread(thread.id, thread.is_locked));
        document.getElementById('delete-thread-btn').addEventListener('click', () => handleDeleteThread(thread.id));
    };

    // Sayfalama (Pagination) linklerini oluşturur
    const renderPagination = (pagination) => {
        const { currentPage, totalPages } = pagination;
        paginationContainerTop.innerHTML = '';
        paginationContainerBottom.innerHTML = '';
        if (totalPages <= 1) return;

        let paginationHTML = '';
        
        // Önceki
        if (currentPage > 1) {
            paginationHTML += `<a href="/thread.html?id=${threadId}&page=${currentPage - 1}" class="page-link prev">Önceki</a>`;
        }
        // İlk sayfa
        if (currentPage > 2) {
            paginationHTML += `<a href="/thread.html?id=${threadId}&page=1" class="page-link">1</a>`;
        }
        // ... (boşluk)
        if (currentPage > 3) {
            paginationHTML += `<span class="page-dots">...</span>`;
        }
        // Mevcuttan bir önceki
        if (currentPage > 1) {
            paginationHTML += `<a href="/thread.html?id=${threadId}&page=${currentPage - 1}" class="page-link">${currentPage - 1}</a>`;
        }
        // Mevcut sayfa
        paginationHTML += `<span class="page-link current">${currentPage}</span>`;
        // Mevcuttan bir sonraki
        if (currentPage < totalPages) {
            paginationHTML += `<a href="/thread.html?id=${threadId}&page=${currentPage + 1}" class="page-link">${currentPage + 1}</a>`;
        }
        // ... (boşluk)
        if (currentPage < totalPages - 2) {
            paginationHTML += `<span class="page-dots">...</span>`;
        }
        // Son sayfa
        if (currentPage < totalPages - 1) {
            paginationHTML += `<a href="/thread.html?id=${threadId}&page=${totalPages}" class="page-link">${totalPages}</a>`;
        }
        // Sonraki
        if (currentPage < totalPages) {
            paginationHTML += `<a href="/thread.html?id=${threadId}&page=${currentPage + 1}" class="page-link next">Sonraki</a>`;
        }
        
        paginationContainerTop.innerHTML = paginationHTML;
        paginationContainerBottom.innerHTML = paginationHTML;
    };

    // Cevap yazma formunu (Quill editor) oluşturur
    const renderReplyForm = (thread) => {
        replyFormContainer.innerHTML = '';
        
        if (thread.is_locked) {
            replyFormContainer.innerHTML = '<p class="locked-message">Bu konu kilitlendiği için yeni cevap yazılamaz.</p>';
            return;
        }
        
        if (!userId) {
            replyFormContainer.innerHTML = `<p class="login-prompt">Cevap yazmak için lütfen <a href="/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}">giriş yapın</a>.</p>`;
            return;
        }
        
        replyFormContainer.innerHTML = `
            <h3>Cevap Yaz</h3>
            <form id="reply-form">
                <div class="form-group">
                    <div id="reply-editor" style="background-color: white; height: 200px;"></div>
                </div>
                <button type="submit" class="submit-btn">Cevabı Gönder</button>
                <p id="reply-message" class="form-message"></p>
            </form>
        `;
        
        replyQuill = new Quill('#reply-editor', {
            theme: 'snow',
            modules: { 
                toolbar: [
                    ['bold', 'italic', 'underline'], 
                    ['link', 'blockquote', 'code-block'], 
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }]
                ] 
            }
        });
        
        document.getElementById('reply-form').addEventListener('submit', handleReplySubmit);
    };

    // --- 5. OLAY YÖNETİCİLERİ (Form Gönderme / Buton Tıklama) ---

    // Cevap formunu gönderme
    const handleReplySubmit = async (e) => {
        e.preventDefault();
        const content = replyQuill.root.innerHTML;
        const messageEl = document.getElementById('reply-message');
        
        if (!content.trim() || content === '<p><br></p>') {
            messageEl.textContent = 'Cevap içeriği boş olamaz.';
            messageEl.style.color = 'red';
            return;
        }
        
        try {
            const response = await fetch(`/api/threads/${threadId}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: DOMPurify.sanitize(content) }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                messageEl.textContent = 'Cevap eklendi! Sayfa yenileniyor...';
                messageEl.style.color = 'green';
                // Kullanıcıyı son sayfaya (yeni cevabının olduğu sayfaya) yönlendir
                window.location.href = `/thread.html?id=${threadId}&page=${data.lastPage}#reply-${data.replyId}`;
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            messageEl.textContent = error.message;
            messageEl.style.color = 'red';
        }
    };

    // Konuyu Kilitleme/Açma (Admin)
    const handleLockThread = async (id, isCurrentlyLocked) => {
        const actionText = isCurrentlyLocked ? 'kilidini açmak' : 'kilitlemek';
        if (!confirm(`Bu konuyu ${actionText} istediğinize emin misiniz?`)) return;

        try {
            const response = await fetch(`/admin/posts/${id}`, { // Rota /admin/posts/:id (PUT)
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_locked: !isCurrentlyLocked }),
                credentials: 'include'
            });

            if (response.ok) {
                alert(`Konu başarıyla ${isCurrentlyLocked ? 'kilidi açıldı' : 'kilitlendi'}.`);
                fetchThread(); // Sayfayı yenile
            } else {
                const data = await response.json();
                alert(`İşlem başarısız: ${data.message || 'Sunucu hatası.'}`);
            }
        } catch (error) {
            console.error('Kilitleme hatası:', error);
            alert('Sunucuya bağlanılamadı.');
        }
    };

    // Konuyu Silme (Admin)
    const handleDeleteThread = async (id) => {
        if (!confirm('KONUYU SİLMEK istediğinize emin misiniz? Bu işlem geri alınamaz ve tüm cevaplar da silinir!')) return;

        try {
            const response = await fetch(`/admin/posts/${id}`, { // Rota /admin/posts/:id (DELETE)
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                alert('Konu başarıyla silindi. Ana sayfaya yönlendiriliyorsunuz.');
                window.location.href = '/index.html';
            } else {
                const data = await response.json();
                alert(`Silme işlemi başarısız: ${data.message || 'Sunucu hatası.'}`);
            }
        } catch (error) {
            console.error('Silme hatası:', error);
            alert('Sunucuya bağlanılamadı.');
        }
    };
    
    // Beğeni ve En İyi Cevap için genel tıklama yöneticisi
    document.body.addEventListener('click', async (e) => {
        // Like Butonu
        if (e.target.classList.contains('like-btn')) {
            if (!userId) return alert('Beğeni yapmak için giriş yapmalısınız.');
            
            const btn = e.target;
            const id = btn.dataset.id;
            const type = btn.dataset.type; // 'thread' or 'reply'
            const route = type === 'thread' ? `/api/threads/${id}/react` : `/api/replies/${id}/react`;
            
            try {
                btn.disabled = true; // Çift tıklamayı engelle
                const response = await fetch(route, { method: 'POST', credentials: 'include' });
                const data = await response.json();
                
                if (response.ok) {
                    btn.textContent = `${data.action === 'liked' ? 'Beğenmekten Vazgeç' : 'Beğen'} (${data.like_count})`;
                    btn.classList.toggle('liked', data.action === 'liked');
                } else {
                    throw new Error(data.message);
                }
            } catch (error) {
                alert(`Hata: ${error.message}`);
            } finally {
                btn.disabled = false;
            }
        }
        
        // En İyi Cevap Butonu
        if (e.target.classList.contains('best-reply-btn')) {
            if (!isAdmin) return; // Sadece admin tetikleyebilir (backend kuralı)
            
            const replyId = e.target.dataset.replyId;
            if (!confirm('Bu cevabı "En İyi Cevap" olarak işaretlemek istediğinize emin misiniz?')) return;
            
            try {
                e.target.disabled = true;
                const response = await fetch(`/admin/posts/${threadId}/best-reply`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reply_id: replyId }),
                    credentials: 'include'
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    alert('En İyi Cevap başarıyla işaretlendi. Sayfa yenileniyor.');
                    window.location.reload();
                } else {
                    throw new Error(data.message);
                }
            } catch (error) {
                alert(`Hata: ${error.message}`);
                e.target.disabled = false;
            }
        }
    });

    // --- 6. ANA VERİ ÇEKME FONKSİYONU ---
    const fetchThread = async () => {
        try {
            const response = await fetch(`/api/threads/${threadId}?page=${page}`, { credentials: 'include' });
            if (!response.ok) {
                threadMainPost.innerHTML = `<p style="color:red;">Konu yüklenemedi. Ana sayfaya dönmek için <a href="/">tıklayın</a>.</p>`;
                return;
            }
            
            const data = await response.json();
            const { thread, replies, bestReply, pagination } = data;
            currentThread = thread; 
            pageTitle.textContent = DOMPurify.sanitize(thread.title); // Sayfa başlığını güncelle

            // Ana Konuyu Render Et
            const safeTitle = DOMPurify.sanitize(thread.title);
            const safeContent = DOMPurify.sanitize(thread.content);
            threadMainPost.innerHTML = `
                <div class="post-card original-post">
                    ${renderAuthorInfo(
                        thread.author_username, 
                        thread.author_avatar, 
                        thread.author_title, 
                        thread.author_post_count, 
                        thread.author_join_date
                    )}
                    <div class="post-content">
                        <h2 class="thread-title">${safeTitle}</h2>
                        ${thread.is_locked ? '<span class="locked-badge">🔒 KİLİTLİ</span>' : ''}
                        ${thread.is_pinned ? '<span class="pinned-badge">⭐ SABİTLENMİŞ</span>' : ''}
                        
                        <div class="post-body ql-editor">${safeContent}</div>
                        
                        <div class="post-footer">
                            ${renderPostActions(thread, 'thread', userId)}
                        </div>
                    </div>
                </div>
            `;
            
            // Admin butonlarını render et
            renderAdminControls(thread);

            repliesContainer.innerHTML = ''; // Cevapları temizle

            // En İyi Cevabı Render Et
            if (bestReply) {
                const bestReplyElement = document.createElement('div');
                bestReplyElement.classList.add('post-card', 'reply', 'best-reply');
                bestReplyElement.id = `reply-${bestReply.id}`; // ID ekle
                const safeReplyContent = DOMPurify.sanitize(bestReply.content);
                
                bestReplyElement.innerHTML = `
                    ${renderAuthorInfo(
                        bestReply.author_username, 
                        bestReply.author_avatar, 
                        bestReply.author_title, 
                        bestReply.author_post_count, 
                        bestReply.author_join_date
                    )}
                    <div class="post-content">
                        <div class="best-reply-badge">⭐ En İyi Cevap</div>
                        <div class="post-body ql-editor">${safeReplyContent}</div>
                        <div class="post-footer">
                            ${renderPostActions(bestReply, 'reply', userId)}
                        </div>
                    </div>
                `;
                repliesContainer.appendChild(bestReplyElement);
            }

            // Diğer Cevapları Render Et
            if (replies.length > 0) {
                repliesHeader.textContent = `Cevaplar (${pagination.totalReplies})`;
                
                replies.forEach(reply => {
                    // Eğer bu cevap zaten en iyi cevap olarak render edildiyse, atla
                    if (bestReply && reply.id === bestReply.id) return; 
                    
                    const replyElement = document.createElement('div');
                    replyElement.classList.add('post-card', 'reply');
                    replyElement.id = `reply-${reply.id}`; // ID ekle
                    const safeReplyContent = DOMPurify.sanitize(reply.content);
                    
                    // "En İyi Cevap" seçme butonu için mantık
                    let bestReplyButton = '';
                    
                    // DÜZELTİLDİ: Artık sadece admin olması yeterli (backend kuralı)
                    // Ve henüz bir en iyi cevap seçilmemişse
                    if (isAdmin && !thread.best_reply_id) {
                         bestReplyButton = `<button class="best-reply-btn" data-reply-id="${reply.id}">En İyi Cevap Seç</button>`;
                    }

                    replyElement.innerHTML = `
                        ${renderAuthorInfo(
                            reply.author_username, 
                            reply.author_avatar, 
                            reply.author_title, 
                            reply.author_post_count, 
                            reply.author_join_date
                        )}
                        <div class="post-content">
                            <div class="post-body ql-editor">${safeReplyContent}</div>
                            <div class="post-footer">
                                ${renderPostActions(reply, 'reply', userId)}
                                ${bestReplyButton}
                            </div>
                        </div>
                    `;
                    repliesContainer.appendChild(replyElement);
                });
            } else if (!bestReply) {
                repliesHeader.textContent = 'Henüz cevap yazılmamış.';
            }

            // Sayfalamayı Render Et
            renderPagination(pagination);
            
            // Cevap Formunu Render Et
            renderReplyForm(thread);

        } catch (error) {
            console.error(error);
            pageTitle.textContent = "Hata";
            threadMainPost.innerHTML = `<p style="color:red;">Hata: Konu yüklenirken bir sorun oluştu.</p>`;
        }
    };
    
    // --- 7. BAŞLANGIÇ ---
    fetchThread();
});