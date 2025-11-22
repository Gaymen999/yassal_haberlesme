// public/global.js

// Global kullanıcı durumu (Diğer scriptlerden erişilebilir: window.currentUser)
window.currentUser = null;
window.isUserLoggedIn = false;
window.isAdmin = false;

// Cookie tabanlı fetch sarmalayıcısı
window.secureFetch = async (url, options = {}) => {
  const defaultOptions = {
    credentials: 'include', // Tarayıcının cookie'yi göndermesini sağlar
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // Headerları birleştir
  const finalOptions = {
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  // Body nesne ise JSON'a çevir
  if (finalOptions.body && typeof finalOptions.body === 'object') {
    finalOptions.body = JSON.stringify(finalOptions.body);
  }

  return fetch(url, finalOptions);
};

// Sayfa Yüklendiğinde Çalışacak Ortak Kodlar
document.addEventListener("DOMContentLoaded", async () => {
  const authLinks = document.getElementById("auth-links");

  // Kullanıcı durumunu BİR KEZ kontrol et ve global değişkene ata
  try {
    const response = await fetch("/api/user-status", { credentials: "include" });
    const data = await response.json();

    if (data.loggedIn) {
      window.isUserLoggedIn = true;
      window.currentUser = data.user;
      window.isAdmin = data.user.role === "admin";
    }
  } catch (error) {
    console.error("Global kullanıcı kontrol hatası:", error);
  }

  // --- Header Linklerini Güncelle ---
  if (authLinks) {
    if (window.isUserLoggedIn) {
      authLinks.innerHTML = `
          <a href="profile.html?username=${encodeURIComponent(window.currentUser.username)}">
             Profilim (${DOMPurify.sanitize(window.currentUser.username)})
          </a>
          ${window.isAdmin ? '<a href="admin.html" style="color: #00AADC; font-weight: bold;">Admin Panel</a>' : ""}
          <a href="#" id="logout-link">Çıkış Yap</a>
      `;

      // Çıkış Yap Butonu
      document.getElementById("logout-link").addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          await window.secureFetch("/logout", { method: "POST" });
          window.location.href = "/index.html";
        } catch (error) {
          console.error("Çıkış hatası:", error);
          window.location.href = "/index.html";
        }
      });
    } else {
      authLinks.innerHTML = `
          <a href="login.html">Giriş Yap</a>
          <a href="register.html">Kayıt Ol</a>
      `;
    }
  }

  // --- Sayfa Erişim Kontrolleri (HTML data-auth attribute'una göre) ---
  const bodyAuth = document.body.dataset.auth; // "true" veya "admin"

  if (bodyAuth === "true" && !window.isUserLoggedIn) {
    // Giriş yapmamış kullanıcıyı login'e at
    window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  } else if (bodyAuth === "admin" && !window.isAdmin) {
    // Admin olmayan kullanıcıyı anasayfaya at
    alert("Bu sayfaya erişim yetkiniz yok.");
    window.location.href = "/index.html";
  }

  // --- Header Scroll Efekti ---
  const header = document.querySelector("header");
  if (header) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 50) header.classList.add("scrolled");
      else header.classList.remove("scrolled");
    });
  }
});