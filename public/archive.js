// archive.js (TÜM DOSYA)

document.addEventListener('DOMContentLoaded', () => {
    const archiveContainer = document.getElementById('archive-container');
    const filtersContainer = document.getElementById('category-filters');
    
    // YENİ: Arama elementleri
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const clearSearchButton = document.getElementById('clear-search-button');
    
    // Aktif filtreleri tutmak için
    let currentCategoryId = null;
    let currentSearchTerm = ''; // YENİ

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
                fetchArchivedPosts(); // API'yi çağır
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
                    fetchArchivedPosts(); // API'yi çağır
                    updateActiveButton(button);
                });
                filtersContainer.appendChild(button);
            });

        } catch (error) {
            console.error(error);
            filtersContainer.innerHTML = '<p style="color:red">Filtreler yüklenemedi.</p>';
        }
    };

    // --- 2. Arşiv Postlarını Çek ve Render Et (GÜNCELLENDİ) ---
    const fetchArchivedPosts = async () => {
        archiveContainer.innerHTML = '<p>Arşiv yükleniyor...</p>';
        
        // URL'i dinamik olarak oluştur
        const params = new URLSearchParams();
        if (currentCategoryId) {
            params.append('categoryId', currentCategoryId);
        }
        if (currentSearchTerm) { // YENİ
            params.append('q', currentSearchTerm);
        }

        // '?' sadece parametre varsa eklenir
        const queryString = params.toString();
        let apiUrl = '/api/archive';
        if (queryString) {
            apiUrl += `?${queryString}`;
        }
        
        try {
            const response = await fetch(apiUrl, { credentials: 'include' });
            if (!response.ok) throw new Error('Arşiv yüklenirken bir hata oluştu: ' + response.statusText);

            const posts = await response.json();
            archiveContainer.innerHTML = ''; 

            if (posts.length === 0) {
                archiveContainer.innerHTML = '<p>Bu kriterlere uyan arşivlenmiş konu bulunmamaktadır.</p>';
                return;
            }

            // (Render kısmı (forEach) aynı, değişmedi)
            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.classList.add('post-card'); 

                const date = new Date(post.created_at).toLocaleDateString('tr-TR', {
                    year: 'numeric', month: 'long', day: 'numeric'
                });
                
                const safeTitle = DOMPurify.sanitize(post.title);
                const safeAuthorUsername = DOMPurify.sanitize(post.author_username); 
                const safeCategoryName = DOMPurify.sanitize(post.category_name || 'Kategorisiz');

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
    // (Bu fonksiyon aynı, değişmedi)
    const updateActiveButton = (activeButton) => {
        // Önce hepsinden 'active' class'ını kaldır
        filtersContainer.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        // Sadece tıklanana ekle
        activeButton.classList.add('active');
    };

    // --- 4. YENİ: ARAMA İÇİN EVENT LISTENER'LAR ---
    const performSearch = () => {
        currentSearchTerm = searchInput.value.trim();
        fetchArchivedPosts(); // API'yi yeni arama terimiyle çağır
    };
    
    searchButton.addEventListener('click', performSearch);
    
    // Enter tuşuyla da arama yapsın
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    clearSearchButton.addEventListener('click', () => {
        searchInput.value = '';
        currentSearchTerm = '';
        fetchArchivedPosts(); // Aramayı temizleyip yeniden yükle
    });

    // --- 5. Başlat ---
    fetchCategories();      // Önce filtreleri yükle
    fetchArchivedPosts();   // Sonra tüm arşivi yükle (boş filtrelerle)
});