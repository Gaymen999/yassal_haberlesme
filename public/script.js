// public/script.js (TAMAMEN YENİ İÇERİK)
document.addEventListener('DOMContentLoaded', async () => { 
    // DEĞİŞTİ: Artık 'categories-container'ı seçiyoruz
    const categoriesContainer = document.getElementById('categories-container');
    const newPostButtonContainer = document.getElementById('new-post-button-container');

    let isAdmin = false;
    let isLoggedIn = false; 

    // --- 1. FONKSİYON TANIMLAMALARI ---
    
    // "Yeni Konu Aç" butonunu render etme (Aynı kaldı)
    const renderNewPostButton = () => {
        if (isLoggedIn) {
            newPostButtonContainer.innerHTML = `<a href="submit.html" class="new-post-btn">Yeni Konu Aç</a>`;
        } else {
             newPostButtonContainer.innerHTML = `<p class="login-prompt">Konu açmak için lütfen <a href="login.html">giriş yapın</a>.</p>`;
        }
    };
    
    // DEĞİŞTİ: Artık 'fetchCategories' (Kategorileri Çek)
    const fetchCategories = async () => {
        try {
            // DEĞİŞTİ: API rotası
            const response = await fetch('/api/categories', { credentials: 'include' });
            if (!response.ok) throw new Error('Kategoriler yüklenirken bir hata oluştu: ' + response.statusText);

            const categories = await response.json(); 
            categoriesContainer.innerHTML = ''; 

            if (categories.length === 0) {
                categoriesContainer.innerHTML = '<p>Gösterilecek kategori bulunmamaktadır.</p>';
                return;
            }

            categories.forEach(category => {
                const categoryElement = document.createElement('div');
                // YENİ: Resimdeki gibi CSS class'ları ekliyoruz
                categoryElement.classList.add('category-card'); 

                // Güvenlik
                const safeName = DOMPurify.sanitize(category.name);
                const safeDescription = DOMPurify.sanitize(category.description || '');
                // API'den gelen yeni istatistikler
                const postCount = category.post_count || 0;
                // Mesaj sayısı = Konu sayısı + Cevap sayısı
                const messageCount = (parseInt(postCount) + parseInt(category.reply_count || 0));

                // YENİ: Kategori kartı HTML'i
                categoryElement.innerHTML = `
                    <div class="category-header">
                        <h3><a href="/category.html?slug=${category.slug}">${safeName}</a></h3>
                    </div>
                    <div class="category-body">
                        <div class="category-info">
                            <p>${safeDescription}</p>
                        </div>
                        <div class="category-stats">
                            <span>Konular: <strong>${postCount}</strong></span>
                            <span>Mesajlar: <strong>${messageCount}</strong></span>
                        </div>
                    </div>
                `;
                categoriesContainer.appendChild(categoryElement);
            });

        } catch (error) {
            console.error(error);
            categoriesContainer.innerHTML = `<p style="color: red;">Kategoriler yüklenirken hata oluştu. Lütfen daha sonra tekrar deneyin.</p>`;
        }
    };
    
    // --- 2. KODU ÇALIŞTIRMA ---
    
    // Önce kullanıcı durumunu kontrol et
    try {
        const response = await fetch('/api/user-status', {
            credentials: 'include' 
        });
        const data = await response.json();
        
        if (data.loggedIn) {
            isLoggedIn = true; 
            if (data.user.role === 'admin') {
                isAdmin = true;
            }
        }
        renderNewPostButton();
    } catch (error) {
        console.warn('Kullanıcı durumu kontrol edilemedi.');
        renderNewPostButton();
    }

    // Kategorileri çek
    fetchCategories();
});