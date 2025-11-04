// public/profile.js

document.addEventListener('DOMContentLoaded', () => {
    const profileHeaderContainer = document.getElementById('profile-header-container');
    const activityListContainer = document.getElementById('activity-list');
    const loadingMessage = document.getElementById('loading-message');
    const pageTitle = document.querySelector('title');

    // YENİ: Konu durumları için elementler
    const postStatusContainer = document.getElementById('post-status-container');
    const rejectedListContainer = document.getElementById('rejected-posts-list');
    const pendingListContainer = document.getElementById('pending-posts-list');
    const noStatusMessage = document.getElementById('no-status-message');
    
    let loggedInUsername = null; // Giriş yapan kullanıcının adı

    // 1. URL'den 'username'i al
    const params = new URLSearchParams(window.location.search);
    const profileUsername = params.get('username'); // Baktığımız profilin adı

    if (!profileUsername) {
        profileHeaderContainer.innerHTML = '<h2 style="color:red;">Hata: Kullanıcı adı bulunamadı.</h2>';
        activityListContainer.innerHTML = '';
        return;
    }

    // 2. Giriş yapan kullanıcıyı kontrol et (global.js bunu zaten yapıyor ama burada da ihtiyacımız var)
    const checkUserStatus = async () => {
         try {
            const response = await fetch('/api/user-status', { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                if (data.loggedIn) {
                    loggedInUsername = data.user.username;
                }
            }
         } catch (e) {
             console.warn('Kullanıcı durumu alınamadı.');
         }
    };

    // 3. API'den profil verilerini çek
    const fetchProfileData = async () => {
        
        await checkUserStatus(); // Önce giriş yapan kullanıcıyı öğren

        try {
            const response = await fetch(`/api/profile/${encodeURIComponent(profileUsername)}`);
            
            if (!response.ok) {
                if(response.status === 404) throw new Error('Bu isimde bir kullanıcı bulunamadı.');
                throw new Error('Profil yüklenirken bir hata oluştu.');
            }

            const data = await response.json();
            const { user, recentActivity, rejectedPosts, pendingPosts } = data; // YENİ

            // 4. Verileri render et
            pageTitle.textContent = `${user.username} Kullanıcı Profili`;
            loadingMessage.style.display = 'none';
            
            renderProfileHeader(user);
            renderRecentActivity(recentActivity);
            
            // YENİ: Sadece KENDİ profiline bakıyorsa bunları göster
            if (loggedInUsername === profileUsername) {
                renderPostStatuses(rejectedPosts, pendingPosts);
            }

        } catch (error) {
            console.error(error);
            loadingMessage.textContent = error.message;
            loadingMessage.style.color = 'red';
            activityListContainer.innerHTML = '';
        }
    };

    // Profil başlığını render et (Aynı)
    function renderProfileHeader(user) {
        const joinDate = new Date(user.created_at).toLocaleDateString('tr-TR');
        profileHeaderContainer.innerHTML = `
            <img src="${DOMPurify.sanitize(user.avatar_url || 'default_avatar.png')}" alt="${DOMPurify.sanitize(user.username)} Avatar" class="profile-avatar">
            <div class="profile-info">
                <h2>${DOMPurify.sanitize(user.username)}</h2>
                <span class="profile-stat"><b>Ünvan:</b> ${DOMPurify.sanitize(user.title || 'Yeni Üye')}</span>
                <span class="profile-stat"><b>Katılım Tarihi:</b> ${joinDate}</span>
                <span class="profile-stat"><b>Mesaj Sayısı:</b> ${user.post_count || 0}</span>
            </div>
        `;
    }

    // Son aktiviteleri (cevapları) render et (Aynı)
    function renderRecentActivity(activityList) {
        if (activityList.length === 0) {
            activityListContainer.innerHTML = '<p>Kullanıcının son aktivitesi (onaylı konularda) bulunmamaktadır.</p>';
            return;
        }

        activityListContainer.innerHTML = ''; // Temizle
        
        activityList.forEach(activity => {
            const activityElement = document.createElement('div');
            activityElement.className = 'activity-item';
            // ... (Kalan innerHTML kısmı aynı) ...
        });
    }
    
    // YENİ: Reddedilen/Bekleyen postları render et
    function renderPostStatuses(rejectedList, pendingList) {
        let hasContent = false;
        rejectedListContainer.innerHTML = '';
        pendingListContainer.innerHTML = '';
        
        if (rejectedList && rejectedList.length > 0) {
            hasContent = true;
            rejectedList.forEach(post => {
                const item = document.createElement('div');
                item.className = 'post-status-item';
                item.innerHTML = `
                    <span class="status-rejected">[REDDEDİLDİ]</span>
                    <span class="status-title">${DOMPurify.sanitize(post.title)}</span>
                `;
                rejectedListContainer.appendChild(item);
            });
        }
        
        if (pendingList && pendingList.length > 0) {
            hasContent = true;
            pendingList.forEach(post => {
                const item = document.createElement('div');
                item.className = 'post-status-item';
                item.innerHTML = `
                    <span class="status-pending">[ONAY BEKLİYOR]</span>
                    <span class="status-title">${DOMPurify.sanitize(post.title)}</span>
                `;
                pendingListContainer.appendChild(item);
            });
        }
        
        // Eğer en az bir tane bile varsa, ana konteyneri göster
        if (hasContent) {
            postStatusContainer.style.display = 'block';
        } else {
            noStatusMessage.style.display = 'block';
            postStatusContainer.style.display = 'block';
        }
    }

    // Ana fonksiyonu çalıştır
    fetchProfileData();
});