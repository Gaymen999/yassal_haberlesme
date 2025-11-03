document.addEventListener('DOMContentLoaded', () => {
    const archiveContainer = document.getElementById('archive-container');
    const filtersContainer = document.getElementById('category-filters');
    
    // Aktif filtreyi tutmak için
    let currentCategoryId = null;

    // --- 1. Kategorileri Çek ve Filtre Butonlarını Oluştur ---
    const fetchCategories = async () => {
        try {
            const response = await fetch('/api/categories');
            if (!response.ok) throw new Error('Kategoriler yüklenemedi.');
            
            const categories = await response.json();
            
            // "Tümünü Göster" butonu
            const allButton = document.createElement('button');
            allButton.textContent = 'Tümü';
            allButton.classList.add('filter-btn', 'active'); // Başlangıçta aktif
            allButton.addEventListener('click', () => {
                currentCategoryId = null;
                fetchArchivedPosts();
                updateActiveButton(allButton);
            });
            filtersContainer.appendChild(allButton);

            // Diğer kategori butonları
            categories.forEach(category => {
                const button = document.createElement('button');
                button.textContent = category.name;
                button.classList.add('filter-btn');
                button.addEventListener('click', () => {
                    currentCategoryId = category.id;
                    fetchArchivedPosts();
                    updateActiveButton(button);
                });
                filtersContainer.appendChild(button);
            });

        } catch (error) {
            console.error(error);
            filtersContainer.innerHTML = '<p style="color:red">Filtreler yüklenemedi.</p>';
        }
    };

    // --- 2. Arşiv Postlarını Çek ve Render Et ---
    const fetchArchivedPosts = async () => {
        archiveContainer.innerHTML = '<p>Arşiv yükleniyor...</p>';
        
        let apiUrl = '/api/archive-posts';
        if (currentCategoryId) {
            apiUrl += `?category_id=${currentCategoryId}`;
        }
        
        try {
            const response = await fetch(apiUrl, { credentials: 'include' });
            if (!response.ok) throw new Error('Arşiv yüklenirken bir hata oluştu: ' + response.statusText);

            const posts = await response.json();
            archiveContainer.innerHTML = ''; 

            if (posts.length === 0) {
                archiveContainer.innerHTML = '<p>Bu filtrede gösterilecek arşivlenmiş konu bulunmamaktadır.</p>';
                return;
            }

            // DEĞİŞTİ: Artık ana sayfadaki gibi .post-card render ediyoruz
            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.classList.add('post-card'); 

                const date = new Date(post.created_at).toLocaleDateString('tr-TR', {
                    year: 'numeric', month: 'long', day: 'numeric'
                });
                
                const safeTitle = DOMPurify.sanitize(post.title);
                const safeAuthorUsername = DOMPurify.sanitize(post.author_username); 
                const safeCategoryName = DOMPurify.sanitize(post.category_name || 'Kategorisiz');

                // Not: Arşiv API'si cevap/beğeni sayısını çekmiyor,
                // bu yüzden ana sayfadan daha sade bir kart gösteriyoruz.
                postElement.innerHTML = `
                    <div class="post-header">
                        <h3><a href="/thread.html?id=${post.id}">${safeTitle}</a></h3>
                        <span class="category-tag">${safeCategoryName}</span>
                    </div>
                    <div class="post-footer">
                         <p class="post-meta">Yayınlayan: ${safeAuthorUsername} (${date})</p>
                    </div>
                `;
                archiveContainer.appendChild(postElement);
            });

        } catch (error) {
            console.error(error);
            archiveContainer.innerHTML = `<p style="color: red;">Konular yüklenirken hata oluştu.</p>`;
        }
    };

    // --- 3. Yardımcı Fonksiyon (Aktif butonu güncelle) ---
    const updateActiveButton = (activeButton) => {
        // Önce hepsinden 'active' class'ını kaldır
        filtersContainer.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        // Sadece tıklanana ekle
        activeButton.classList.add('active');
    };

    // --- Başlat ---
    fetchCategories();      // Önce filtreleri yükle
    fetchArchivedPosts();   // Sonra tüm arşivi yükle
});