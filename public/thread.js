// public/thread.js
document.addEventListener('DOMContentLoaded', () => {
    const threadContainer = document.getElementById('thread-container');
    const replyFormContainer = document.getElementById('reply-form-container');
    const loadingMessage = document.getElementById('loading-message');
    
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

            // DEĞİŞTİ: renderOriginalPost ve renderReplies
            renderOriginalPost(thread);
            renderReplies(replies);
            checkAuthAndRenderReplyForm();

        } catch (error) {
            console.error(error);
            loadingMessage.textContent = `Hata: ${error.message}`;
            loadingMessage.style.color = 'red';
        }
    };
    
    // --- Yardımcı Fonksiyonlar (DEĞİŞTİ) ---

    // Bu fonksiyon Technopat tarzı profil bilgisi ekler
    function renderUserProfile(author) {
        // Tarihleri formatla
        const joinDate = new Date(author.author_join_date).toLocaleDateString('tr-TR');
        
        // Güvenli hale getir
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
        // DEĞİŞTİ: Technopat tarzı 2 sütunlu yapı için class
        postElement.className = 'original-post post-layout'; 
        
        const date = new Date(thread.created_at).toLocaleString('tr-TR');
        
        const safeTitle = DOMPurify.sanitize(thread.title);
        const safeContent = DOMPurify.sanitize(thread.content);

        postElement.innerHTML = `
            ${renderUserProfile(thread)} <div class="post-main-content"> <h2>${safeTitle}</h2>
                <p class="post-meta">
                    Tarih: ${date} | Kategori: <strong>${thread.category_name}</strong>
                </p>
                <div class="post-content">
                    ${safeContent}
                </div>
            </div>
        `;
        threadContainer.appendChild(postElement);
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
                // DEĞİŞTİ: Class eklendi
                replyElement.className = 'reply-card post-layout'; 
                
                const date = new Date(reply.created_at).toLocaleString('tr-TR');
                const safeContent = DOMPurify.sanitize(reply.content);
                
                replyElement.innerHTML = `
                    ${renderUserProfile(reply)} <div class="post-main-content"> <p class="reply-meta">Tarih: ${date}</p>
                        <div class="reply-content">
                            ${safeContent}
                        </div>
                    </div>
                `;
                repliesContainer.appendChild(replyElement);
            });
        }
        threadContainer.appendChild(repliesContainer);
    }

    // (checkAuthAndRenderReplyForm ve handleReplySubmit fonksiyonları aynı kaldı)
    async function checkAuthAndRenderReplyForm() {
        // ... (Bu fonksiyonun içi aynı)
        try {
            const res = await fetch('/api/user-status', { credentials: 'include' });
            const data = await res.json();
            
            if (data.loggedIn) {
                renderReplyForm();
            } else {
                replyFormContainer.innerHTML = `
                    <p style="text-align:center; font-weight:bold;">
                        Cevap yazabilmek için <a href="/login.html?redirect=/thread.html?id=${threadId}">giriş yapmanız</a> gerekmektedir.
                    </p>
                `;
            }
        } catch (error) {
            console.error('Kullanıcı durumu kontrol hatası:', error);
        }
    }

    function renderReplyForm() {
        // ... (Bu fonksiyonun içi aynı)
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
        // ... (Bu fonksiyonun içi aynı)
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
                messageElement.textContent = 'Cevap başarıyla eklendi!';
                messageElement.style.color = 'green';
                document.getElementById('reply-content').value = '';
                window.location.reload(); 
            } else {
                throw new Error(data.message || 'Cevap gönderilemedi.');
            }

        } catch (error) {
            messageElement.textContent = error.message;
            messageElement.style.color = 'red';
        }
    }

    // Ana fonksiyonu çalıştır
    fetchThreadAndReplies();
});