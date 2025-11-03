// public/global.js (DOĞRU KOD)

document.addEventListener('DOMContentLoaded', async () => {
    // Sadece header'daki linkleri seç
    const authLinks = document.getElementById('auth-links');
    let isAdmin = false;
    let userId = null;

    // data-auth="true" olan sayfaları koru
    const bodyAuth = document.body.dataset.auth === 'true';

    try {
        const response = await fetch('/api/user-status', { credentials: 'include' });
        const data = await response.json();
        
        if (data.loggedIn) {
            userId = data.user.id;
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

        } else {
            // Kullanıcı giriş yapmamışsa header linklerini ayarla
            authLinks.innerHTML = `
                <a href="login.html">Giriş Yap</a>
                <a href="register.html">Kayıt Ol</a>
            `;
            
            // Eğer sayfa korumalıysa (data-auth="true") ve kullanıcı giriş yapmamışsa, login'e yolla
            if (bodyAuth) {
                window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
            }
        }
    } catch (error) {
        console.error('Kullanıcı durumu hatası:', error);
        // Hata durumunda, korumalı sayfadaysa login'e yolla
        if (bodyAuth) {
            window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        }
    }
});