document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const messageElement = document.getElementById('message');

    // --- Kayıt İşlemi ---
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            messageElement.textContent = ''; 

            // YENİ: 'username' formdan alındı
            const username = registerForm.elements.username.value;
            const email = registerForm.elements.email.value;
            const password = registerForm.elements.password.value;

            try {
                const response = await fetch('/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    // YENİ: 'username' body'ye eklendi
                    body: JSON.stringify({ username, email, password }),
                });

                const data = await response.json();

                if (response.ok) {
                    messageElement.style.color = 'green';
                    messageElement.textContent = 'Kayıt başarılı! Lütfen giriş yapın.';
                    registerForm.reset(); 
                } else {
                    messageElement.style.color = 'red';
                    // Backend artık username hatalarını da gönderebilir
                    messageElement.textContent = data.message || 'Kayıt sırasında bir hata oluştu.';
                }
            } catch (error) {
                console.error('Kayıt hatası:', error);
                messageElement.style.color = 'red';
                messageElement.textContent = 'Sunucuya bağlanılamadı.';
            }
        });
    }

    // --- Giriş İşlemi ---
    // (Burası DEĞİŞMEDİ. Backend artık 'email' alanına gelen verinin
    // email VEYA username olduğunu anlıyor, frontend'i değiştirmeye gerek yok)
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            messageElement.textContent = ''; 

            const email = loginForm.elements.email.value;
            const password = loginForm.elements.password.value;

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, password }),
                    credentials: 'include' // Bunu da ekleyelim (gerçi auth'ta hep vardı sanırım)
                });

                const data = await response.json();

                if (response.ok) {
                    messageElement.style.color = 'green';
                    messageElement.textContent = 'Giriş başarılı! Yönlendiriliyorsunuz...';
                    window.location.href = '/'; 
                } else {
                    messageElement.style.color = 'red';
                    messageElement.textContent = data.message || 'Giriş başarısız oldu. Bilgilerinizi kontrol edin.';
                }
            } catch (error) {
                console.error('Giriş hatası:', error);
                messageElement.style.color = 'red';
                messageElement.textContent = 'Sunucuya bağlanılamadı.';
            }
        });
    }
});