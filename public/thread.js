document.addEventListener('DOMContentLoaded', () => {
    const threadContainer = document.getElementById('thread-container');
    const replyFormContainer = document.getElementById('reply-form-container');
    const loadingMessage = document.getElementById('loading-message');
    
    // 1. URL'den Konu (Thread) ID'sini al
    const params = new URLSearchParams(window.location.search);
    const threadId = params.get('id');

    if (!threadId) {
        threadContainer.innerHTML = '<h2 style="color:red;">Hata: Konu ID bulunamadı.</h2>';
        return;
    }

    // 2. API'den Konu ve Cevapları Çek
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

            // Sayfa başlığını güncelle
            document.title = thread.title;
            
            // Konteyneri temizle
            threadContainer.innerHTML = '';
            loadingMessage.style.display = 'none';

            // 3. Ana Konuyu (Original Post) Ekrana Bas
            renderOriginalPost(thread);

            // 4. Cevapları Ekrana Bas
            renderReplies(replies);

            // 5. Giriş yapılmışsa Cevap Formunu Göster
            checkAuthAndRenderReplyForm();

        } catch (error) {
            console.error(error);
            loadingMessage.textContent = `Hata: ${error.message}`;
            loadingMessage.style.color = 'red';
        }
    };
    
    // --- Yardımcı Fonksiyonlar ---

    function renderOriginalPost(thread) {
        const postElement = document.createElement('div');
        postElement.className = 'original-post';
        
        const date = new Date(thread.created_at).toLocaleString('tr-TR');
        
        // DOMPurify ile XSS Koruması
        const safeTitle = DOMPurify.sanitize(thread.title);
        const safeContent = DOMPurify.sanitize(thread.content);
        const safeAuthor = DOMPurify.sanitize(thread.author_email);

        postElement.innerHTML = `
            <h2>${safeTitle}</h2>
            <p class="post-meta">
                Yazan: <strong>${safeAuthor}</strong> | 
                Tarih: ${date} | 
                Kategori: <strong>${thread.category_name}</strong>
            </p>
            <div class="post-content">
                ${safeContent}
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
                replyElement.className = 'reply-card';
                
                const date = new Date(reply.created_at).toLocaleString('tr-TR');
                
                const safeContent = DOMPurify.sanitize(reply.content);
                const safeAuthor = DOMPurify.sanitize(reply.author_email);
                
                replyElement.innerHTML = `
                    <p class="reply-meta">
                        Yazan: <strong>${safeAuthor}</strong> | Tarih: ${date}
                    </p>
                    <div class="reply-content">
                        ${safeContent}
                    </div>
                `;
                repliesContainer.appendChild(replyElement);
            });
        }
        threadContainer.appendChild(repliesContainer);
    }

    async function checkAuthAndRenderReplyForm() {
        // global.js'nin kullandığı API'yi kullanarak giriş durumunu kontrol et
        try {
            const res = await fetch('/api/user-status', { credentials: 'include' });
            const data = await res.json();
            
            if (data.loggedIn) {
                // Giriş yapılmış, formu göster
                renderReplyForm();
            } else {
                // Giriş yapılmamış, "Cevap yazmak için giriş yap" linki göster
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

        // Forma submit olayı ekle
        document.getElementById('reply-form').addEventListener('submit', handleReplySubmit);
    }
    
    async function handleReplySubmit(e) {
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
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ content }),
                credentials: 'include'
            });

            const data = await response.json();
            
            if (response.ok) {
                messageElement.textContent = 'Cevap başarıyla eklendi!';
                messageElement.style.color = 'green';
                document.getElementById('reply-content').value = '';
                // Sayfayı yenilemek yerine yeni cevabı dinamik ekleyebiliriz,
                // ama en kolayı şimdilik sayfayı yenilemek:
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