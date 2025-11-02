document.addEventListener('DOMContentLoaded', () => {
    const submitForm = document.getElementById('submit-form');
    const titleInput = document.getElementById('title');
    const messageElement = document.getElementById('message');
    
    // DEĞİŞTİ: Kategori seçici kaldırıldı
    // const categorySelect = document.getElementById('category-select');

    // Quill editörünü ayarla
    const toolbarOptions = [
        ['bold', 'italic', 'underline', 'strike'],
        ['blockquote', 'code-block'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link', 'image', 'video'], // video eklendi
        ['clean']
    ];

    const quill = new Quill('#editor-container', {
        modules: {
            toolbar: toolbarOptions
        },
        theme: 'snow',
        placeholder: 'İçeriğinizi buraya yazın...'
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        messageElement.textContent = '';
        messageElement.style.color = 'red';

        const title = titleInput.value;
        const content = quill.root.innerHTML; // HTML içeriğini al
        
        // DEĞİŞTİ: Kategori ID kaldırıldı
        // const category_id = categorySelect.value;

        if (!title.trim() || !content.trim() || content === '<p><br></p>') {
            messageElement.textContent = 'Başlık ve içerik alanları boş bırakılamaz.';
            return;
        }

        // DEĞİŞTİ: Kategori ID kontrolü kaldırıldı
        // if (!category_id) {
        //     messageElement.textContent = 'Lütfen bir kategori seçin.';
        //     return;
        // }
        
        // İçeriği XSS'e karşı temizle (DOMPurify)
        const cleanContent = DOMPurify.sanitize(content);

        try {
            const response = await fetch('/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    title: title, 
                    content: cleanContent
                    // DEĞİŞTİ: category_id gönderilmiyor
                    // category_id: category_id
                }),
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok) {
                messageElement.textContent = 'Konunuz başarıyla yayınlandı! Yönlendiriliyorsunuz...';
                messageElement.style.color = 'green';
                setTimeout(() => {
                    // Kullanıcıyı yeni açtığı konuya yönlendir
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

    // DEĞİŞTİ: Kategori çekme fonksiyonu kaldırıldı
    // const fetchCategories = async () => { ... };
    
    submitForm.addEventListener('submit', handleSubmit);
    
    // DEĞİŞTİ: Kategori çekme fonksiyonu çağrısı kaldırıldı
    // fetchCategories();
});