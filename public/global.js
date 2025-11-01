document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logout-button'); 
    
    const requiresAuth = document.body.dataset.auth === 'true'; 
    const requiresRole = document.body.dataset.role; 

    // --- Çıkış Yapma İşlevi (Genel) ---
    if (logoutButton) {
        logoutButton.addEventListener('click', async (e) => { 
            e.preventDefault();
            
            try {
                await fetch('/logout', { 
                    method: 'POST',
                    credentials: 'include' // DÜZELTME
                });
            } catch (error) {
                console.error('Çıkış hatası:', error);
            }
            
            window.location.href = '/'; 
        });
    }

    // --- index.html Header Güncelleme (Dinamik Linkler) ---
    const postLinkDiv = document.getElementById('post-link');
    const authLinksDiv = document.getElementById('auth-links'); 

    if (authLinksDiv && postLinkDiv) {
        (async () => {
            try {
                const response = await fetch('/api/user-status', {
                    credentials: 'include' // DÜZELTME
                });
                const data = await response.json();

                if (data.loggedIn) {
                    authLinksDiv.innerHTML = ''; 

                    postLinkDiv.innerHTML = `
                        <a href="submit.html" style="margin-right: 15px;">Duyuru Gönder</a>
                        <a href="#" id="logout-button-index">Çıkış Yap</a>
                    `;
                    
                    document.getElementById('logout-button-index').addEventListener('click', async (e) => {
                        e.preventDefault();
                        await fetch('/logout', { 
                            method: 'POST',
                            credentials: 'include' // DÜZELTME
                        });
                        window.location.reload();
                    });
                    
                } else {
                    authLinksDiv.innerHTML = '<a href="login.html">Giriş Yap</a> | <a href="register.html">Kayıt Ol</a>';
                    postLinkDiv.innerHTML = ''; 
                }
            } catch (error) {
                console.error("Kullanıcı durumu alınamadı:", error);
                authLinksDiv.innerHTML = '<a href="login.html">Giriş Yap</a> | <a href="register.html">Kayıt Ol</a>';
                postLinkDiv.innerHTML = ''; 
            }
        })();
    }
});