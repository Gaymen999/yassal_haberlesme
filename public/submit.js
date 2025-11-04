// public/submit.js

document.addEventListener('DOMContentLoaded', () => {
    const submitForm = document.getElementById('submit-form');
    const titleInput = document.getElementById('title');
    const messageElement = document.getElementById('message');
    const categorySelect = document.getElementById('category-select');

    // Quill editör ayarları (Aynı)
    const toolbarOptions = [
        ['bold', 'italic', 'underline', 'strike'],
        ['blockquote', 'code-block'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link', 'image', 'video'], 
        ['clean']
    ];
    const quill = new Quill('#editor-container', {
        modules: {
            toolbar: toolbarOptions
        },
        theme: 'snow',
        placeholder: 'İçeriğinizi buraya yazın...'
    });


    // --- DEĞİŞTİ: Kategorileri çeken fonksiyon ---
    const fetchCategories = async () => {
        try {
            // YENİ ROTA: Artık 'postable' (yayınlanabilir) rotasını çağırıyoruz.
            // Bu rota korumalı olduğu için 'credentials: include' ŞART.
            const response = await fetch('/api/categories/postable', {
                credentials: 'include'
            });
            
            if (!response.ok) {
                // Bu rota authenticateToken kullandığı için 401/403 hatası verebilir.
                // global.js zaten bu durumda kullanıcıyı login'e atacaktır,
                // ama biz yine de hatayı konsola yazalım.
                throw new Error('Kategoriler yüklenemedi. Sunucu yanıtı: ' + response.status);
            }
            
            const categories = await response.json();
            
            // (Kalanı aynı)
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                categorySelect.appendChild(option);
            });
        } catch (error) {
            console.error(error);
            messageElement.textContent = 'Kategoriler yüklenemedi, lütfen sayfayı yenileyin.';
        }
    };
    // --- DEĞİŞİKLİK BİTTİ ---


    // Form gönderme fonksiyonu (Aynı)
    const handleSubmit = async (e) => {
        e.preventDefault();
        messageElement.textContent = '';
        messageElement.style.color = 'red';

        const title = titleInput.value;
        const content = quill.root.innerHTML;
        const category_id = categorySelect.value;
        
        if (!title || title.trim().length < 5) {
            messageElement.textContent = 'Başlık en az 5 karakter olmalıdır.';
            return;
        }
        if (quill.getLength() < 10) {
            messageElement.textContent = 'İçerik çok kısa.';
            return;
        }
        if (!category_id) {
            messageElement.textContent = 'Lütfen bir kategori seçin.';
            return;
        }
        
        const cleanContent = DOMPurify.sanitize(content);

        try {
            // (Bu fetch aynı, /posts rotasını çağırıyor)
            const response = await fetch('/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    title: title, 
                    content: cleanContent,
                    category_id: category_id
                }),
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok) {
                // (Bu mesaj ve yönlendirme mantığı aynı)
                messageElement.style.color = 'green';
                
                if (data.status === 'approved') {
                    messageElement.textContent = 'Konunuz başarıyla yayınlandı! Yönlendiriliyorsunuz...';
                    setTimeout(() => {
                        window.location.href = `/thread.html?id=${data.post.id}`;
                    }, 2000);
                } else {
                    messageElement.textContent = 'Konunuz onaya gönderildi! Admin incelemesinden sonra yayınlanacaktır. Ana sayfaya yönlendiriliyorsunuz...';
                    setTimeout(() => {
                        window.location.href = '/index.html';
                    }, 3000);
                }
            } else {
                throw new Error(data.message || 'Bir hata oluştu.');
            }
        } catch (error) {
            console.error('Konu gönderme hatası:', error);
            messageElement.textContent = error.message;
        }
    };
    
    submitForm.addEventListener('submit', handleSubmit);
    
    fetchCategories();
});