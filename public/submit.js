document.addEventListener('DOMContentLoaded', () => {
    const postSubmitForm = document.getElementById('post-submit-form');
    const messageElement = document.getElementById('message');
    const categorySelect = document.getElementById('category');

    // YENİ: Quill.js Editörünü Başlatma
    // Technopat'taki gibi kod bloğu, resim, video vb. butonları ekliyoruz.
    const toolbarOptions = [
        ['bold', 'italic', 'underline', 'strike'],        // Kalın, italik vb.
        ['blockquote', 'code-block'],                     // Alıntı ve kod bloğu
        [{ 'header': [1, 2, 3, false] }],               // Başlık seviyeleri
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],     // Listeleme
        [{ 'indent': '-1'}, { 'indent': '+1' }],          // Girinti
        ['link', 'image', 'video'],                       // Link, Resim, Video
        ['clean']                                         // Formatlamayı temizle
    ];

    const quill = new Quill('#editor-container', {
        modules: {
            toolbar: toolbarOptions
        },
        theme: 'snow', // 'Snow' teması (standart)
        placeholder: 'Konu içeriğini buraya yazın...'
    });


    // (fetchCategories fonksiyonu aynı kaldı)
    const fetchCategories = async () => {
        try {
            const response = await fetch('/api/categories', {
                credentials: 'include' 
            });
            if (!response.ok) throw new Error('Kategoriler yüklenemedi.');

            const categories = await response.json();
            
            if (categories.length === 0) {
                categorySelect.innerHTML = '<option value="" disabled selected>Hiç kategori bulunamadı.</option>';
                return;
            }

            categorySelect.innerHTML = '<option value="" disabled selected>Bir kategori seçin...</option>';
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id; 
                option.textContent = category.name; 
                categorySelect.appendChild(option);
            });

        } catch (error) {
            console.error(error);
            categorySelect.innerHTML = '<option value="" disabled selected>Kategoriler yüklenirken hata oluştu.</option>';
        }
    };
    fetchCategories();


    // Form gönderme işlemini güncelle
    if (postSubmitForm) {
        postSubmitForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            messageElement.textContent = 'Gönderiliyor...';
            messageElement.style.color = 'black';
            
            const title = postSubmitForm.elements.title.value;
            // DEĞİŞTİ: İçeriği <textarea> yerine Quill editöründen alıyoruz
            // .root.innerHTML bize HTML içeriğini verir.
            const content = quill.root.innerHTML; 
            
            const category_id = postSubmitForm.elements.category.value; 

            // YENİ: İçerik boş mu diye kontrol et (Quill boşken <p><br></p> verir)
            if (!title || !category_id || content === '<p><br></p>' || content.length < 10) {
                 messageElement.style.color = 'red';
                 messageElement.textContent = 'Başlık, kategori ve içerik (en az 10 karakter) zorunludur.';
                 return;
            }

            try {
                const response = await fetch('/posts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    // 'content' artık düz metin değil, HTML gönderiyor
                    body: JSON.stringify({ title, content, category_id }), 
                    credentials: 'include' 
                });

                const data = await response.json();

                if (response.ok) {
                    messageElement.style.color = 'green';
                    messageElement.textContent = data.message || 'Konunuz başarıyla yayınlandı!';
                    postSubmitForm.reset(); 
                    quill.root.innerHTML = ''; // Editörü temizle
                    
                    // YENİ: Başarılı olunca konunun detay sayfasına yönlendir
                    // (Bu kodu bir önceki adımda eklemiştik, yine ekliyorum)
                    window.location.href = `/thread.html?id=${data.post.id}`;
                } else {
                    messageElement.style.color = 'red';
                    if (response.status === 401 || response.status === 403) {
                         messageElement.textContent = 'Oturum süreniz doldu, lütfen tekrar giriş yapın.';
                         setTimeout(() => window.location.href = '/login.html', 2000);
                    } else {
                         messageElement.textContent = data.message || 'Gönderim sırasında bir hata oluştu.';
                    }
                }
            } catch (error) {
                console.error('Gönderim hatası:', error);
                messageElement.style.color = 'red';
                messageElement.textContent = 'Sunucuya bağlanılamadı.';
            }
        });
    }
});