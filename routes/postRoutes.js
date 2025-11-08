// routes/postRoutes.js

const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/authMiddleware');
const router = express.Router();
const jwt = require('jsonwebtoken'); // Kendi kendine token doğrulaması için
const { sendApprovalEmail } = require('../config/email');

// Sabitler
const POSTS_PER_PAGE = 20; 
const REPLIES_PER_PAGE = 20;

// --- KATEGORİ ROTALARI ---

// 1. HERKESİN görebileceği, FİLTRESİZ kategori listesi
// (Arşiv, Kategori sayfaları vb. için)
router.get('/api/categories', async (req, res) => { 
    try {
        const categories = await pool.query('SELECT * FROM categories ORDER BY name ASC');
        res.json(categories.rows);
    } catch (err) {
        console.error("Kategorileri getirirken hata:", err.message);
        // DÜZELTME: JSON hatası yolla
        res.status(500).json({ message: 'Sunucu Hatası: Kategoriler yüklenemedi.' });
    }
});

// 2. YENİ ROTA: Sadece "Konu Aç" sayfası için KORUMALI kategori listesi
router.get('/api/categories/postable', authenticateToken, async (req, res) => {
    try {
        let queryText = '';
        const userRole = req.user.role; // authMiddleware sayesinde req.user var

        if (userRole === 'admin') {
            // Admin ise TÜM kategorileri getir
            queryText = 'SELECT * FROM categories ORDER BY name ASC';
        } else {
            // Admin değilse, 'Bilgilendirme' kategorisi DIŞINDAKİLERİ getir
            queryText = "SELECT * FROM categories WHERE slug != 'bilgilendirme' ORDER BY name ASC";
        }
        
        const categories = await pool.query(queryText);
        res.json(categories.rows);

    } catch (err) {
        console.error("Yayınlanabilir kategorileri getirirken hata:", err.message);
        res.status(500).json({ message: 'Sunucu Hatası: Kategoriler yüklenemedi.' });
    }
});

// 3. Kategori Detay Sayfası (Kategori içindeki postlar)
// GÜNCELLENDİ: Sadece 'approved' (onaylı) postları gösterecek
router.get('/api/categories/:slug', async (req, res) => { 
    try {
        const { slug } = req.params;
        const postsInCategory = await pool.query(`
            SELECT 
                p.id, p.title, p.is_pinned, p.created_at, 
                c.name AS category_name,
                c.slug AS category_slug,
                u.username AS author_username,
                u.avatar_url AS author_avatar
            FROM posts p
            JOIN users u ON p.author_id = u.id
            JOIN categories c ON p.category_id = c.id
            WHERE c.slug = $1 AND p.status = 'approved' -- ONAY FİLTRESİ
            ORDER BY p.is_pinned DESC, p.created_at DESC;
        `, [slug]);
        
        // Bu kısım kategori varsa ama post yoksa 404 vermesin diye
        if (postsInCategory.rows.length === 0) {
            const categoryCheck = await pool.query('SELECT * FROM categories WHERE slug = $1', [slug]);
            if (categoryCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Kategori bulunamadı.' });
            }
        }
        
        res.json(postsInCategory.rows);
    } catch (err) {
        console.error("Kategori postlarını getirirken hata:", err.message);
        res.status(500).json({ message: 'Sunucu Hatası: Konular yüklenemedi.' });
    }
});


