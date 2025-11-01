// decodeToken fonksiyonu buradan kaldırıldı, çünkü globalde artık tokene erişim yok.

document.addEventListener('DOMContentLoaded', () => {
    // Sayfanın genel değişkenlerini al
    const logoutButton = document.getElementById('logout-button'); // Admin/Submit sayfaları için
    
    // HTML body'den yetki gereksinimlerini al
    // (Bu kısım aynı kalabilir, çünkü sunucu zaten token yoksa /login.html'e yönlendirecek)
    const requiresAuth = document.body.dataset.auth === 'true'; 
    const requiresRole = document.body.dataset.role; 

    // --- Yetkilendirme Kontrolü ---
    // Bu kısım büyük ölçüde sunucuya devredildi. 
    // Sunucu, /admin.html veya /submit.html gibi korumalı sayfalara
    // cookie olmadan erişilmeye çalışıldığında 401 döndürecek.
    // Tarayıcı bu 401'i alacak, ancak biz yine de global.js'de
    // /api/user-status'e sorarak proaktif bir yönlendirme yapabiliriz.
    
    // --- Çıkış Yapma İşlevi (Genel) ---
    // Eğer sayfada id="logout-button" varsa (örn: admin.html, submit.html)
    if (logoutButton) {
        logoutButton.addEventListener('click', async (e) => { // async yapıldı
            e.preventDefault();
            
            // YENİ: Sunucudan cookie'yi silmesini iste
            try {
                await fetch('/logout', { method: 'POST' });
            } catch (error) {
                console.error('Çıkış hatası:', error);
            }
            
            // localStorage.removeItem('authToken'); // KALDIRILDI
            window.location.href = '/'; 
        });
    }

    // --- index.html Header Güncelleme (Dinamik Linkler) ---
    const postLinkDiv = document.getElementById('post-link');
    const authLinksDiv = document.getElementById('auth-links'); 

    // Sadece Ana Sayfada (index.html) çalışır
    if (authLinksDiv && postLinkDiv) {
        // YENİ: Sunucuya oturum durumunu sor
        (async () => {
            try {
                const response = await fetch('/api/user-status');
                const data = await response.json();

                if (data.loggedIn) {
                    // Giriş yapmışsa: Kayıt/Giriş divini gizle
                    authLinksDiv.innerHTML = ''; 

                    // Duyuru Gönder ve Çıkış Yap linkini göster
                    postLinkDiv.innerHTML = `
                        <a href="submit.html" style="margin-right: 15px;">Duyuru Gönder</a>
                        <a href="#" id="logout-button-index">Çıkış Yap</a>
                    `;
                    
                    // Çıkış yapma dinleyicisini ekle (Ana Sayfa butonu için)
                    document.getElementById('logout-button-index').addEventListener('click', async (e) => {
                        e.preventDefault();
                        await fetch('/logout', { method: 'POST' });
                        window.location.reload();
                    });
                    
                } else {
                    // Giriş yapmamışsa: Giriş yap/Kayıt ol linklerini göster
                    authLinksDiv.innerHTML = '<a href="login.html">Giriş Yap</a> | <a href="register.html">Kayıt Ol</a>';
                    // Duyuru gönder divini gizle
                    postLinkDiv.innerHTML = ''; 
                }
            } catch (error) {
                console.error("Kullanıcı durumu alınamadı:", error);
                // Hata durumunda (sunucu kapalıysa vb.) giriş yapılmamış gibi göster
                authLinksDiv.innerHTML = '<a href="login.html">Giriş Yap</a> | <a href="register.html">Kayıt Ol</a>';
                postLinkDiv.innerHTML = ''; 
            }
        })();
    }
});