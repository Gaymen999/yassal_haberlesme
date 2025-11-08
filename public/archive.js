// public/archive.js (TÜM DOSYA)

document.addEventListener('DOMContentLoaded', () => {
    const archiveContainer = document.getElementById('archive-container');
    const filtersContainer = document.getElementById('category-filters');
    
    // Arama elementleri
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const clearSearchButton = document.getElementById('clear-search-button');
    
    // Aktif filtreleri tutmak için
    let currentCategoryId = null;
    let currentSearchTerm = '';

    // --- 1. Kategorileri Çek ve Filtre Butonlarını Oluştur ---
    const fetchCategories = async () => {
        try {
            // DÜZELTME 1: 'credentials: include' eklendi
            const response = await fetch('/api/categories', { credentials: 'include' });
            if (!response.ok) throw new Error('Kategoriler yüklenemedi.');
            
            const categories = await response.json();
            
            // "Tümünü Göster" butonu
            const allButton = document.createElement('button');
            allButton.textContent = 'Tümü';
            allButton.classList.add('filter-btn', 'active'); // Başlangıçta aktif
            allButton.addEventListener('click', () => {
                currentCategoryId = null;
                searchInput.value = ''; // Arama kutusunu da temizle
                currentSearchTerm = '';
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
                    fetchArchivedPosts();
                    updateActiveButton(button);
                });
                filtersContainer.appendChild(button);
            });

        } catch (error) {
            console.error(error);
            filtersContainer.innerHTML = `<p style="color: red;">Kategori filtreleri yüklenemedi.</p>`;
        }
    };

    // --- 2. Arşivlenmiş Konuları Çek ---
    const fetchArchivedPosts = async () => {
        archiveContainer.innerHTML = '<p>Arşiv yükleniyor...</p>';
        
        let url = '/api/posts/archive';
        const params = new URLSearchParams();
        
        if (currentCategoryId) {
            params.append('category_id', currentCategoryId);
        }
        if (currentSearchTerm) {
            params.append('search', currentSearchTerm);
        }
        
        if (params.toString()) {
            url += `?${params.toString()}`;
        }
        
        try {
            // DÜZELTME 2: 'credentials: include' eklendi
            const response = await fetch(url, { credentials: 'include' });
            if (!response.ok) throw new Error('Konular yüklenemedi.');
            
            // DÜZELTME 3 (EN ÖNEMLİSİ):
            // API doğrudan bir DİZİ [...] döndürüyor, OBJE {posts: ...} DEĞİL.
            // Bu yüzden 'data'nın kendisi bizim 'posts' dizimizdir.
            const posts = await response.json(); 
            
            archiveContainer.innerHTML = ''; // Temizle
            
            if (posts.length === 0) {
                if(currentSearchTerm) {
                    archiveContainer.innerHTML = `<p>Arama terimi ('${DOMPurify.sanitize(currentSearchTerm)}') ile eşleşen konu bulunamadı.</p>`;
                } else {
                    archiveContainer.innerHTML = `<p>Bu kategoride konu bulunamadı.</p>`;
                }
                return;
            }

            // Artık 'posts' bir dizi ve 'post' düzgün bir obje
            posts.forEach(post => {
                const postElement = document.createElement('article');
                postElement.className = 'post-card';
                
                // DÜZELTME 4: Verinin düzgün geldiğinden emin ol (Fallback ekle)
                const date = new Date(post.created_at).toLocaleDateString('tr-TR', {
                    year: 'numeric', month: 'long', day: 'numeric'
                });
                
                // Bu satırlar artık "[object Object]" VEYA "undefined" VERMEMELİ.
                const safeTitle = DOMPurify.sanitize(post.title || 'Başlıksız Konu');
                const safeAuthorUsername = DOMPurify.sanitize(post.author_username || 'Bilinmiyor'); 
                const safeCategoryName = DOMPurify.sanitize(post.category_name || 'Kategorisiz');

                // post.id'nin de düzgün geldiğinden emin ol
                const postId = post.id || '#';

                postElement.innerHTML = `
                    <div class="post-header">
                        <h3><a href="/thread.html?id=${postId}">${safeTitle}</a></h3>
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
        filtersContainer.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        activeButton.classList.add('active');
    };

    // --- 4. ARAMA İÇİN EVENT LISTENER'LAR ---
    const performSearch = () => {
        currentSearchTerm = searchInput.value.trim();
        // Arama yaparken kategori filtresini SIFIRLAMA (kategoride arama yapsın)
        // currentCategoryId = null; 
        // updateActiveButton(filtersContainer.querySelector('.filter-btn')); // 'Tümü' butonunu aktif et
        fetchArchivedPosts(); 
    };
    
    searchButton.addEventListener('click', performSearch);
    
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    clearSearchButton.addEventListener('click', () => {
        searchInput.value = '';
        currentSearchTerm = '';
        fetchArchivedPosts(); // Aramayı temizle
    });

    // --- Başlat ---
    fetchCategories();      // Önce filtreleri yükle
    fetchArchivedPosts();   // Sonra tüm konuları yükle
});