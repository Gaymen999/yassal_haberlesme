document.addEventListener('DOMContentLoaded', () => {
    const postSubmitForm = document.getElementById('post-submit-form');
    const messageElement = document.getElementById('message');
    const categorySelect = document.getElementById('category');

    // YENİ: Sayfa yüklenir yüklenmez kategorileri API'den çek
    const fetchCategories = async () => {
        try {
            const response = await fetch('/api/categories', {
                credentials: 'include' // Cookie göndermek için (belki kategori listeleme de korunuyordur)
            });
            if (!response.ok) throw new Error('Kategoriler yüklenemedi.');

            const categories = await response.json();
            
            if (categories.length === 0) {
                categorySelect.innerHTML = '<option value="" disabled selected>Hiç kategori bulunamadı.</option>';
                return;
            }

            // <select> listesini doldur
            categorySelect.innerHTML = '<option value="" disabled selected>Bir kategori seçin...</option>';
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id; // Artık ID gönderiyoruz
                option.textContent = category.name; // Kullanıcıya adı gösteriyoruz
                categorySelect.appendChild(option);
            });

        } catch (error) {
            console.error(error);
            categorySelect.innerHTML = '<option value="" disabled selected>Kategoriler yüklenirken hata oluştu.</option>';
        }
    };

    // Fonksiyonu hemen çağır
    fetchCategories();


    // Form gönderme işlemini güncelle
    if (postSubmitForm) {
        postSubmitForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            messageElement.textContent = 'Gönderiliyor...';
            messageElement.style.color = 'black';
            
            const title = postSubmitForm.elements.title.value;
            const content = postSubmitForm.elements.content.value;
            // DEĞİŞTİ: Artık metin değil, seçilen ID'yi alıyoruz
            const category_id = postSubmitForm.elements.category.value; 

            try {
                const response = await fetch('/posts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    // DEĞİŞTİ: Body'de 'category_id' gönder
                    body: JSON.stringify({ title, content, category_id }), 
                    credentials: 'include' 
                });

                const data = await response.json();

                if (response.ok) {
                    messageElement.style.color = 'green';
                    messageElement.textContent = data.message || 'Konunuz başarıyla yayınlandı!';
                    postSubmitForm.reset(); 
                    // YENİ: Başarılı olunca konunun detay sayfasına yönlendir (Opsiyonel ama güzel olur)
                    // window.location.href = `/thread.html?id=${data.post.id}`;
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