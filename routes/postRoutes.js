// routes/postRoutes.js

const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/authMiddleware');
const router = express.Router();
const jwt = require('jsonwebtoken');

const POSTS_PER_PAGE = 20; 
const REPLIES_PER_PAGE = 20;

// --- KATEGORİ ROTALARI ---
router.get('/api/categories', async (req, res) => { 
    try {
        const categories = await pool.query('SELECT * FROM categories ORDER BY name ASC');
        res.json(categories.rows);
    } catch (err) {
        console.error("Kategorileri getirirken hata:", err.message);
        res.status(500).json({ message: 'Sunucu Hatası' }); // JSON DÖN
    }
});

// DEĞİŞTİ: Sadece 'approved' postları gösterecek
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
            WHERE c.slug = $1 AND p.status = 'approved' -- YENİ FİLTRE
            ORDER BY p.is_pinned DESC, p.created_at DESC;
        `, [slug]);
        
        if (postsInCategory.rows.length === 0) {
            const categoryCheck = await pool.query('SELECT * FROM categories WHERE slug = $1', [slug]);
            if (categoryCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Kategori bulunamadı.' });
            }
        }
        
        res.json(postsInCategory.rows);
    } catch (err) {
        console.error("Kategori postlarını getirirken hata:", err.message);
        res.status(500).json({ message: 'Sunucu Hatası' }); // JSON DÖN
    }
});


// --- YENİ KONU OLUŞTURMA (DEĞİŞTİ) ---
router.post('/posts', authenticateToken, async (req, res) => {
    try {
        const { title, content, category_id } = req.body;
        const author_id = req.user.id;
        const author_role = req.user.role; // YENİ: Kullanıcı rolünü al

        if (!title || !content || !category_id) {
            return res.status(400).json({ message: 'Başlık, içerik ve kategori zorunludur.' });
        }
        
        // YENİ: Admin ise 'approved', değilse 'pending'
        const status = (author_role === 'admin') ? 'approved' : 'pending';
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // YENİ: 'status' sütunu sorguya eklendi
            const newPost = await client.query(
                'INSERT INTO posts (title, content, author_id, category_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [title, content, author_id, category_id, status]
            );
            
            // Post sayısını sadece 'approved' ise artırabiliriz veya hep artırabiliriz.
            // Şimdilik hep artıralım, reddedilirse bir önemi kalmaz.
            await client.query(
                'UPDATE users SET post_count = post_count + 1 WHERE id = $1',
                [author_id]
            );
            
            await client.query('COMMIT');
            
            // YENİ: Mesajı duruma göre ayarla
            const message = (status === 'approved') 
                ? 'Konu başarıyla oluşturuldu.' 
                : 'Konunuz onaya gönderildi. Admin tarafından incelenecektir.';

            res.status(201).json({ 
                message: message, 
                post: newPost.rows[0],
                status: status // Frontend'in yönlendirme yapması için
            });

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (err) {
        console.error("Konu oluştururken hata:", err.message);
        res.status(500).json({ message: 'Sunucu Hatası' }); // JSON DÖN
    }
});


// --- ANA SAYFA (SON KONULAR) (DEĞİŞTİ) ---
// DEĞİŞTİ: Sadece 'approved' postları gösterecek
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
            WHERE p.status = 'approved' -- YENİ FİLTRE
            ORDER BY p.is_pinned DESC, p.created_at DESC
            LIMIT 15;
        `);
        res.json(recentPosts.rows);
    } catch (err) {
        console.error("Son konuları getirirken hata:", err.message);
        res.status(500).json({ message: 'Sunucu Hatası' }); // JSON DÖN
    }
});


// --- ARŞİV SAYFASI (DEĞİŞTİ) ---
// DEĞİŞTİ: Sadece 'approved' postları gösterecek (ve arama)
router.get('/api/archive', async (req, res) => {
    try {
        const { categoryId, q } = req.query; 
        
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
        // YENİ: Temel filtre her zaman 'approved' olmalı
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

        if (whereClauses.length > 0) {
            queryText += ' WHERE ' + whereClauses.join(' AND ');
        }
        
        queryText += ' ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT 100;'; 

        const allPosts = await pool.query(queryText, params);
        res.json(allPosts.rows);
        
    } catch (err) {
        console.error("Arşiv getirirken hata:", err.message);
        res.status(500).json({ message: 'Sunucu Hatası' }); // JSON DÖN
    }
});


