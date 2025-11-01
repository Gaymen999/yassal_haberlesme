document.addEventListener('DOMContentLoaded', () => {
    const postSubmitForm = document.getElementById('post-submit-form');
    const messageElement = document.getElementById('message');

    if (postSubmitForm) {
        postSubmitForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            messageElement.textContent = 'Gönderiliyor...';
            messageElement.style.color = 'black';
            
            // const token = localStorage.getItem('authToken'); // KALDIRILDI

            // if (!token) { // KALDIRILDI (Sunucu bu kontrolü yapacak)
            //     messageElement.textContent = 'Hata: Giriş yapılmamış.';
            //     window.location.href = '/login.html';
            //     return;
            // }

            const title = postSubmitForm.elements.title.value;
            const content = postSubmitForm.elements.content.value;
            const category = postSubmitForm.elements.category.value;

            try {
                const response = await fetch('/posts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        // KALDIRILDI: 'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify({ title, content, category }),
                });

                const data = await response.json();

                if (response.ok) {
                    messageElement.style.color = 'green';
                    messageElement.textContent = data.message || 'Paylaşımınız başarıyla onaya gönderildi.';
                    postSubmitForm.reset(); 
                } else {
                    messageElement.style.color = 'red';
                    // Hata 401/403 ise yetkisizlik hatasıdır.
                    if (response.status === 401 || response.status === 403) {
                         messageElement.textContent = 'Oturum süreniz doldu, lütfen tekrar giriş yapın.';
                         // localStorage.removeItem('authToken'); // KALDIRILDI
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