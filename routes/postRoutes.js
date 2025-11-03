const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/authMiddleware');
const router = express.Router();

const POSTS_PER_PAGE = 20; 
const REPLIES_PER_PAGE = 20;

// --- KATEGORİ ROTALARI ---
// (Bu rotalar doğru, dokunmuyoruz)
router.get('/api/categories', async (req, res) => { 
    try {
        const categories = await pool.query('SELECT * FROM categories ORDER BY name ASC');
        res.json(categories.rows);
    } catch (err) {
        console.error("Kategorileri getirirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

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
            WHERE c.slug = $1
            ORDER BY p.is_pinned DESC, p.created_at DESC; -- (Bu sorgu zaten doğruymuş)
        `, [slug]);
        
        if (postsInCategory.rows.length === 0) {
            return res.status(404).json({ message: 'Bu kategori bulunamadı veya hiç konu içermiyor.' });
        }
        
        res.json(postsInCategory.rows);
    } catch (err) {
        console.error("Kategori konularını getirirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});


// --- KONU (POST) ROTALARI ---

// YENİ KONU OLUŞTURMA
// (Bu rota doğru, dokunmuyoruz)
router.post('/posts', authenticateToken, async (req, res) => {
    try {
        const { title, content, category_id } = req.body;
        const author_id = req.user.id; 

        if (!title || !content || !category_id) {
            return res.status(400).json({ message: 'Başlık, içerik ve kategori ID zorunludur.' });
        }

        const newPost = await pool.query(
            `INSERT INTO posts (title, content, author_id, category_id) 
             VALUES ($1, $2, $3, $4) 
             RETURNING id, title, created_at`,
            [title, content, author_id, category_id]
        );
        
        // Kullanıcının post_count'unu artır
        await pool.query('UPDATE users SET post_count = post_count + 1 WHERE id = $1', [author_id]);

        res.status(201).json({ message: 'Konu başarıyla oluşturuldu.', post: newPost.rows[0] });
    } catch (err) {
        console.error("Konu oluşturulurken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});


// ANA SAYFA - SON KONULARI GETİR (15 ADET)
router.get('/api/posts/recent', async (req, res) => { 
    try {
        const recentPosts = await pool.query(`
            SELECT 
                p.id, p.title, p.is_pinned, p.is_locked, p.created_at, 
                c.name AS category_name,
                c.slug AS category_slug,
                u.username AS author_username,
                u.avatar_url AS author_avatar,
                (SELECT COUNT(*) FROM replies r WHERE r.thread_id = p.id) AS reply_count,
                (SELECT COUNT(*) FROM thread_reactions tr WHERE tr.thread_id = p.id) AS like_count
            FROM posts p
            JOIN users u ON p.author_id = u.id
            JOIN categories c ON p.category_id = c.id
            
            -- HATA BURADAYDI (last_activity_at yoktu) --
            ORDER BY p.is_pinned DESC, p.created_at DESC 
            -- DÜZELTİLDİ --
            
            LIMIT 15;
        `);
        res.json(recentPosts.rows);
    } catch (err) {
        console.error("Son konuları getirirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

// ARŞİV SAYFASI - TÜM KONULARI GETİR (KATEGORİ FİLTRELİ)
// (Bu rota doğru, dokunmuyoruz)
router.get('/api/archive', async (req, res) => {
    try {
        const { categoryId } = req.query; 
        
        let queryText = `
            SELECT 
                p.id, p.title, p.created_at, 
                c.name AS category_name,
                u.username AS author_username
            FROM posts p
            JOIN users u ON p.author_id = u.id
            JOIN categories c ON p.category_id = c.id
        `;
        
        const params = [];
        
        if (categoryId) {
            params.push(categoryId);
            queryText += ' WHERE p.category_id = $1';
        }
        
        queryText += ' ORDER BY p.created_at DESC LIMIT 100;'; // Son 100 konuyu getir

        const allPosts = await pool.query(queryText, params);
        res.json(allPosts.rows);
        
    } catch (err) {
        console.error("Arşiv getirirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});


// (Kalan rotalar (TEK KONU GETİRME, CEVAP YAZMA, PROFİL GETİRME) doğru, dokunmuyoruz)

// TEK KONU (THREAD) VE CEVAPLARINI GETİR
router.get('/api/threads/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const offset = (page - 1) * REPLIES_PER_PAGE;

        // 1. Konu (Thread) Bilgileri
        const threadQuery = pool.query(`
            SELECT 
                p.id, p.title, p.content, p.created_at, p.is_locked, p.is_pinned, p.best_reply_id,
                p.author_id,
                u.username AS author_username,
                u.avatar_url AS author_avatar,
                u.title AS author_title,
                u.post_count AS author_post_count,
                u.created_at AS author_join_date,
                c.name AS category_name,
                c.slug AS category_slug,
                (SELECT COUNT(*) FROM thread_reactions tr WHERE tr.thread_id = p.id) AS like_count,
                (SELECT EXISTS (
                    SELECT 1 FROM thread_reactions tr 
                    WHERE tr.thread_id = p.id AND tr.user_id = $2
                )) AS user_has_liked
            FROM posts p
            JOIN users u ON p.author_id = u.id
            JOIN categories c ON p.category_id = c.id
            WHERE p.id = $1;
        `, [id, req.user?.id || 0]); // req.user.id yoksa 0 ata (misafir)

        // 2. Toplam Cevap Sayısı (Sayfalama için)
        const totalRepliesQuery = pool.query('SELECT COUNT(*) FROM replies WHERE thread_id = $1', [id]);

        // 3. Varsa "En İyi Cevap"
        const bestReplyQuery = pool.query(`
            SELECT 
                r.id, r.content, r.created_at, r.author_id,
                u.username AS author_username,
                u.avatar_url AS author_avatar,
                u.title AS author_title,
                u.post_count AS author_post_count,
                u.created_at AS author_join_date,
                (SELECT COUNT(*) FROM reply_reactions rr WHERE rr.reply_id = r.id) AS like_count,
                (SELECT EXISTS (
                    SELECT 1 FROM reply_reactions rr 
                    WHERE rr.reply_id = r.id AND rr.user_id = $2
                )) AS user_has_liked
            FROM replies r
            JOIN users u ON r.author_id = u.id
            WHERE r.id = (SELECT best_reply_id FROM posts WHERE id = $1)
        `, [id, req.user?.id || 0]);

        // 4. Normal Cevaplar (Sayfalanmış)
        const repliesQuery = pool.query(`
            SELECT 
                r.id, r.content, r.created_at, r.author_id,
                u.username AS author_username,
                u.avatar_url AS author_avatar,
                u.title AS author_title,
                u.post_count AS author_post_count,
                u.created_at AS author_join_date,
                (SELECT COUNT(*) FROM reply_reactions rr WHERE rr.reply_id = r.id) AS like_count,
                (SELECT EXISTS (
                    SELECT 1 FROM reply_reactions rr 
                    WHERE rr.reply_id = r.id AND rr.user_id = $2
                )) AS user_has_liked
            FROM replies r
            JOIN users u ON r.author_id = u.id
            WHERE r.thread_id = $1 
              AND r.id != (SELECT best_reply_id FROM posts WHERE id = $1)
            ORDER BY r.created_at ASC
            LIMIT $3 OFFSET $4;
        `, [id, req.user?.id || 0, REPLIES_PER_PAGE, offset]);

        // Tüm sorguları aynı anda çalıştır
        const [
            threadResult, 
            totalRepliesResult, 
            bestReplyResult, 
            repliesResult
        ] = await Promise.all([threadQuery, totalRepliesQuery, bestReplyQuery, repliesQuery]);

        if (threadResult.rows.length === 0) {
            return res.status(404).json({ message: 'Konu bulunamadı.' });
        }

        const totalReplies = parseInt(totalRepliesResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalReplies / REPLIES_PER_PAGE);

        res.json({
            thread: threadResult.rows[0],
            bestReply: bestReplyResult.rows.length > 0 ? bestReplyResult.rows[0] : null,
            replies: repliesResult.rows,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalReplies: totalReplies
            }
        });
    } catch (err) {
        console.error("Konu getirilirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});


// BİR KONUYA CEVAP YAZMA
router.post('/api/threads/:id/reply', authenticateToken, async (req, res) => {
    try {
        const { id: threadId } = req.params;
        const { content } = req.body;
        const author_id = req.user.id;

        if (!content) {
            return res.status(400).json({ message: 'Cevap içeriği boş olamaz.' });
        }

        // Konu kilitli mi diye kontrol et
        const threadCheck = await pool.query('SELECT is_locked FROM posts WHERE id = $1', [threadId]);
        if (threadCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Cevap yazmaya çalıştığınız konu bulunamadı.' });
        }
        if (threadCheck.rows[0].is_locked) {
            return res.status(403).json({ message: 'Bu konu kilitlendiği için cevap yazılamaz.' });
        }

        const newReply = await pool.query(
            'INSERT INTO replies (thread_id, author_id, content) VALUES ($1, $2, $3) RETURNING *',
            [threadId, author_id, content]
        );
        
        // Kullanıcının post_count'unu artır
        await pool.query('UPDATE users SET post_count = post_count + 1 WHERE id = $1', [author_id]);

        res.status(201).json({ message: 'Cevap başarıyla gönderildi.', reply: newReply.rows[0] });
    } catch (err) {
        console.error("Cevap gönderilirken hata:", err.message);
        if (err.code === '23503') { // Foreign key violation
             return res.status(404).json({ message: 'Cevap yazmaya çalıştığınız konu bulunamadı.' });
        }
        res.status(500).send('Sunucu Hatası');
    }
});

// --- KULLANICI PROFİL ROTASI ---
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
        const recentRepliesQuery = pool.query(`
            SELECT 
                r.id AS reply_id, 
                r.content, 
                r.created_at,
                p.id AS thread_id,
                p.title AS thread_title
            FROM replies r
            JOIN posts p ON r.thread_id = p.id
            WHERE r.author_id = $1
            ORDER BY r.created_at DESC
            LIMIT 15;
        `, [userId]);
        
        const repliesResult = await recentRepliesQuery;

        res.json({
            user: user,
            recentActivity: repliesResult.rows
        });

    } catch (err) {
        console.error("Profil getirilirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});


module.exports = router;