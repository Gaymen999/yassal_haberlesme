document.addEventListener('DOMContentLoaded', () => {
    const authLinksContainer = document.getElementById('auth-links');
    const logoutButton = document.getElementById('logout-button');

    const checkAuthStatus = async () => {
        try {
            const response = await fetch('/api/user-status', {
                credentials: 'include'
            });
            
            if (!response.ok) {
                 // API hatası (sunucu kapalı vb.) durumunda
                 return { loggedIn: false };
            }

            const data = await response.json();
            
            // Sayfa korumasını kontrol et
            checkPageAuth(data); // DEĞİŞTİ: 'data' buraya parametre olarak verildi
            
            // Header'daki linkleri ayarla
            if (authLinksContainer) {
                if (data.loggedIn) {
                    let adminLink = '';
                    if (data.user.role === 'admin') {
                        adminLink = '<a href="/admin.html" class="auth-button admin">Admin Paneli</a>';
                    }
                    authLinksContainer.innerHTML = `
                        ${adminLink}
                        <span class="welcome-user">Hoş geldin, ${data.user.username}!</span>
                        <button id="global-logout-btn" class="auth-button">Çıkış Yap</button>
                    `;
                    document.getElementById('global-logout-btn').addEventListener('click', handleLogout);
                } else {
                    authLinksContainer.innerHTML = `
                        <a href="/login.html" class="auth-button">Giriş Yap</a>
                        <a href="/register.html" class="auth-button">Kayıt Ol</a>
                    `;
                }
            }
            
            return data; // Diğer script'lerin kullanabilmesi için (örn: thread.js)

        } catch (error) {
            console.error('Yetkilendirme durumu alınamadı:', error);
            checkPageAuth({ loggedIn: false }); // Hata durumunda çıkış yapmış say
            return { loggedIn: false };
        }
    };

    const handleLogout = async () => {
        try {
            await fetch('/logout', { method: 'POST', credentials: 'include' });
            window.location.href = '/index.html'; // Çıkış yapınca ana sayfaya git
        } catch (error) {
            console.error('Çıkış yapılamadı:', error);
        }
    };

    // DEĞİŞTİ: Bu fonksiyon artık 'authData' parametresi alıyor
    function checkPageAuth(authData) {
        const authRequirement = document.body.dataset.auth;
        const currentPath = window.location.pathname + window.location.search;

        if (authRequirement === 'true') {
            // Sadece giriş GEREKTİREN sayfalar (örn: submit.html)
            if (!authData.loggedIn) {
                alert('Bu sayfayı görmek için giriş yapmalısınız.');
                window.location.href = `/login.html?redirect=${encodeURIComponent(currentPath)}`;
            }
        } 
        // YENİ: Admin GEREKTİREN sayfalar (admin.html)
        else if (authRequirement === 'admin') {
            if (!authData.loggedIn || authData.user.role !== 'admin') {
                // Giriş yapmamışsa VEYA giriş yapmış ama admin değilse
                alert('Bu sayfaya erişim yetkiniz yok.');
                window.location.href = '/index.html'; // Ana sayfaya yönlendir
            }
        }
        // (data-auth="false" veya data-auth yoksa bir şey yapma)
    }

    // Ana fonksiyonu çalıştır
    checkAuthStatus();

    // Eğer sayfada özel (form içi) logout butonu varsa (örn: submit.html)
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
});