// --- YENİ KONU OLUŞTURMA (GÜNCELLENDİ) ---
// (Onay sistemi ve Admin-only kategori koruması eklendi)
router.post('/posts', authenticateToken, async (req, res) => {
    try {
        const { title, content, category_id } = req.body;
        const author_id = req.user.id;
        const author_role = req.user.role; 

        if (!title || !content || !category_id) {
            return res.status(400).json({ message: 'Başlık, içerik ve kategori zorunludur.' });
        }
        
        // ADMIN KATEGORİSİ GÜVENLİK KONTROLÜ
        if (author_role !== 'admin') {
            const categoryCheck = await pool.query('SELECT slug FROM categories WHERE id = $1', [category_id]);
            
            if (categoryCheck.rows.length === 0) {
                return res.status(400).json({ message: 'Geçersiz kategori.' });
            }
            // "Bilgilendirme" kategorisinin slug'ı 'bilgilendirme' olmalı
            if (categoryCheck.rows[0].slug === 'bilgilendirme') { 
                return res.status(403).json({ message: 'Bu kategoriye sadece adminler konu açabilir.' });
            }
        }
        
        // ONAY SİSTEMİ MANTIĞI
        const status = (author_role === 'admin') ? 'approved' : 'pending';
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            const newPost = await client.query(
                'INSERT INTO posts (title, content, author_id, category_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [title, content, author_id, category_id, status]
            );
            
            await client.query(
                'UPDATE users SET post_count = post_count + 1 WHERE id = $1',
                [author_id]
            );
            
            await client.query('COMMIT');
            
            const message = (status === 'approved') 
                ? 'Konu başarıyla oluşturuldu.' 
                : 'Konunuz onaya gönderildi. Admin tarafından incelenecektir.';

            res.status(201).json({ 
                message: message, 
                post: newPost.rows[0],
                status: status
            });

        } catch (err) {
            await client.query('ROLLBACK');
            throw err; // Hata ana 'catch' bloğuna gitsin
        } finally {
            client.release();
        }

    } catch (err) {
        console.error("Konu oluştururken hata:", err.message);
        res.status(500).json({ message: 'Sunucu Hatası: Konu oluşturulamadı.' });
    }
});

