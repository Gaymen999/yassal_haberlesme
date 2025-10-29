// Helper function to decode JWT token (JWT'den kullanıcı bilgisini okur)
const decodeToken = (token) => {
    try {
        // Base64Url çözümleme mantığı
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        // Hata durumunda (token geçersiz veya bozuksa)
        return null;
    }
};


document.addEventListener('DOMContentLoaded', () => {
    // Sayfanın genel değişkenlerini al
    const token = localStorage.getItem('authToken');
    const logoutButton = document.getElementById('logout-button'); // Admin/Submit sayfaları için
    
    // HTML body'den yetki gereksinimlerini al
    const requiresAuth = document.body.dataset.auth === 'true'; 
    const requiresRole = document.body.dataset.role; 
    let userRole = null;
    let userId = null;

    // Token varsa rolü ve id'yi çöz
    if (token) {
        const user = decodeToken(token);
        if (user) {
            userRole = user.role;
            userId = user.id;
        } else {
            // Token bozuksa/geçersizse temizle ve yeniden yükle
            localStorage.removeItem('authToken');
            window.location.reload(); 
            return;
        }
    }


    // --- 1. Yetkilendirme ve Oturum Kontrolü (Güvenlik) ---
    if (requiresAuth && !token) {
        // Yetki gerekiyorsa ve token yoksa (Giriş yapılmamışsa)
        alert('Bu sayfaya erişim için giriş yapmalısınız.');
        window.location.href = '/login.html';
        return;
    }

    if (requiresRole && userRole !== requiresRole) {
        // Rol gerekiyorsa ve rol eşleşmiyorsa (örn: Admin Paneli'ne normal kullanıcı girmesi)
        alert(`Bu sayfaya erişim için yetkiniz (${requiresRole} rolü) yok.`);
        window.location.href = '/'; // Ana sayfaya geri at
        return;
    }


    // --- 2. Çıkış Yapma İşlevi (Genel) ---
    // Eğer sayfada id="logout-button" varsa (örn: admin.html, submit.html)
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('authToken'); 
            window.location.href = '/'; 
        });
    }

    // --- 3. index.html Header Güncelleme (Dinamik Linkler) ---
    const postLinkDiv = document.getElementById('post-link');
    const authLinksDiv = document.getElementById('auth-links'); 

    if (authLinksDiv && postLinkDiv) { // Sadece Ana Sayfada (index.html) çalışır
        if (token) {
            // Giriş yapmışsa: Kayıt/Giriş divini gizle
            authLinksDiv.innerHTML = ''; 

            // Duyuru Gönder ve Çıkış Yap linkini göster
            postLinkDiv.innerHTML = `
                <a href="submit.html" style="margin-right: 15px;">Duyuru Gönder</a>
                <a href="#" id="logout-button-index">Çıkış Yap</a>
            `;
            
            // Çıkış yapma dinleyicisini ekle (Ana Sayfa butonu için)
            document.getElementById('logout-button-index').addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('authToken');
                window.location.reload();
            });
            
        } else {
            // Giriş yapmamışsa: Giriş yap/Kayıt ol linklerini göster
            authLinksDiv.innerHTML = '<a href="login.html">Giriş Yap</a> | <a href="register.html">Kayıt Ol</a>';
            // Duyuru gönder divini gizle
            postLinkDiv.innerHTML = ''; 
        }
    }
});