// --- KONU (THREAD) DETAY SAYFASI (DEĞİŞTİ) ---
router.get('/api/threads/:id', async (req, res) => {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * REPLIES_PER_PAGE;
    
    let currentUserId = null;
    let currentUserRole = 'user';
    if (req.cookies.authToken) {
        try {
            const user = jwt.verify(req.cookies.authToken, process.env.JWT_SECRET);
            currentUserId = user.id;
            currentUserRole = user.role; // YENİ: Admin mi diye bak
        } catch (err) {
            // Misafir
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

        // YENİ: Konu onaylı değilse, sadece admin veya postun sahibi görebilir
        if (thread.status !== 'approved') {
            if (currentUserRole !== 'admin' && thread.author_id !== currentUserId) {
                client.release();
                return res.status(403).json({ message: 'Bu konuyu görme yetkiniz yok.' });
            }
        }

        // 2. Varsa En İyi Cevabı Çek (Kalanı aynı)
        if (thread.best_reply_id) {
            // ... (best reply sorgusu aynı) ...
            const bestReplyQuery = `...`; // Bu sorgu değişmedi
            const bestReplyResult = await client.query(bestReplyQuery, [thread.best_reply_id]);
            if (bestReplyResult.rows.length > 0) {
                bestReply = bestReplyResult.rows[0];
            }
        }

        // 3. Toplam Cevap Sayısı (Kalanı aynı)
        const totalRepliesQuery = `...`; // Bu sorgu değişmedi
        const totalRepliesResult = await client.query(totalRepliesQuery, [id]);
        totalReplies = parseInt(totalRepliesResult.rows[0].count, 10);
        totalPages = Math.ceil(totalReplies / REPLIES_PER_PAGE);

        // 4. Diğer Cevapları Çek (Kalanı aynı)
        const repliesQuery = `...`; // Bu sorgu değişmedi
        const repliesResult = await client.query(repliesQuery, [id, REPLIES_PER_PAGE, offset]);
        replies = repliesResult.rows;
        
        client.release();

        res.json({
            thread: thread,
            bestReply: bestReply,
            replies: replies,
            pagination: { /* ... */ }
        });

    } catch (err) {
        console.error("Konu detaylarını getirirken hata:", err.message);
        res.status(500).json({ message: 'Sunucu Hatası' }); // JSON DÖN
    }
});

// --- KONUYA CEVAP VERME (Aynı, değişmedi) ---
router.post('/api/threads/:id/reply', authenticateToken, async (req, res) => {
    // ... (Bu fonksiyonun içi aynı) ...
});


// --- KULLANICI PROFİL ROTASI (DEĞİŞTİ) ---
// YENİ: Kullanıcının reddedilen postlarını da çekeceğiz
router.get('/api/profile/:username', async (req, res) => {
    try {
        const { username } = req.params;

        // 1. Kullanıcı bilgilerini çek
        const userResult = await pool.query(
            'SELECT id, username, avatar_url, title, post_count, created_at FROM users WHERE username = $1',
            [username]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }
        const user = userResult.rows[0];
        const userId = user.id;

        // 2. Kullanıcının son aktivitelerini (cevaplarını) çek (Bu aynı)
        const recentRepliesQuery = pool.query(`
            SELECT 
                r.id AS reply_id, r.content, r.created_at,
                p.id AS thread_id, p.title AS thread_title
            FROM replies r
            JOIN posts p ON r.thread_id = p.id
            WHERE r.author_id = $1 AND p.status = 'approved' -- Sadece onaylı konulardaki cevaplar
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
        res.status(500).json({ message: 'Sunucu Hatası' }); // JSON DÖN
    }
});


module.exports = router;