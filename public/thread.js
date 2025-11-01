document.addEventListener('DOMContentLoaded', () => {
    const threadContainer = document.getElementById('thread-container');
    const replyFormContainer = document.getElementById('reply-form-container');
    const loadingMessage = document.getElementById('loading-message');
    
    let currentUserIsAdmin = false;
    let currentThread = null; 
    const params = new URLSearchParams(window.location.search);
    const threadId = params.get('id');
    const currentPage = parseInt(params.get('page'), 10) || 1;

    // YENİ: Cevap editörünü (Quill) globalde tutmak için
    let replyQuill = null; 
    // YENİ: Cevaplar için daha basit bir toolbar
    const replyToolbarOptions = [
        ['bold', 'italic', 'underline', 'strike'],
        ['blockquote', 'code-block'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link', 'image'],
        ['clean']
    ];

    if (!threadId) {
        threadContainer.innerHTML = '<h2 style="color:red;">Hata: Konu ID bulunamadı.</h2>';
        return;
    }

    const fetchThreadAndReplies = async () => {
        try {
            const response = await fetch(`/api/threads/${threadId}?page=${currentPage}`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Konu yüklenirken bir hata oluştu.');

            const data = await response.json();
            const { thread, replies, pagination } = data; 
            
            currentThread = thread; 
            document.title = thread.title;
            threadContainer.innerHTML = ''; 
            loadingMessage.style.display = 'none';

            await checkAuthAndRenderReplyForm(); 
            renderPagination(pagination, "top"); // Üst sayfalama
            renderOriginalPost(thread);
            renderReplies(replies);
            renderPagination(pagination, "bottom"); // Alt sayfalama

        } catch (error) {
            console.error(error);
            loadingMessage.textContent = `Hata: ${error.message}`;
            loadingMessage.style.color = 'red';
        }
    };
    
    // (renderUserProfile, renderOriginalPost, renderReplies fonksiyonları aynı kaldı)
    function renderUserProfile(author) { /* ... (içerik aynı) ... */ 
        const joinDate = new Date(author.author_join_date).toLocaleDateString('tr-TR');
        const safeUsername = DOMPurify.sanitize(author.author_username);
        const safeAvatar = DOMPurify.sanitize(author.author_avatar);
        const safeTitle = DOMPurify.sanitize(author.author_title);
        const safePostCount = DOMPurify.sanitize(author.author_post_count);

        return `
            <div class="user-profile-sidebar">
                <img src="${safeAvatar}" alt="${safeUsername} Avatar" class="avatar">
                <strong class="username">${safeUsername}</strong>
                <span class="user-title">${safeTitle}</span>
                <hr>
                <span class="user-stat">Katılım: ${joinDate}</span>
                <span class="user-stat">Mesaj: ${safePostCount}</span>
            </div>
        `;
    }
    function renderOriginalPost(thread) { /* ... (içerik aynı) ... */ 
        const postElement = document.createElement('div');
        postElement.className = 'original-post post-layout'; 
        const date = new Date(thread.created_at).toLocaleString('tr-TR');
        const safeTitle = DOMPurify.sanitize(thread.title);
        const safeContent = DOMPurify.sanitize(thread.content);
        const lockButtonText = thread.is_locked ? 'Kilidi Aç' : 'Konuyu Kilitle';

        const adminControls = currentUserIsAdmin ? `
            <div class="admin-actions-reply">
                <button class="lock-thread-btn" data-id="${thread.id}" data-locked="${thread.is_locked}" style="background-color: #f0ad4e;">
                    ${lockButtonText}
                </button>
                <button class="delete-thread-btn" data-id="${thread.id}">Konuyu Sil</button>
            </div>
        ` : '';
        const lockIcon = thread.is_locked ? '🔒 ' : '';
        postElement.innerHTML = `
            ${renderUserProfile(thread)} 
            <div class="post-main-content"> 
                ${adminControls} 
                <h2>${lockIcon}${safeTitle}</h2> 
                <p class="post-meta">
                    Tarih: ${date} | Kategori: <strong>${thread.category_name}</strong>
                </p>
                <div class="post-content">
                    ${safeContent}
                </div>
            </div>
        `;
        threadContainer.appendChild(postElement);
        if (currentUserIsAdmin) {
            postElement.querySelector('.delete-thread-btn')?.addEventListener('click', (e) => {
                const threadId = e.target.dataset.id;
                handleDeleteThread(threadId, safeTitle);
            });
            postElement.querySelector('.lock-thread-btn')?.addEventListener('click', (e) => {
                const threadId = e.target.dataset.id;
                const isLocked = e.target.dataset.locked === 'true';
                handleToggleLockThread(threadId, !isLocked); 
            });
        }
    }
    function renderReplies(replies) { /* ... (içerik aynı) ... */ 
        const repliesContainer = document.createElement('div');
        repliesContainer.className = 'replies-container';
        
        if (replies.length === 0) {
            if (currentPage === 1) {
                repliesContainer.innerHTML = '<h3>Bu konuya henüz cevap yazılmamış.</h3>';
            } else {
                 repliesContainer.innerHTML = '<h3>Bu sayfada cevap bulunmuyor.</h3>';
            }
        } else {
            repliesContainer.innerHTML = `<h3>Cevaplar</h3>`;
            replies.forEach(reply => {
                const replyElement = document.createElement('div');
                replyElement.className = 'reply-card post-layout'; 
                replyElement.id = `reply-${reply.id}`; 
                const date = new Date(reply.created_at).toLocaleString('tr-TR');
                const safeContent = DOMPurify.sanitize(reply.content);
                const adminControls = currentUserIsAdmin ? `
                    <div class="admin-actions-reply">
                        <button class="delete-reply-btn" data-id="${reply.id}">Sil</button>
                    </div>
                ` : '';
                replyElement.innerHTML = `
                    ${renderUserProfile(reply)} 
                    <div class="post-main-content"> 
                        ${adminControls} 
                        <p class="reply-meta">Tarih: ${date}</p>
                        <div class="reply-content">
                            ${safeContent}
                        </div>
                    </div>
                `;
                repliesContainer.appendChild(replyElement);
            });
        }
        threadContainer.appendChild(repliesContainer);
        if (currentUserIsAdmin) {
            repliesContainer.querySelectorAll('.delete-reply-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const replyId = e.target.dataset.id;
                    handleDeleteReply(replyId);
                });
            });
        }
    }
    
    // (renderPagination fonksiyonu aynı kaldı, sadece container.appendChild yerine 
    // threadContainer.insertAdjacentElement kullandım daha temiz olsun diye)
    function renderPagination(pagination, position) {
        const { currentPage, totalPages } = pagination;
        if (totalPages <= 1) return; 

        const paginationNav = document.createElement('nav');
        paginationNav.className = 'pagination';
        paginationNav.dataset.position = position; // 'top' or 'bottom'
        
        let paginationHTML = '';
        if (currentPage > 1) {
            paginationHTML += `<a href="/thread.html?id=${threadId}&page=${currentPage - 1}" class="page-link prev">Önceki</a>`;
        }
        if (currentPage > 2) {
             paginationHTML += `<a href="/thread.html?id=${threadId}&page=1" class="page-link">1</a>`;
             if (currentPage > 3) paginationHTML += `<span class="page-dots">...</span>`;
        }
        if (currentPage > 1) {
             paginationHTML += `<a href="/thread.html?id=${threadId}&page=${currentPage - 1}" class="page-link">${currentPage - 1}</a>`;
        }
        paginationHTML += `<span class="page-link current">${currentPage}</span>`;
        if (currentPage < totalPages) {
            paginationHTML += `<a href="/thread.html?id=${threadId}&page=${currentPage + 1}" class="page-link">${currentPage + 1}</a>`;
        }
        if (currentPage < totalPages - 1) {
            if (currentPage < totalPages - 2) paginationHTML += `<span class="page-dots">...</span>`;
            paginationHTML += `<a href="/thread.html?id=${threadId}&page=${totalPages}" class="page-link">${totalPages}</a>`;
        }
        if (currentPage < totalPages) {
            paginationHTML += `<a href="/thread.html?id=${threadId}&page=${currentPage + 1}" class="page-link next">Sonraki</a>`;
        }
        paginationNav.innerHTML = paginationHTML;
        
        if(position === 'top') {
            threadContainer.insertAdjacentElement('beforebegin', paginationNav);
        } else {
            threadContainer.insertAdjacentElement('afterend', paginationNav);
        }
    }

    // (checkAuthAndRenderReplyForm fonksiyonu aynı kaldı)
    async function checkAuthAndRenderReplyForm() {
        if (currentThread && currentThread.is_locked) {
            replyFormContainer.innerHTML = `
                <div class="locked-message">
                    🔒 Bu konu kilitlenmiştir. Yeni cevap yazılamaz.
                </div>
            `;
            try {
                const res = await fetch('/api/user-status', { credentials: 'include' });
                const data = await res.json();
                if (data.loggedIn && data.user.role === 'admin') {
                    currentUserIsAdmin = true;
                }
            } catch (error) { /* ignore */ }
            return; 
        }
        try {
            const res = await fetch('/api/user-status', { credentials: 'include' });
            const data = await res.json();
            if (data.loggedIn) {
                if (data.user.role === 'admin') {
                    currentUserIsAdmin = true;
                }
                renderReplyForm();
            } else {
                currentUserIsAdmin = false;
                replyFormContainer.innerHTML = `
                    <p style="text-align:center; font-weight:bold;">
                        Cevap yazabilmek için <a href="/login.html?redirect=/thread.html?id=${threadId}&page=${currentPage}">giriş yapmanız</a> gerekmektedir.
                    </p>
                `;
            }
        } catch (error) {
            console.error('Kullanıcı durumu kontrol hatası:', error);
            currentUserIsAdmin = false;
        }
    }

    // DEĞİŞTİ: renderReplyForm
    function renderReplyForm() { 
        replyFormContainer.innerHTML = `
            <form id="reply-form" class="reply-form">
                <h3>Cevap Yaz</h3>
                <div class="form-group">
                    <div id="reply-editor-container" style="background-color: white; height: 200px;"></div>
                </div>
                <button type="submit" class="submit-btn">Cevabı Gönder</button>
                <p id="reply-message" class="form-message"></p>
            </form>
        `;
        
        // YENİ: Quill editörünü başlat
        replyQuill = new Quill('#reply-editor-container', {
            modules: {
                toolbar: replyToolbarOptions
            },
            theme: 'snow',
            placeholder: 'Cevabınızı buraya yazın...'
        });

        document.getElementById('reply-form').addEventListener('submit', handleReplySubmit);
    }
    
    // DEĞİŞTİ: handleReplySubmit
    async function handleReplySubmit(e) { 
        e.preventDefault();
        const messageElement = document.getElementById('reply-message');
        
        // YENİ: İçeriği Quill editöründen al
        const content = replyQuill.root.innerHTML; 

        // YENİ: Boş içerik kontrolü
        if (!content || content === '<p><br></p>' || content.length < 10) { 
            messageElement.textContent = 'Cevap en az 10 karakter olmalıdır.';
            messageElement.style.color = 'red';
            return; 
        }

        try {
            const response = await fetch(`/api/threads/${threadId}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }), // HTML içeriği gönder
                credentials: 'include'
            });

            const data = await response.json();
            
            if (response.ok) {
                // Son sayfaya yönlendir (Aynı kaldı)
                window.location.href = `/thread.html?id=${threadId}&page=${data.lastPage}#reply-${data.reply.id}`;
            } else {
                if (response.status === 403) {
                    messageElement.textContent = 'Bu konu kilitlendiği için cevap gönderilemedi.';
                    messageElement.style.color = 'red';
                } else {
                    throw new Error(data.message || 'Cevap gönderilemedi.');
                }
            }
        } catch (error) {
            messageElement.textContent = error.message;
            messageElement.style.color = 'red';
        }
    }
    
    // (handleDeleteReply, handleDeleteThread, handleToggleLockThread fonksiyonları aynı kaldı)
    async function handleDeleteReply(replyId) { /* ... (içerik aynı) ... */ 
        if (!confirm("Bu cevabı kalıcı olarak silmek istediğinizden emin misiniz?")) return;
        try {
            const response = await fetch(`/admin/replies/${replyId}`, { method: 'DELETE', credentials: 'include' });
            if (response.ok) {
                const replyElement = document.getElementById(`reply-${replyId}`);
                if (replyElement) {
                    replyElement.style.opacity = '0';
                    setTimeout(() => replyElement.remove(), 300);
                }
            } else {
                const data = await response.json();
                alert(`Silme işlemi başarısız: ${data.message || 'Sunucu hatası.'}`);
            }
        } catch (error) { console.error('Cevap silme hatası:', error); alert('Sunucuya bağlanılamadı.'); }
    }
    async function handleDeleteThread(threadId, postTitle) { /* ... (içerik aynı) ... */ 
        if (!confirm(`DİKKAT! "${postTitle}" başlıklı konuyu ve TÜM CEVAPLARINI kalıcı olarak silmek istediğinizden emin misiniz?`)) return;
        try {
            const response = await fetch(`/admin/posts/${threadId}`, { method: 'DELETE', credentials: 'include' });
            if (response.ok) {
                alert('Konu ve tüm cevapları başarıyla silindi.');
                window.location.href = '/'; 
            } else {
                const data = await response.json();
                alert(`Silme işlemi başarısız: ${data.message || 'Sunucu hatası.'}`);
            }
        } catch (error) { console.error('Konu silme hatası:', error); alert('Sunucuya bağlanılamadı.'); }
    }
    async function handleToggleLockThread(threadId, newLockStatus) { /* ... (içerik aynı) ... */ 
        const actionText = newLockStatus ? 'kilitlemek' : 'kilidini açmak';
        if (!confirm(`Bu konuyu ${actionText} istediğinizden emin misiniz?`)) return;
        try {
            const response = await fetch(`/admin/posts/${threadId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_locked: newLockStatus }),
                credentials: 'include'
            });
            if (response.ok) {
                alert(`Konu başarıyla ${newLockStatus ? 'kilitlendi' : 'kilidi açıldı'}.`);
                window.location.reload(); 
            } else {
                const data = await response.json();
                alert(`İşlem başarısız: ${data.message || 'Sunucu hatası.'}`);
            }
        } catch (error) { console.error('Konu kilitleme hatası:', error); alert('Sunucuya bağlanılamadı.'); }
    }

    // Ana fonksiyonu çalıştır
    fetchThreadAndReplies();
});