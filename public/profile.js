document.addEventListener('DOMContentLoaded', () => {
    const profileHeaderContainer = document.getElementById('profile-header-container');
    const activityListContainer = document.getElementById('activity-list');
    const loadingMessage = document.getElementById('loading-message');
    const pageTitle = document.querySelector('title');

    // 1. URL'den 'username'i al
    const params = new URLSearchParams(window.location.search);
    const username = params.get('username');

    if (!username) {
        profileHeaderContainer.innerHTML = '<h2 style="color:red;">Hata: Kullanıcı adı bulunamadı.</h2>';
        activityListContainer.innerHTML = '';
        return;
    }

    // 2. API'den profil verilerini çek
    const fetchProfileData = async () => {
        try {
            const response = await fetch(`/api/profile/${encodeURIComponent(username)}`);
            
            if (!response.ok) {
                if(response.status === 404) throw new Error('Bu isimde bir kullanıcı bulunamadı.');
                throw new Error('Profil yüklenirken bir hata oluştu.');
            }

            const data = await response.json();
            const { user, recentActivity } = data;

            // 3. Verileri render et
            pageTitle.textContent = `${user.username} Kullanıcı Profili`;
            loadingMessage.style.display = 'none';
            
            renderProfileHeader(user);
            renderRecentActivity(recentActivity);

        } catch (error) {
            console.error(error);
            loadingMessage.textContent = `Hata: ${error.message}`;
            loadingMessage.style.color = 'red';
        }
    };

    // 4. Profilin üst kısmını (Kullanıcı Kartı) oluşturan fonksiyon
    function renderProfileHeader(user) {
        const joinDate = new Date(user.created_at).toLocaleDateString('tr-TR');
        
        // Güvenlik (XSS)
        const safeUsername = DOMPurify.sanitize(user.username);
        const safeAvatar = DOMPurify.sanitize(user.avatar_url);
        const safeTitle = DOMPurify.sanitize(user.title);
        const safePostCount = DOMPurify.sanitize(user.post_count);

        profileHeaderContainer.innerHTML = `
            <img src="${safeAvatar}" alt="${safeUsername} Avatar" class="profile-avatar">
            <div class="profile-info">
                <h2>${safeUsername}</h2>
                <span class="profile-stat"><strong>Unvan:</strong> ${safeTitle}</span>
                <span class="profile-stat"><strong>Katılım Tarihi:</strong> ${joinDate}</span>
                <span class="profile-stat"><strong>Toplam Mesaj:</strong> ${safePostCount}</span>
            </div>
        `;
    }

    // 5. Son aktiviteleri (cevapları) listeleyen fonksiyon
    function renderRecentActivity(activityList) {
        if (activityList.length === 0) {
            activityListContainer.innerHTML = '<p>Kullanıcının son aktivitesi bulunmamaktadır.</p>';
            return;
        }

        activityListContainer.innerHTML = ''; // Temizle
        
        activityList.forEach(activity => {
            const activityElement = document.createElement('div');
            activityElement.className = 'activity-item';
            
            const date = new Date(activity.created_at).toLocaleString('tr-TR');
            
            // XSS Koruması (Kullanıcının cevabını gösterirken)
            const safeContent = DOMPurify.sanitize(activity.content);
            const safeTitle = DOMPurify.sanitize(activity.thread_title);

            activityElement.innerHTML = `
                <div class="meta">
                    <strong>"${safeTitle}"</strong> konusuna cevap verdi
                    <span style="float: right;">${date}</span>
                </div>
                <div class="content-snippet">
                    ${safeContent.substring(0, 200)}...
                </div>
                <a href="/thread.html?id=${activity.thread_id}#reply-${activity.reply_id}" class="view-reply-link">
                    Cevabı Gör 
                </a>
            `;
            activityListContainer.appendChild(activityElement);
        });
    }

    // Ana fonksiyonu çalıştır
    fetchProfileData();
});