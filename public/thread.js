document.addEventListener('DOMContentLoaded', () => {
    const threadContainer = document.getElementById('thread-container');
    const replyFormContainer = document.getElementById('reply-form-container');
    const loadingMessage = document.getElementById('loading-message');
    
    let currentUserIsAdmin = false;
    let currentUserId = null; // YENİ: Giriş yapan kullanıcının ID'si
    let currentThread = null; 
    const params = new URLSearchParams(window.location.search);
    const threadId = params.get('id');
    const currentPage = parseInt(params.get('page'), 10) || 1;
    let replyQuill = null; 
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
            const { thread, replies, pagination, bestReply } = data; 
            
            currentThread = thread; 
            document.title = thread.title;
            threadContainer.innerHTML = ''; 
            loadingMessage.style.display = 'none';

            await checkAuthAndRenderReplyForm(); // (Kullanıcı ID'sini ve admin durumunu alır)
            
            renderPagination(pagination, "top"); 
            renderOriginalPost(thread);
            if (bestReply && currentPage === 1) {
                renderBestAnswerBox(bestReply);
            }
            renderReplies(replies, bestReply ? bestReply.id : null); 
            renderPagination(pagination, "bottom"); 

            // YENİ: Oluşturulan tüm reaksiyon butonlarına olay dinleyici ekle
            attachReactionListeners(threadContainer);

        } catch (error) {
            console.error(error);
            loadingMessage.textContent = `Hata: ${error.message}`;
            loadingMessage.style.color = 'red';
        }
    };
    
    // --- Yardımcı Fonksiyonlar ---

    // (renderUserProfile fonksiyonu aynı kaldı)
    function renderUserProfile(author) { 
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

    // YENİ: Reaksiyon Çubuğu HTML'i oluşturan fonksiyon
    function renderReactionArea(post, postType) {
        // API'den gelen verileri al
        const likeCount = post.like_count ? parseInt(post.like_count, 10) : 0;
        const likedByArray = post.liked_by_users || []; // (SQL null dönerse boş dizi yap)
        
        // Giriş yapan kullanıcı bu postu beğenmiş mi?
        const userHasLiked = currentUserId ? likedByArray.includes(currentUserId) : false;
        
        const likeButtonText = userHasLiked ? 'Beğenildi' : 'Beğen';
        const likeButtonClass = userHasLiked ? 'like-btn liked' : 'like-btn';
        // Giriş yapmadıysa butonu devre dışı bırak
        const disabledAttr = currentUserId ? '' : 'disabled'; 

        return `
            <div class="reaction-bar">
                <button class="${likeButtonClass}" 
                        data-post-id="${post.id}" 
                        data-post-type="${postType}" 
                        ${disabledAttr}>
                    👍 ${likeButtonText}
                </button>
                <span class="like-count">${likeCount}</span>
            </div>
        `;
    }

    // DEĞİŞTİ: renderOriginalPost (Reaksiyon çubuğu eklendi)
    function renderOriginalPost(thread) {
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
                ${renderReactionArea(thread, 'thread')}
            </div>
        `;
        threadContainer.appendChild(postElement);
        // (Admin olay dinleyicileri aynı kaldı)
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

    // DEĞİŞTİ: renderBestAnswerBox (Reaksiyon çubuğu eklendi)
    function renderBestAnswerBox(bestReply) {
        const bestAnswerContainer = document.createElement('div');
        bestAnswerContainer.className = 'best-answer-box post-layout';
        bestAnswerContainer.id = `best-reply-${bestReply.id}`;

        const date = new Date(bestReply.created_at).toLocaleString('tr-TR');
        const safeContent = DOMPurify.sanitize(bestReply.content);
        
        bestAnswerContainer.innerHTML = `
            ${renderUserProfile(bestReply)} 
            <div class="post-main-content"> 
                <h3 class="best-answer-title">✅ En İyi Cevap</h3>
                <p class="reply-meta">Tarih: ${date}</p>
                <div class="reply-content">
                    ${safeContent}
                </div>
                ${renderReactionArea(bestReply, 'reply')}
            </div>
        `;
        threadContainer.appendChild(bestAnswerContainer);
    }

    
    // DEĞİŞTİ: renderReplies (Reaksiyon çubuğu eklendi)
    function renderReplies(replies, bestReplyId) { 
        const repliesContainer = document.createElement('div');
        repliesContainer.className = 'replies-container';
        
        const filteredReplies = replies.filter(reply => reply.id !== bestReplyId);

        if (filteredReplies.length === 0) {
            if (currentPage === 1 && !bestReplyId) { 
                repliesContainer.innerHTML = '<h3>Bu konuya henüz cevap yazılmamış.</h3>';
            } else if (filteredReplies.length === 0) { 
                repliesContainer.innerHTML = '<h3>Bu sayfada başka cevap bulunmuyor.</h3>';
            }
        } else {
            repliesContainer.innerHTML = `<h3>Cevaplar</h3>`;
            filteredReplies.forEach(reply => {
                const replyElement = document.createElement('div');
                replyElement.className = 'reply-card post-layout'; 
                replyElement.id = `reply-${reply.id}`; 
                
                const date = new Date(reply.created_at).toLocaleString('tr-TR');
                const safeContent = DOMPurify.sanitize(reply.content);
                
                let adminControls = '';
                if (currentUserIsAdmin) {
                    const isCurrentBest = (reply.id === currentThread.best_reply_id);
                    const bestAnswerButton = isCurrentBest 
                        ? `<button class="unmark-best-btn" data-thread-id="${currentThread.id}" data-reply-id="null">İşareti Kaldır</button>`
                        : `<button class="mark-best-btn" data-thread-id="${currentThread.id}" data-reply-id="${reply.id}">En İyi Cevap Yap</button>`;

                    adminControls = `
                        <div class="admin-actions-reply">
                            ${bestAnswerButton}
                            <button class="delete-reply-btn" data-id="${reply.id}">Sil</button>
                        </div>
                    `;
                }

                replyElement.innerHTML = `
                    ${renderUserProfile(reply)} 
                    <div class="post-main-content"> 
                        ${adminControls} 
                        <p class="reply-meta">Tarih: ${date}</p>
                        <div class="reply-content">
                            ${safeContent}
                        </div>
                        ${renderReactionArea(reply, 'reply')}
                    </div>
                `;
                repliesContainer.appendChild(replyElement);
            });
        }
        threadContainer.appendChild(repliesContainer);
        
        // (Admin buton dinleyicileri aynı kaldı)
        if (currentUserIsAdmin) {
            repliesContainer.querySelectorAll('.delete-reply-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const replyId = e.target.dataset.id;
                    handleDeleteReply(replyId);
                });
            });
            repliesContainer.querySelectorAll('.mark-best-btn, .unmark-best-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const threadId = e.target.dataset.threadId;
                    const replyId = e.target.dataset.replyId === 'null' ? null : parseInt(e.target.dataset.replyId, 10);
                    handleMarkAsBest(threadId, replyId);
                });
            });
        }
    }
    
    // (renderPagination aynı kaldı)
    function renderPagination(pagination, position) { /* ... (içerik aynı) ... */ 
        const { currentPage, totalPages } = pagination;
        if (totalPages <= 1) return; 
        const paginationNav = document.createElement('nav');
        paginationNav.className = 'pagination';
        paginationNav.dataset.position = position; 
        let paginationHTML = '';
        if (currentPage > 1) paginationHTML += `<a href="/thread.html?id=${threadId}&page=${currentPage - 1}" class="page-link prev">Önceki</a>`;
        if (currentPage > 2) {
             paginationHTML += `<a href="/thread.html?id=${threadId}&page=1" class="page-link">1</a>`;
             if (currentPage > 3) paginationHTML += `<span class="page-dots">...</span>`;
        }
        if (currentPage > 1) paginationHTML += `<a href="/thread.html?id=${threadId}&page=${currentPage - 1}" class="page-link">${currentPage - 1}</a>`;
        paginationHTML += `<span class="page-link current">${currentPage}</span>`;
        if (currentPage < totalPages) paginationHTML += `<a href="/thread.html?id=${threadId}&page=${currentPage + 1}" class="page-link">${currentPage + 1}</a>`;
        if (currentPage < totalPages - 1) {
            if (currentPage < totalPages - 2) paginationHTML += `<span class="page-dots">...</span>`;
            paginationHTML += `<a href="/thread.html?id=${threadId}&page=${totalPages}" class="page-link">${totalPages}</a>`;
        }
        if (currentPage < totalPages) paginationHTML += `<a href="/thread.html?id=${threadId}&page=${currentPage + 1}" class="page-link next">Sonraki</a>`;
        paginationNav.innerHTML = paginationHTML;
        if(position === 'top') threadContainer.insertAdjacentElement('beforebegin', paginationNav);
        else threadContainer.insertAdjacentElement('afterend', paginationNav);
    }

    // DEĞİŞTİ: checkAuthAndRenderReplyForm (currentUserId eklendi)
    async function checkAuthAndRenderReplyForm() { 
        if (currentThread && currentThread.is_locked) {
            replyFormContainer.innerHTML = `<div class="locked-message">🔒 Bu konu kilitlenmiştir. Yeni cevap yazılamaz.</div>`;
            try {
                const res = await fetch('/api/user-status', { credentials: 'include' });
                const data = await res.json();
                if (data.loggedIn) {
                    currentUserId = data.user.id; // YENİ
                    if (data.user.role === 'admin') currentUserIsAdmin = true;
                }
            } catch (error) { /* ignore */ }
            return; 
        }
        try {
            const res = await fetch('/api/user-status', { credentials: 'include' });
            const data = await res.json();
            if (data.loggedIn) {
                currentUserId = data.user.id; // YENİ
                if (data.user.role === 'admin') currentUserIsAdmin = true;
                renderReplyForm();
            } else {
                currentUserId = null; // YENİ
                currentUserIsAdmin = false;
                replyFormContainer.innerHTML = `<p style="text-align:center; font-weight:bold;">Beğenmek ve cevap yazabilmek için <a href="/login.html?redirect=/thread.html?id=${threadId}&page=${currentPage}">giriş yapmanız</a> gerekmektedir.</p>`;
            }
        } catch (error) { console.error('Kullanıcı durumu kontrol hatası:', error); currentUserIsAdmin = false; }
    }

    // (renderReplyForm ve handleReplySubmit aynı kaldı)
    function renderReplyForm() { /* ... (içerik aynı) ... */ 
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
        replyQuill = new Quill('#reply-editor-container', {
            modules: { toolbar: replyToolbarOptions },
            theme: 'snow',
            placeholder: 'Cevabınızı buraya yazın...'
        });
        document.getElementById('reply-form').addEventListener('submit', handleReplySubmit);
    }
    async function handleReplySubmit(e) { /* ... (içerik aynı) ... */ 
        e.preventDefault();
        const messageElement = document.getElementById('reply-message');
        const content = replyQuill.root.innerHTML; 
        if (!content || content === '<p><br></p>' || content.length < 10) { 
            messageElement.textContent = 'Cevap en az 10 karakter olmalıdır.';
            messageElement.style.color = 'red';
            return; 
        }
        try {
            const response = await fetch(`/api/threads/${threadId}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
                credentials: 'include'
            });
            const data = await response.json();
            if (response.ok) {
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
    
    // (Tüm admin fonksiyonları aynı kaldı)
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
    async function handleMarkAsBest(threadId, replyId) { /* ... (içerik aynı) ... */ 
        const actionText = replyId ? 'işaretlemek' : 'işaretini kaldırmak';
        if (!confirm(`Bu cevabı "En İyi Cevap" olarak ${actionText} istediğinizden emin misiniz?`)) return;
        try {
            const response = await fetch('/admin/mark-best-reply', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ threadId, replyId }),
                credentials: 'include'
            });
            if (response.ok) {
                alert('En İyi Cevap başarıyla güncellendi.');
                window.location.reload(); 
            } else {
                const data = await response.json();
                alert(`İşlem başarısız: ${data.message || 'Sunucu hatası.'}`);
            }
        } catch (error) { console.error('En İyi Cevap işaretleme hatası:', error); alert('Sunucuya bağlanılamadı.'); }
    }


    // YENİ: Reaksiyon Butonları İçin Olay Dinleyici Ekleme
    function attachReactionListeners(container) {
        container.querySelectorAll('.like-btn').forEach(btn => {
            btn.addEventListener('click', handleReaction);
        });
    }

    // YENİ: Reaksiyon API'sini Çağıran Ana Fonksiyon
    async function handleReaction(e) {
        const button = e.target;
        if (button.disabled) return; // Zaten giriş yapılmamışsa disabled'dır

        const postId = button.dataset.postId;
        const postType = button.dataset.postType;

        if (!postId || !postType) return;

        const apiUrl = postType === 'thread' 
            ? `/api/threads/${postId}/react` 
            : `/api/replies/${postId}/react`;

        button.disabled = true; // Çift tıklamayı engelle

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                credentials: 'include',
                headers: {'Content-Type': 'application/json'}
                // Body'ye şimdilik gerek yok, 'like' varsayılan
            });

            if (!response.ok) {
                // Giriş yapılmamışsa (cookie yoksa) API 401 döndürür
                if (response.status === 401) {
                    alert('Beğenmek için giriş yapmalısınız.');
                    window.location.href = `/login.html?redirect=/thread.html?id=${threadId}&page=${currentPage}`;
                }
                throw new Error('Reaksiyon başarısız.');
            }

            const data = await response.json();
            
            // Butonu ve sayacı anlık güncelle
            const likeCountElement = button.nextElementSibling;
            let currentCount = parseInt(likeCountElement.textContent, 10);

            if (data.liked) {
                button.textContent = '👍 Beğenildi';
                button.classList.add('liked');
                likeCountElement.textContent = currentCount + 1;
            } else {
                button.textContent = '👍 Beğen';
                button.classList.remove('liked');
                likeCountElement.textContent = currentCount - 1;
            }

            button.disabled = false;
        } catch (error) {
            console.error('Reaksiyon hatası:', error);
            button.disabled = false;
        }
    }

    // Ana fonksiyonu çalıştır
    fetchThreadAndReplies();
});