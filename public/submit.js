document.addEventListener('DOMContentLoaded', () => {
    const submitForm = document.getElementById('submit-form');
    const titleInput = document.getElementById('title');
    const messageElement = document.getElementById('message');
    
    // DEĞİŞTİ: Kategori seçici geri geldi
    const categorySelect = document.getElementById('category-select');

    // ... (Quill ayarları aynı) ...
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


    // DEĞİŞTİ: Kategorileri çeken fonksiyon geri geldi
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
            messageElement.textContent = 'Kategoriler yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.';
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        messageElement.textContent = '';
        messageElement.style.color = 'red';

        const title = titleInput.value;
        const content = quill.root.innerHTML; 
        
        // DEĞİŞTİ: Kategori ID geri geldi
        const category_id = categorySelect.value;

        if (!title.trim() || !content.trim() || content === '<p><br></p>') {
            messageElement.textContent = 'Başlık ve içerik alanları boş bırakılamaz.';
            return;
        }

        // DEĞİŞTİ: Kategori ID kontrolü geri geldi
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
                    // DEĞİŞTİ: category_id gönderiliyor
                    category_id: category_id
                }),
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok) {
                messageElement.textContent = 'Konunuz başarıyla yayınlandı! Yönlendiriliyorsunuz...';
                messageElement.style.color = 'green';
                setTimeout(() => {
                    window.location.href = `/thread.html?id=${data.post.id}`;
                }, 2000);
            } else {
                throw new Error(data.message || 'Bir hata oluştu.');
            }
        } catch (error) {
            console.error('Konu gönderme hatası:', error);
            messageElement.textContent = error.message;
        }
    };
    
    submitForm.addEventListener('submit', handleSubmit);
    
    // DEĞİŞTİ: Kategorileri çek
    fetchCategories();
});