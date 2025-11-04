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


    // Kategorileri çeken fonksiyon (Aynı)
    const fetchCategories = async () => {
        try {
            const response = await fetch('/api/categories');
            if (!response.ok) throw new Error('Kategoriler yüklenemedi.');
            
            const categories = await response.json();
            
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

    // --- DEĞİŞTİ: Form gönderme fonksiyonu ---
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
                // YENİ: Mesaj ve yönlendirme backend'den gelen 'status'e göre değişiyor
                messageElement.style.color = 'green';
                
                if (data.status === 'approved') {
                    // Admin post attıysa
                    messageElement.textContent = 'Konunuz başarıyla yayınlandı! Yönlendiriliyorsunuz...';
                    setTimeout(() => {
                        window.location.href = `/thread.html?id=${data.post.id}`;
                    }, 2000);
                } else {
                    // Normal kullanıcı post attıysa
                    messageElement.textContent = 'Konunuz onaya gönderildi! Admin incelemesinden sonra yayınlanacaktır. Ana sayfaya yönlendiriliyorsunuz...';
                    setTimeout(() => {
                        window.location.href = '/index.html'; // Ana sayfaya yönlendir
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