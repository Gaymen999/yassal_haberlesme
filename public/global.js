document.addEventListener('DOMContentLoaded', () => {
    // --- Çıkış Yapma İşlevi ---
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            // Token'ı sil
            localStorage.removeItem('authToken'); 
            // Kullanıcıyı ana sayfaya yönlendir
            window.location.href = '/'; 
        });
    }

    // --- Oturum Durumu Kontrolü ve Yönlendirme (Sadece Yetkili Sayfalar İçin) ---
    // Eğer sayfada oturum kontrolü gerekiyorsa (admin.html, submit.html gibi)
    const requiresAuth = document.body.dataset.auth === 'true'; 
    const token = localStorage.getItem('authToken');

    if (requiresAuth && !token) {
        // Eğer yetki gerekiyorsa ama token yoksa, giriş sayfasına at
        alert('Bu sayfaya erişim için giriş yapmalısınız.');
        window.location.href = '/login.html';
    }

    // Ana sayfada (index.html), giriş yapan kullanıcıya "Duyuru Gönder" butonu gösterilebilir
    if (document.getElementById('post-link')) {
        const postLink = document.getElementById('post-link');
        const authLinks = document.getElementById('auth-links'); // index.html'deki linklerin olduğu div

        if (token) {
            // Giriş yapmışsa "Duyuru Gönder" linkini göster
            postLink.innerHTML = '<a href="submit.html">Duyuru Gönder</a> | <a href="#" id="logout-button-index">Çıkış Yap</a>';
            
            // Ana sayfadaki çıkış butonu için dinleyici ekle
            document.getElementById('logout-button-index').addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('authToken');
                window.location.reload(); // Sayfayı yeniden yükle
            });
            
        } else {
            // Giriş yapmamışsa Kayıt Ol/Giriş Yap linklerini göster
            authLinks.innerHTML = '<a href="login.html">Giriş Yap</a> | <a href="register.html">Kayıt Ol</a>';
        }
    }
});