router.post('/posts', authenticateToken, async (req, res) => {
    try {
        const { title, content, category_id } = req.body;
        const author_id = req.user.id;
        const author_role = req.user.role;
        const author_username = req.user.username; // Token'dan alıyoruz

        if (!title || !content || !category_id) {
            return res.status(400).json({ message: 'Başlık, içerik ve kategori zorunludur.' });
        }
        
        if (author_role !== 'admin') {
            const categoryCheck = await pool.query('SELECT slug FROM categories WHERE id = $1', [category_id]);
            if (categoryCheck.rows.length === 0) {
                return res.status(400).json({ message: 'Geçersiz kategori.' });
            }
            if (categoryCheck.rows[0].slug === 'bilgilendirme') {
                return res.status(403).json({ message: 'Bu kategoriye sadece adminler konu açabilir.' });
            }
        }
        
        const status = (author_role === 'admin') ? 'approved' : 'pending';
        
        const client = await pool.connect();
        let newPostData; // Mail için post verisini tut
        try {
            await client.query('BEGIN');
            
            const newPost = await client.query(
                'INSERT INTO posts (title, content, author_id, category_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [title, content, author_id, category_id, status]
            );
            newPostData = newPost.rows[0]; // Veriyi değişkene ata
            
            await client.query(
                'UPDATE users SET post_count = post_count + 1 WHERE id = $1',
                [author_id]
            );
            
            await client.query('COMMIT');

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
        
        // YENİ: Post onaya düştüyse mail gönder
        if (status === 'pending') {
            // Hata olursa bile akışı bozmuyoruz (await yok)
            sendApprovalEmail(newPostData, author_username)
                .catch(emailError => console.error("Mail gönderme işlemi arka planda hata verdi:", emailError));
        }

        const message = (status === 'approved') 
            ? 'Konu başarıyla oluşturuldu.' 
            : 'Konunuz onaya gönderildi. Admin tarafından incelenecektir.';

        res.status(201).json({ 
            message: message, 
            post: newPostData,
            status: status
        });

    } catch (err) {
        console.error("Konu oluştururken hata:", err.message);
        res.status(500).json({ message: 'Sunucu Hatası: Konu oluşturulamadı.' });
    }
});


// --- ANA SAYFA (SON KONULAR) (GÜNCELLENDİ) ---
// (Sadece 'approved' postları gösterecek)
router.get('/api/posts/recent', async (req, res) => {
    try {
        const recentPosts = await pool.query(`
            SELECT 
                p.id, p.title, p.is_pinned, p.is_locked, p.created_at, 
                c.name AS category_name,
                c.slug AS category_slug,
                u.username AS author_username,
                (SELECT COUNT(*) FROM replies r WHERE r.thread_id = p.id) AS reply_count,
                (SELECT COUNT(*) FROM thread_reactions tr WHERE tr.thread_id = p.id) AS like_count
            FROM posts p
            JOIN users u ON p.author_id = u.id
            JOIN categories c ON p.category_id = c.id
            WHERE p.status = 'approved' -- ONAY FİLTRESİ
            ORDER BY p.is_pinned DESC, p.created_at DESC
            LIMIT 15;
        `);
        res.json(recentPosts.rows);
    } catch (err) {
        console.error("Son konuları getirirken hata:", err.message);
        res.status(500).json({ message: 'Sunucu Hatası: Konular yüklenemedi.' });
    }
});


// --- ARŞİV SAYFASI (GÜNCELLENDİ) ---
// (Sadece 'approved' postları gösterecek + Arama)
router.get('/api/archive', async (req, res) => {
    try {
        const { categoryId, q } = req.query; // 'q' (query) eklendi
        
        let queryText = `
            SELECT 
                p.id, p.title, p.created_at, p.is_pinned,
                c.name AS category_name,
                u.username AS author_username
            FROM posts p
            JOIN users u ON p.author_id = u.id
            JOIN categories c ON p.category_id = c.id
        `;
        
        const params = [];
        // TEMEL FİLTRE: Her zaman sadece onaylıları göster
        let whereClauses = ["p.status = 'approved'"]; 
        let paramIndex = 1;

        if (categoryId) {
            whereClauses.push(`p.category_id = $${paramIndex++}`);
            params.push(categoryId);
        }
        
        if (q && q.trim() !== '') {
            whereClauses.push(`p.title ILIKE $${paramIndex++}`);
            params.push(`%${q}%`); 
        }

        queryText += ' WHERE ' + whereClauses.join(' AND ');
        
        queryText += ' ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT 100;'; 

        const allPosts = await pool.query(queryText, params);
        res.json(allPosts.rows);
        
    } catch (err) {
        console.error("Arşiv getirirken hata:", err.message);
        res.status(500).json({ message: 'Sunucu Hatası: Arşiv yüklenemedi.' });
    }
});

router.get('/api/posts/archive', async (req, res) => {
    try {
        // 1. URL'den parametreleri al (?category=...&search=...)
        const { category, search } = req.query;

        // 2. Temel SQL sorgusu (Sadece onaylıları getir)
        let queryText = `
            SELECT 
                p.id, p.title, p.created_at, 
                c.name AS category_name,
                c.id AS category_id,
                u.username AS author_username
            FROM posts p
            JOIN users u ON p.author_id = u.id
            JOIN categories c ON p.category_id = c.id
            WHERE p.status = 'approved'
        `;
        
        const queryParams = [];

        // 3. Arama filtresi (search) varsa, sorguya ekle
        if (search) {
            queryParams.push(`%${search}%`);
            queryText += ` AND p.title ILIKE $${queryParams.length}`;
        }

        // 4. Kategori filtresi (category) varsa (ID'ye göre), sorguya ekle
        if (category) {
            queryParams.push(category);
            queryText += ` AND c.id = $${queryParams.length}`;
        }
        
        // 5. Sıralama
        queryText += ' ORDER BY p.created_at DESC';

        // 6. Sorguyu çalıştır
        const posts = await pool.query(queryText, queryParams);
        
        res.status(200).json(posts.rows);

    } catch (err) {
        console.error("Arşiv getirilirken hata:", err.message);
        res.status(500).json({ message: 'Sunucu Hatası: Arşiv yüklenemedi.' });
    }
});

// --- KONU (THREAD) DETAY SAYFASI (GÜNCELLENDİ) ---
// (Onaylanmamış postları sadece admin/sahibi görebilir)
router.get('/api/threads/:id', async (req, res) => {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * REPLIES_PER_PAGE;
    
    // Kullanıcı ID'sini ve ROLÜNÜ token'dan al (eğer giriş yapmışsa)
    let currentUserId = null;
    let currentUserRole = 'user';
    if (req.cookies.authToken) {
        try {
            const user = jwt.verify(req.cookies.authToken, process.env.JWT_SECRET);
            currentUserId = user.id;
            currentUserRole = user.role; // Rolü de al
        } catch (err) {
            // Misafir olarak devam et
        }
    }

    try {
        const client = await pool.connect();
        let thread, replies, bestReply = null, totalReplies, totalPages;

        // 1. Ana Konu (Thread) Bilgilerini Çek
        const threadQuery = `
            SELECT 
                p.*, 
                u.username AS author_username, 
                u.avatar_url AS author_avatar,
                u.title AS author_title,
                u.post_count AS author_post_count,
                u.created_at AS author_join_date,
                (SELECT COUNT(*) FROM thread_reactions tr WHERE tr.thread_id = p.id) AS like_count,
                ${currentUserId ? 
                    `EXISTS(SELECT 1 FROM thread_reactions tr WHERE tr.thread_id = p.id AND tr.user_id = ${currentUserId}) AS is_liked_by_user` 
                    : 'FALSE AS is_liked_by_user'}
            FROM posts p
            JOIN users u ON p.author_id = u.id
            WHERE p.id = $1;
        `;
        const threadResult = await client.query(threadQuery, [id]);
        
        if (threadResult.rows.length === 0) {
            client.release();
            return res.status(404).json({ message: 'Konu bulunamadı.' });
        }
        thread = threadResult.rows[0];

        // ONAY KONTROLÜ
        if (thread.status !== 'approved') {
            // Onaylı değilse (pending veya rejected ise)
            // Sadece admin VEYA konunun sahibi görebilir
            if (currentUserRole !== 'admin' && thread.author_id !== currentUserId) {
                client.release();
                return res.status(403).json({ message: 'Bu konuyu görme yetkiniz yok.' });
            }
        }

        // 2. Varsa En İyi Cevabı Çek
        if (thread.best_reply_id) {
            const bestReplyQuery = `
                SELECT 
                    r.*,
                    u.username AS author_username, 
                    u.avatar_url AS author_avatar,
                    u.title AS author_title,
                    u.post_count AS author_post_count,
                    u.created_at AS author_join_date,
                    (SELECT COUNT(*) FROM reply_reactions rr WHERE rr.reply_id = r.id) AS like_count,
                    ${currentUserId ? 
                        `EXISTS(SELECT 1 FROM reply_reactions rr WHERE rr.reply_id = r.id AND rr.user_id = ${currentUserId}) AS is_liked_by_user` 
                        : 'FALSE AS is_liked_by_user'}
                FROM replies r
                JOIN users u ON r.author_id = u.id
                WHERE r.id = $1;
            `;
            const bestReplyResult = await client.query(bestReplyQuery, [thread.best_reply_id]);
            if (bestReplyResult.rows.length > 0) {
                bestReply = bestReplyResult.rows[0];
            }
        }

        // 3. Toplam Cevap Sayısını (En iyi cevap hariç)
        const totalRepliesQuery = `
            SELECT COUNT(*) FROM replies 
            WHERE thread_id = $1 
            ${thread.best_reply_id ? `AND id != ${thread.best_reply_id}` : ''}
        `;
        const totalRepliesResult = await client.query(totalRepliesQuery, [id]);
        totalReplies = parseInt(totalRepliesResult.rows[0].count, 10);
        totalPages = Math.ceil(totalReplies / REPLIES_PER_PAGE);

        // 4. Diğer Cevapları Çek (Sayfalanmış ve En iyi cevap hariç)
        const repliesQuery = `
            SELECT 
                r.*,
                u.username AS author_username, 
                u.avatar_url AS author_avatar,
                u.title AS author_title,
                u.post_count AS author_post_count,
                u.created_at AS author_join_date,
                (SELECT COUNT(*) FROM reply_reactions rr WHERE rr.reply_id = r.id) AS like_count,
                ${currentUserId ? 
                    `EXISTS(SELECT 1 FROM reply_reactions rr WHERE rr.reply_id = r.id AND rr.user_id = ${currentUserId}) AS is_liked_by_user` 
                    : 'FALSE AS is_liked_by_user'}
            FROM replies r
            JOIN users u ON r.author_id = u.id
            WHERE r.thread_id = $1
            ${thread.best_reply_id ? `AND r.id != ${thread.best_reply_id}` : ''}
            ORDER BY r.created_at ASC
            LIMIT $2 OFFSET $3;
        `;
        const repliesResult = await client.query(repliesQuery, [id, REPLIES_PER_PAGE, offset]);
        replies = repliesResult.rows;
        
        client.release();

        res.json({
            thread: thread,
            bestReply: bestReply,
            replies: replies,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalReplies: totalReplies + (bestReply ? 1 : 0) // Toplam cevap (En iyi dahil)
            }
        });

    } catch (err) {
        console.error("Konu detaylarını getirirken hata:", err.message);
        res.status(500).json({ message: 'Sunucu Hatası: Konu detayları yüklenemedi.' });
    }
});

