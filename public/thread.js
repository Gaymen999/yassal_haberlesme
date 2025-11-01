document.addEventListener('DOMContentLoaded', () => {
    const threadContainer = document.getElementById('thread-container');
    const replyFormContainer = document.getElementById('reply-form-container');
    const loadingMessage = document.getElementById('loading-message');
    
    let currentUserIsAdmin = false;
    let currentThread = null; // YENİ: Konu bilgisini globalde tut

    const params = new URLSearchParams(window.location.search);
    const threadId = params.get('id');

    if (!threadId) {
        threadContainer.innerHTML = '<h2 style="color:red;">Hata: Konu ID bulunamadı.</h2>';
        return;
    }

    const fetchThreadAndReplies = async () => {
        try {
            const response = await fetch(`/api/threads/${threadId}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                if(response.status === 404) throw new Error('Konu bulunamadı.');
                throw new Error('Konu yüklenirken bir hata oluştu.');
            }

            const data = await response.json();
            const { thread, replies } = data;
            
            currentThread = thread; // YENİ: Konu bilgisini global değişkene ata

            document.title = thread.title;
            threadContainer.innerHTML = '';
            loadingMessage.style.display = 'none';

            await checkAuthAndRenderReplyForm(); // (Sıralama değişti)
            renderOriginalPost(thread);
            renderReplies(replies);

        } catch (error) {
            console.error(error);
            loadingMessage.textContent = `Hata: ${error.message}`;
            loadingMessage.style.color = 'red';
        }
    };
    
    // --- Yardımcı Fonksiyonlar ---

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

    // DEĞİŞTİ: renderOriginalPost
    function renderOriginalPost(thread) {
        const postElement = document.createElement('div');
        postElement.className = 'original-post post-layout'; 
        const date = new Date(thread.created_at).toLocaleString('tr-TR');
        const safeTitle = DOMPurify.sanitize(thread.title);
        const safeContent = DOMPurify.sanitize(thread.content);

        // YENİ: Kilit butonu metni
        const lockButtonText = thread.is_locked ? 'Kilidi Aç' : 'Konuyu Kilitle';

        const adminControls = currentUserIsAdmin ? `
            <div class="admin-actions-reply">
                <button class="lock-thread-btn" data-id="${thread.id}" data-locked="${thread.is_locked}" style="background-color: #f0ad4e;">
                    ${lockButtonText}
                </button>
                <button class="delete-thread-btn" data-id="${thread.id}">Konuyu Sil</button>
            </div>
        ` : '';

        // YENİ: Konu kilitliyse başlığa kilit ikonu ekle
        const lockIcon = thread.is_locked ? '🔒 ' : '';

        postElement.innerHTML = `
            ${renderUserProfile(thread)} 
            <div class="post-main-content"> 
                ${adminControls} 
                <h2>${lockIcon}${safeTitle}</h2> <p class="post-meta">
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
            // YENİ: Kilitleme butonu için olay dinleyici
            postElement.querySelector('.lock-thread-btn')?.addEventListener('click', (e) => {
                const threadId = e.target.dataset.id;
                const isLocked = e.target.dataset.locked === 'true';
                handleToggleLockThread(threadId, !isLocked); // Tersini gönder
            });
        }
    }
    
    function renderReplies(replies) { /* ... (içerik aynı) ... */ 
        const repliesContainer = document.createElement('div');
        repliesContainer.className = 'replies-container';
        
        if (replies.length === 0) {
            repliesContainer.innerHTML = '<h3>Bu konuya henüz cevap yazılmamış.</h3>';
        } else {
            repliesContainer.innerHTML = `<h3>Cevaplar (${replies.length})</h3>`;
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

    // DEĞİŞTİ: checkAuthAndRenderReplyForm
    async function checkAuthAndRenderReplyForm() {
        // YENİ: Konu kilitliyse formu hiç gösterme
        if (currentThread && currentThread.is_locked) {
            replyFormContainer.innerHTML = `
                <div class="locked-message">
                    🔒 Bu konu kilitlenmiştir. Yeni cevap yazılamaz.
                </div>
            `;
            // Admin yetkisini yine de almamız lazım (silme butonları için)
            try {
                const res = await fetch('/api/user-status', { credentials: 'include' });
                const data = await res.json();
                if (data.loggedIn && data.user.role === 'admin') {
                    currentUserIsAdmin = true;
                }
            } catch (error) { /* ignore */ }
            return; // Fonksiyondan çık
        }

        // Konu kilitli değilse, normal kontrolü yap
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
                        Cevap yazabilmek için <a href="/login.html?redirect=/thread.html?id=${threadId}">giriş yapmanız</a> gerekmektedir.
                    </p>
                `;
            }
        } catch (error) {
            console.error('Kullanıcı durumu kontrol hatası:', error);
            currentUserIsAdmin = false;
        }
    }

    function renderReplyForm() { /* ... (içerik aynı) ... */ 
        replyFormContainer.innerHTML = `
            <form id="reply-form" class="reply-form">
                <h3>Cevap Yaz</h3>
                <div class="form-group">
                    <textarea id="reply-content" rows="5" placeholder="Cevabınızı buraya yazın..." required></textarea>
                </div>
                <button type="submit" class="submit-btn">Cevabı Gönder</button>
                <p id="reply-message" class="form-message"></p>
            </form>
        `;
        document.getElementById('reply-form').addEventListener('submit', handleReplySubmit);
    }
    
    async function handleReplySubmit(e) { /* ... (içerik aynı) ... */ 
        e.preventDefault();
        const content = document.getElementById('reply-content').value;
        const messageElement = document.getElementById('reply-message');

        if (!content) { /* ... */ return; }

        try {
            const response = await fetch(`/api/threads/${threadId}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
                credentials: 'include'
            });

            const data = await response.json();
            
            if (response.ok) {
                window.location.reload(); 
            } else {
                // YENİ: Kilitli hatasını yakala
                if (response.status === 403) {
                    messageElement.textContent = 'Bu konu kilitlendiği için cevap gönderilemedi.';
                } else {
                    throw new Error(data.message || 'Cevap gönderilemedi.');
                }
            }

        } catch (error) {
            messageElement.textContent = error.message;
            messageElement.style.color = 'red';
        }
    }
    
    // (handleDeleteReply fonksiyonu aynı kaldı)
    async function handleDeleteReply(replyId) { /* ... (içerik aynı) ... */ 
        if (!confirm("Bu cevabı kalıcı olarak silmek istediğinizden emin misiniz?")) {
            return;
        }
        
        try {
            const response = await fetch(`/admin/replies/${replyId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

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
        } catch (error) {
            console.error('Cevap silme hatası:', error);
            alert('Sunucuya bağlanılamadı.');
        }
    }

    // (handleDeleteThread fonksiyonu aynı kaldı)
    async function handleDeleteThread(threadId, postTitle) { /* ... (içerik aynı) ... */ 
        if (!confirm(`DİKKAT! "${postTitle}" başlıklı konuyu ve TÜM CEVAPLARINI kalıcı olarak silmek istediğinizden emin misiniz?`)) {
            return;
        }
        
        try {
            const response = await fetch(`/admin/posts/${threadId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                alert('Konu ve tüm cevapları başarıyla silindi.');
                window.location.href = '/'; 
            } else {
                const data = await response.json();
                alert(`Silme işlemi başarısız: ${data.message || 'Sunucu hatası.'}`);
            }
        } catch (error) {
            console.error('Konu silme hatası:', error);
            alert('Sunucuya bağlanılamadı.');
        }
    }

    // YENİ: Konu Kilitleme/Açma Fonksiyonu
    async function handleToggleLockThread(threadId, newLockStatus) {
        const actionText = newLockStatus ? 'kilitlemek' : 'kilidini açmak';
        if (!confirm(`Bu konuyu ${actionText} istediğinizden emin misiniz?`)) {
            return;
        }

        try {
            const response = await fetch(`/admin/posts/${threadId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_locked: newLockStatus }),
                credentials: 'include'
            });

            if (response.ok) {
                alert(`Konu başarıyla ${newLockStatus ? 'kilitlendi' : 'kilidi açıldı'}.`);
                window.location.reload(); // Sayfayı yenile (buton ve formun güncellenmesi için)
            } else {
                const data = await response.json();
                alert(`İşlem başarısız: ${data.message || 'Sunucu hatası.'}`);
            }
        } catch (error) {
            console.error('Konu kilitleme hatası:', error);
            alert('Sunucuya bağlanılamadı.');
        }
    }

    // Ana fonksiyonu çalıştır
    fetchThreadAndReplies();
});