// public/archive.js (YENİ HALİ - Animasyon 1 Eklendi)

document.addEventListener('DOMContentLoaded', () => {
    const archiveContainer = document.getElementById('archive-container');
    const filtersContainer = document.getElementById('category-filters');
    
    // YENİ: Arama elementleri
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const clearSearchButton = document.getElementById('clear-search-button');
    
    // Aktif filtreleri tutmak için
    let currentCategoryId = null;
    let currentSearchTerm = '';
    
    // --- YENİ: KAYDIRMA ANİMASYONU İÇİN OBSERVER ---
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.remove('hidden');
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Animasyon 1 kez çalışsın
            }
        });
    }, { threshold: 0.1 }); 

    const observeNewPosts = () => {
        archiveContainer.querySelectorAll('.post-card.hidden').forEach(card => {
            observer.observe(card);
        });
    };
    // ------------------------------------------------

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
            filtersContainer.innerHTML = `<p style="color: red;">Filtreler yüklenirken hata oluştu.</p>`;
        }
    };

    // --- 2. Postları Çek ve Ekrana Bas ---
    const fetchArchivedPosts = async () => {
        try {
            archiveContainer.innerHTML = '<p>Arşiv yükleniyor...</p>'; // Yükleniyor mesajını göster
            
            // API sorgusunu categoryId ve arama terimi ile oluştur
            const url = new URL('/api/posts/archive', window.location.origin);
            if (currentCategoryId) {
                url.searchParams.append('categoryId', currentCategoryId);
            }
            if (currentSearchTerm) {
                url.searchParams.append('search', currentSearchTerm);
            }

            const response = await fetch(url);
            if (!response.ok) throw new Error('Arşiv konuları yüklenemedi.');
            
            const posts = await response.json();

            archiveContainer.innerHTML = ''; // Yükleniyor mesajını sil
            
            if (posts.length === 0) {
                 archiveContainer.innerHTML = `<p class="no-posts">Filtrenize uygun konu bulunmamaktadır.</p>`;
                 return;
            }

            posts.forEach(post => {
                const postElement = document.createElement('div');
                // post-card sınıfının yanına "hidden" sınıfını ekle
                postElement.classList.add('post-card', 'hidden'); 

                const date = new Date(post.created_at).toLocaleDateString('tr-TR', {
                    year: 'numeric', month: 'long', day: 'numeric'
                });
                
                const safeTitle = DOMPurify.sanitize(post.title);
                const safeAuthorUsername = DOMPurify.sanitize(post.author_username || 'Bilinmiyor');
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
            
            // YENİ: Postları DOM'a ekledikten sonra gözlemlemeye başla
            observeNewPosts();

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


    // --- Başlat ---
    fetchCategories();      // Önce filtreleri yükle
    fetchArchivedPosts();   // Ardından tüm postları yükle

});