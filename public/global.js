// public/global.js

document.addEventListener("DOMContentLoaded", async () => {
  // Sadece header'daki linkleri seç
  const authLinks = document.getElementById("auth-links");
  let isAdmin = false;

  // --- KORUMA KONTROLLERİ ---
  const bodyAuth = document.body.dataset.auth === "true";
  const bodyAdmin = document.body.dataset.auth === "admin";

  try {
    const response = await fetch("/api/user-status", {
      credentials: "include",
    });
    const data = await response.json();

    if (data.loggedIn) {
      // Kullanıcı giriş yapmış
      isAdmin = data.user.role === "admin";

      // Header linklerini ayarla
      authLinks.innerHTML = `
                <a href="profile.html?username=${encodeURIComponent(
                  data.user.username
                )}">Profilim (${DOMPurify.sanitize(data.user.username)})</a>
                ${
                  isAdmin
                    ? '<a href="admin.html" style="color: #00AADC; font-weight: bold;">Admin Panel</a>'
                    : ""
                }
                <a href="#" id="logout-link">Çıkış Yap</a>
            `;

      // --- ÇIKIŞ YAP BUTONU DÜZELTMESİ ---
      document
        .getElementById("logout-link")
        .addEventListener("click", async (e) => {
          e.preventDefault();

          try {
            // DEĞİŞİKLİK: Rota '/auth/logout' DEĞİL, '/logout' OLMALI
            const logoutResponse = await fetch("/logout", {
              method: "POST",
              credentials: "include",
            });

            if (!logoutResponse.ok) {
              console.warn(
                "Sunucu çıkış işlemini onaylamadı, ancak yönlendirme yapılıyor."
              );
            }
          } catch (error) {
            console.error(
              "Çıkış fetch hatası (bu önemli değil, yönlendirme yapılacak):",
              error
            );
          } finally {
            // Hata olsa da olmasa da, sunucuya ulaşılamasa da
            // kullanıcıyı ana sayfaya yönlendir.
            // Sunucu çerezi silebildiyse çıkış yapılmış olacak,
            // silemediyse bile sayfa yenilenecek.
            window.location.href = "/index.html";
          }
        });
      // --- DÜZELTME BİTTİ ---

      // Admin Sayfası Koruması
      if (bodyAdmin && !isAdmin) {
        alert("Bu sayfaya erişim yetkiniz yok.");
        window.location.href = "/index.html";
      }
    } else {
      // Kullanıcı giriş yapmamış

      authLinks.innerHTML = `
                <a href="login.html">Giriş Yap</a>
                <a href="register.html">Kayıt Ol</a>
            `;

      // Korumalı Sayfa Kontrolü
      if (bodyAuth || bodyAdmin) {
        window.location.href = `/login.html?redirect=${encodeURIComponent(
          window.location.pathname + window.location.search
        )}`;
      }
    }
  } catch (error) {
    console.error("Kullanıcı durumu hatası:", error);

    if (bodyAuth || bodyAdmin) {
      window.location.href = `/login.html?redirect=${encodeURIComponent(
        window.location.pathname + window.location.search
      )}`;
    }
  }
  const header = document.querySelector("header");
  if (header) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 50) {
        // 50px kaydırıldıysa
        header.classList.add("scrolled");
      } else {
        header.classList.remove("scrolled");
      }
    });
  }
});
