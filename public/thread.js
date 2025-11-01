document.addEventListener('DOMContentLoaded', () => {
    const threadContainer = document.getElementById('thread-container');
    const replyFormContainer = document.getElementById('reply-form-container');
    const loadingMessage = document.getElementById('loading-message');
    
    // YENİ: Admin yetkisini globalde tutmak için
    let currentUserIsAdmin = false;

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

            document.title = thread.title;
            threadContainer.innerHTML = '';
            loadingMessage.style.display = 'none';

            // ÖNCE: Giriş yapıp yapmadığını kontrol et (Admin yetkisini belirlemek için)
            // renderReplies fonksiyonu 'currentUserIsAdmin' değişkenine göre buton gösterecek
            await checkAuthAndRenderReplyForm();

            // SONRA: İçeriği render et
            renderOriginalPost(thread);
            renderReplies(replies);

        } catch (error) {
            console.error(error);
            loadingMessage.textContent = `Hata: ${error.message}`;
            loadingMessage.style.color = 'red';
        }
    };
    
    // --- Yardımcı Fonksiyonlar ---

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

    function renderOriginalPost(thread) {
        const postElement = document.createElement('div');
        postElement.className = 'original-post post-layout'; 
        const date = new Date(thread.created_at).toLocaleString('tr-TR');
        const safeTitle = DOMPurify.sanitize(thread.title);
        const safeContent = DOMPurify.sanitize(thread.content);

        // YENİ: Admin ise Konuyu Sil/Kilitle butonları (Henüz sadece 'Sil' çalışıyor)
        const adminControls = currentUserIsAdmin ? `
            <div class="admin-actions-reply">
                <button class="delete-thread-btn" data-id="${thread.id}">Konuyu Sil</button>
            </div>
        ` : '';

        postElement.innerHTML = `
            ${renderUserProfile(thread)} 
            <div class="post-main-content"> 
                ${adminControls} <h2>${safeTitle}</h2>
                <p class="post-meta">
                    Tarih: ${date} | Kategori: <strong>${thread.category_name}</strong>
                </p>
                <div class="post-content">
                    ${safeContent}
                </div>
            </div>
        `;
        threadContainer.appendChild(postElement);
        
        // YENİ: Konu silme butonu için olay dinleyici
        if (currentUserIsAdmin) {
            postElement.querySelector('.delete-thread-btn')?.addEventListener('click', (e) => {
                const threadId = e.target.dataset.id;
                handleDeleteThread(threadId, safeTitle);
            });
        }
    }
    
    function renderReplies(replies) {
        const repliesContainer = document.createElement('div');
        repliesContainer.className = 'replies-container';
        
        if (replies.length === 0) {
            repliesContainer.innerHTML = '<h3>Bu konuya henüz cevap yazılmamış.</h3>';
        } else {
            repliesContainer.innerHTML = `<h3>Cevaplar (${replies.length})</h3>`;
            replies.forEach(reply => {
                const replyElement = document.createElement('div');
                replyElement.className = 'reply-card post-layout'; 
                replyElement.id = `reply-${reply.id}`; // YENİ: Cevabı DOM'dan silmek için ID
                
                const date = new Date(reply.created_at).toLocaleString('tr-TR');
                const safeContent = DOMPurify.sanitize(reply.content);
                
                // YENİ: Admin ise Cevabı Sil butonu
                const adminControls = currentUserIsAdmin ? `
                    <div class="admin-actions-reply">
                        <button class="delete-reply-btn" data-id="${reply.id}">Sil</button>
                    </div>
                ` : '';

                replyElement.innerHTML = `
                    ${renderUserProfile(reply)} 
                    <div class="post-main-content"> 
                        ${adminControls} <p class="reply-meta">Tarih: ${date}</p>
                        <div class="reply-content">
                            ${safeContent}
                        </div>
                    </div>
                `;
                repliesContainer.appendChild(replyElement);
            });
        }
        threadContainer.appendChild(repliesContainer);
        
        // YENİ: Tüm "Cevabı Sil" butonlarına olay dinleyici ekle
        if (currentUserIsAdmin) {
            repliesContainer.querySelectorAll('.delete-reply-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const replyId = e.target.dataset.id;
                    handleDeleteReply(replyId);
                });
            });
        }
    }

    // DEĞİŞTİ: Bu fonksiyon artık 'currentUserIsAdmin' değişkenini de ayarlıyor
    async function checkAuthAndRenderReplyForm() {
        try {
            const res = await fetch('/api/user-status', { credentials: 'include' });
            const data = await res.json();
            
            if (data.loggedIn) {
                // YENİ: Admin yetkisini kontrol et
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
            currentUserIsAdmin = false; // Hata durumunda yetkiyi kes
        }
    }

    function renderReplyForm() {
        // (Bu fonksiyonun içi aynı kaldı)
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
    
    async function handleReplySubmit(e) {
        // (Bu fonksiyonun içi aynı kaldı)
        e.preventDefault();
        const content = document.getElementById('reply-content').value;
        const messageElement = document.getElementById('reply-message');

        if (!content) {
            messageElement.textContent = 'Cevap boş olamaz.';
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
                window.location.reload(); 
            } else {
                throw new Error(data.message || 'Cevap gönderilemedi.');
            }

        } catch (error) {
            messageElement.textContent = error.message;
            messageElement.style.color = 'red';
        }
    }
    
    // YENİ: Cevap Silme Fonksiyonu
    async function handleDeleteReply(replyId) {
        if (!confirm("Bu cevabı kalıcı olarak silmek istediğinizden emin misiniz?")) {
            return;
        }
        
        try {
            const response = await fetch(`/admin/replies/${replyId}`, {
                method: 'DELETE',
                credentials: 'include' // Admin cookie'mizi gönder
            });

            if (response.ok) {
                // Sayfayı yenilemek yerine silinen cevabı DOM'dan kaldır
                const replyElement = document.getElementById(`reply-${replyId}`);
                if (replyElement) {
                    replyElement.style.opacity = '0'; // Silinme efekti
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

    // YENİ: Konu Silme Fonksiyonu (thread.html içinden)
    async function handleDeleteThread(threadId, postTitle) {
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
                // Konu silindiği için ana sayfaya yönlendir
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

    // Ana fonksiyonu çalıştır
    fetchThreadAndReplies();
});