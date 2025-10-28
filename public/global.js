// Helper function to decode JWT token (Admin.js'den buraya taşındı, artık merkezi)
const decodeToken = (token) => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
};


document.addEventListener('DOMContentLoaded', () => {
    // Tüm sayfalarda kullanılacak token
    const token = localStorage.getItem('authToken');
    const logoutButton = document.getElementById('logout-button');
    const requiresAuth = document.body.dataset.auth === 'true'; // Sayfa yetki gerektiriyor mu?
    const requiresRole = document.body.dataset.role; // Hangi rolü gerektiriyor?
    let userRole = null;

    // Token varsa rolü çöz
    if (token) {
        const user = decodeToken(token);
        if (user) {
            userRole = user.role;
        } else {
             // Token çözülemiyorsa geçersizdir, temizle
            localStorage.removeItem('authToken');
            window.location.reload(); 
            return;
        }
    }


    // --- Yetkilendirme Kontrolü ---
    if (requiresAuth && !token) {
        // Yetki gerekiyorsa ve token yoksa (Giriş yapılmamışsa)
        alert('Bu sayfaya erişim için giriş yapmalısınız.');
        window.location.href = '/login.html';
        return;
    }

    if (requiresRole && userRole !== requiresRole) {
        // Rol gerekiyorsa ve rol eşleşmiyorsa (Admin değilse)
        alert('Bu sayfaya erişim için yetkiniz (Admin rolü) yok.');
        window.location.href = '/'; // Ana sayfaya geri at
        return;
    }


    // --- Çıkış Yapma İşlevi ---
    // Eğer sayfada logout-button varsa
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('authToken'); 
            window.location.href = '/'; 
        });
    }

    // --- index.html Header Güncelleme ---
    // Ana sayfadaki dinamik linkleri yönet
    if (document.getElementById('post-link')) {
        const postLink = document.getElementById('post-link');
        const authLinks = document.getElementById('auth-links'); 

        if (token) {
            // Giriş yapmışsa "Duyuru Gönder" linki ve "Çıkış Yap" butonu
            postLink.innerHTML = `<a href="submit.html">Duyuru Gönder</a> | <a href="#" id="logout-button-index">Çıkış Yap</a>`;
            authLinks.innerHTML = ''; // Giriş yap/Kayıt ol linklerini gizle
            
            document.getElementById('logout-button-index').addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('authToken');
                window.location.reload();
            });
            
        } else {
            // Giriş yapmamışsa
            authLinks.innerHTML = '<a href="login.html">Giriş Yap</a> | <a href="register.html">Kayıt Ol</a>';
            postLink.innerHTML = ''; // Duyuru gönder linkini gizle
        }
    }
});