document.addEventListener('DOMContentLoaded', async () => {
    // Sadece header'daki linkleri seç
    const authLinks = document.getElementById('auth-links');
    let isAdmin = false;

    // --- YENİ: KORUMA KONTROLLERİ ---
    // Sayfa, "giriş yapmış" olmayı gerektiriyor mu?
    const bodyAuth = document.body.dataset.auth === 'true';
    // Sayfa, "admin" olmayı gerektiriyor mu?
    const bodyAdmin = document.body.dataset.auth === 'admin';
    // --- BİTTİ ---

    try {
        const response = await fetch('/api/user-status', { credentials: 'include' });
        const data = await response.json();
        
        if (data.loggedIn) {
            // Kullanıcı giriş yapmış
            isAdmin = data.user.role === 'admin';
            
            // Header linklerini ayarla
            authLinks.innerHTML = `
                <a href="profile.html?username=${encodeURIComponent(data.user.username)}">Profilim (${DOMPurify.sanitize(data.user.username)})</a>
                ${isAdmin ? '<a href="admin.html" style="color: #00AADC; font-weight: bold;">Admin Panel</a>' : ''}
                <a href="#" id="logout-link">Çıkış Yap</a>
            `;
            
            // Çıkış yap butonuna event listener ekle
            document.getElementById('logout-link').addEventListener('click', async (e) => {
                e.preventDefault();
                await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
                window.location.href = '/login.html';
            });

            // --- YENİ: Admin Sayfası Koruması ---
            // Eğer sayfa admin yetkisi istiyorsa (bodyAdmin true ise)
            // AMA kullanıcı admin değilse (isAdmin false ise)
            if (bodyAdmin && !isAdmin) {
                // Admin olmayan kullanıcıyı ana sayfaya at
                alert('Bu sayfaya erişim yetkiniz yok.');
                window.location.href = '/index.html';
            }
            // --- BİTTİ ---

        } else {
            // Kullanıcı giriş yapmamış
            
            // Header linklerini ayarla
            authLinks.innerHTML = `
                <a href="login.html">Giriş Yap</a>
                <a href="register.html">Kayıt Ol</a>
            `;
            
            // --- GÜNCELLENDİ: Hem normal hem de admin sayfaları için koruma ---
            // Eğer sayfa giriş (bodyAuth) VEYA admin (bodyAdmin) yetkisi istiyorsa
            // ve kullanıcı giriş yapmamışsa, onu login'e yolla
            if (bodyAuth || bodyAdmin) {
                window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
            }
            // --- BİTTİ ---
        }
    } catch (error) {
        console.error('Kullanıcı durumu hatası:', error);
        
        // Hata durumunda, korumalı sayfalardaysa (normal veya admin) login'e yolla
        if (bodyAuth || bodyAdmin) {
            window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        }
    }
});