// --- KONUYA CEVAP VERME (Değişmedi) ---
router.post('/api/threads/:id/reply', authenticateToken, async (req, res) => {
    const { id: threadId } = req.params;
    const { content } = req.body;
    const authorId = req.user.id;

    if (!content) {
        return res.status(400).json({ message: 'Cevap içeriği boş olamaz.' });
    }

    try {
        // Konu kilitli mi VEYA onaylı mı diye kontrol et (onaylı değilse de cevap yazılabilir)
        const threadCheck = await pool.query('SELECT is_locked, best_reply_id, status FROM posts WHERE id = $1', [threadId]);
        if (threadCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Konu bulunamadı.' });
        }
        if (threadCheck.rows[0].is_locked) {
            return res.status(403).json({ message: 'Bu konu kilitlenmiştir, cevap yazılamaz.' });
        }
        
        const client = await pool.connect();
        let newReplyId;
        try {
            await client.query('BEGIN');
            
            // 1. Cevabı ekle
            const newReply = await client.query(
                'INSERT INTO replies (content, thread_id, author_id) VALUES ($1, $2, $3) RETURNING id',
                [content, threadId, authorId]
            );
            newReplyId = newReply.rows[0].id;
            
            // 2. Kullanıcının post sayısını güncelle
            await client.query(
                'UPDATE users SET post_count = post_count + 1 WHERE id = $1',
                [authorId]
            );
            
            await client.query('COMMIT');
            
            // 3. Kullanıcıyı yönlendirmek için son sayfa numarasını hesapla
            const bestReplyId = threadCheck.rows[0].best_reply_id;
            const totalRepliesQuery = `
                SELECT COUNT(*) FROM replies 
                WHERE thread_id = $1 
                ${bestReplyId ? `AND id != ${bestReplyId}` : ''}
            `;
            const totalRepliesResult = await pool.query(totalRepliesQuery, [threadId]);
            const totalReplies = parseInt(totalRepliesResult.rows[0].count, 10);
            const lastPage = Math.ceil(totalReplies / REPLIES_PER_PAGE);

            res.status(201).json({ 
                message: 'Cevap başarıyla eklendi.', 
                replyId: newReplyId, 
                lastPage: lastPage 
            });

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (err) {
        console.error("Cevap eklerken hata:", err.message);
        res.status(500).json({ message: 'Sunucu Hatası: Cevap eklenemedi.' });
    }
});


// --- KULLANICI PROFİL ROTASI (GÜNCELLENDİ) ---
// (Reddedilen ve Onay Bekleyen postları da çekecek)
router.get('/api/profile/:username', async (req, res) => {
    try {
        const { username } = req.params;

        // 1. Kullanıcı bilgilerini çek
        const userQuery = pool.query(
            'SELECT id, username, avatar_url, title, post_count, created_at FROM users WHERE username = $1',
            [username]
        );
        const userResult = await userQuery;

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }
        const user = userResult.rows[0];
        const userId = user.id;

        // 2. Kullanıcının son aktivitelerini (cevaplarını) çek
        // (Sadece 'approved' konulardaki cevaplar)
        const recentRepliesQuery = pool.query(`
            SELECT 
                r.id AS reply_id, 
                r.content, 
                r.created_at,
                p.id AS thread_id,
                p.title AS thread_title
            FROM replies r
            JOIN posts p ON r.thread_id = p.id
            WHERE r.author_id = $1 AND p.status = 'approved'
            ORDER BY r.created_at DESC
            LIMIT 15;
        `, [userId]);
        
        // 3. YENİ: Kullanıcının reddedilen postlarını çek
        const rejectedPostsQuery = pool.query(`
            SELECT id, title, status FROM posts 
            WHERE author_id = $1 AND status = 'rejected'
            ORDER BY created_at DESC
            LIMIT 5;
        `, [userId]);

        // 4. YENİ: Kullanıcının onay bekleyen postlarını çek
        const pendingPostsQuery = pool.query(`
            SELECT id, title, status FROM posts
            WHERE author_id = $1 AND status = 'pending'
            ORDER BY created_at DESC
            LIMIT 5;
        `, [userId]);

        // Tüm sorguların bitmesini bekle
        const [repliesResult, rejectedPostsResult, pendingPostsResult] = await Promise.all([
            recentRepliesQuery,
            rejectedPostsQuery,
            pendingPostsQuery
        ]);

        res.json({
            user: user,
            recentActivity: repliesResult.rows,
            rejectedPosts: rejectedPostsResult.rows, // YENİ
            pendingPosts: pendingPostsResult.rows   // YENİ
        });

    } catch (err) {
        console.error("Profil getirirken hata:", err.message);
        res.status(500).json({ message: 'Sunucu Hatası: Profil yüklenemedi.' });
    }
});


module.exports = router;