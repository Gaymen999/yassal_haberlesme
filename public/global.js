document.addEventListener('DOMContentLoaded', () => {
    const authLinksContainer = document.getElementById('auth-links');

    const checkUserStatus = async () => {
        try {
            const response = await fetch('/api/user-status', {
                credentials: 'include' 
            });
            
            if (!response.ok) {
                // Sunucu hatası veya ulaşılamıyor
                console.error('Sunucu durumu alınamadı:', response.status);
                renderAuthLinks({ loggedIn: false });
                return { loggedIn: false };
            }

            const data = await response.json();
            renderAuthLinks(data);
            
            // YENİ: Admin sayfası koruması
            checkPageAuth(data); 

            return data; 
        } catch (error) {
            console.error('Kullanıcı durumu kontrol edilemedi:', error);
            renderAuthLinks({ loggedIn: false }); 
            checkPageAuth({ loggedIn: false }); // Hata durumunda da korumayı çalıştır
            return { loggedIn: false };
        }
    };

    const renderAuthLinks = (data) => {
        if (authLinksContainer) {
            
            let adminLinkHTML = '';
            // YENİ: Admin linki kontrolü
            if (data.loggedIn && data.user.role === 'admin') {
                adminLinkHTML = '<a href="admin.html" class="nav-link admin-link">Admin Panel</a>';
            }

            if (data.loggedIn) {
                // DEĞİŞTİ: Admin linki ve Profil linki eklendi
                authLinksContainer.innerHTML = `
                    ${adminLinkHTML}
                    <a href="profile.html?username=${data.user.username}" class="nav-link profile-link">${data.user.username}</a>
                    <button id="logout-button" class="logout-btn">Çıkış Yap</button>
                `;
                document.getElementById('logout-button').addEventListener('click', handleLogout);
            } else {
                authLinksContainer.innerHTML = `
                    <a href="login.html" class="nav-link">Giriş</a>
                    <a href="register.html" class="nav-link">Kayıt</a>
                `;
            }
        }
    };

    const handleLogout = async () => {
        try {
            await fetch('/logout', { method: 'POST', credentials: 'include' });
            window.location.href = '/index.html'; 
        } catch (error) {
            console.error('Çıkış yapılamadı:', error);
        }
    };

    // YENİ: Sayfa koruma fonksiyonu
    // Bu fonksiyon, admin.html gibi sayfaları korur
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
        else if (authRequirement === 'admin') {
            // Sadece admin GEREKTİREN sayfalar (admin.html)
            if (!authData.loggedIn || authData.user.role !== 'admin') {
                // Giriş yapmamışsa VEYA giriş yapmış ama admin değilse
                alert('Bu sayfaya erişim yetkiniz yok.');
                window.location.href = '/index.html'; // Ana sayfaya yönlendir
            }
        }
        // (data-auth="false" veya data-auth yoksa bir şey yapma)
    }

    // Ana fonksiyonu çalıştır
    checkUserStatus();
});