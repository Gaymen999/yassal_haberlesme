const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/authMiddleware');
const router = express.Router();

const POSTS_PER_PAGE = 20; 
const REPLIES_PER_PAGE = 20;

// --- KATEGORİ ROTALARI ---
// (Bu rotalar aynı kaldı)
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
            ORDER BY p.is_pinned DESC, p.created_at DESC;
        `, [slug]);
        if (postsInCategory.rows.length === 0) {
            return res.status(404).json({ message: 'Kategori bulunamadı veya bu kategoride konu yok.' });
        }
        res.json(postsInCategory.rows);
    } catch (err) {
        console.error("Kategori konularını getirirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});


// --- KONU (THREAD/POST) ROTALARI ---

// DEĞİŞTİ: Yeni Konu Açma (/posts) (Kategori zorunluluğu kaldırıldı)
router.post('/posts', authenticateToken, async (req, res) => { 
    try {
        // DEĞİŞTİ: category_id artık opsiyonel
        const { title, content, category_id } = req.body; 
        const authorId = req.user.id; 

        // DEĞİŞTİ: Kategori kontrolü kaldırıldı
        if (!title || !content) {
            return res.status(400).json({ message: 'Başlık ve içerik zorunludur.' });
        }
        
        const newPost = await pool.query(
            'INSERT INTO posts (title, content, category_id, author_id) VALUES ($1, $2, $3, $4) RETURNING *',
            // DEĞİŞTİ: Kategori ID gelmezse 'null' gönder
            [title, content, category_id || null, authorId] 
        );
        
        await pool.query('UPDATE users SET post_count = post_count + 1 WHERE id = $1', [authorId]);

        res.status(201).json({ 
            message: 'Konunuz başarıyla yayınlandı!', 
            post: newPost.rows[0] 
        });
    } catch (err) {
        console.error("Yeni konu oluşturulurken hata:", err.message);
        if (err.code === '23503') { 
             return res.status(404).json({ message: 'Geçersiz kategori ID.' });
        }
        res.status(500).send('Sunucu Hatası');
    }
});

// (Diğer tüm rotalar: /api/posts, /api/archive-posts, /api/threads/:id, 
// /api/threads/:id/reply, /api/profile/:username aynı kaldı)
// ... (DOSYANIN GERİ KALANI AYNI) ...
router.get('/api/posts', async (req, res) => { 
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const offset = (page - 1) * POSTS_PER_PAGE;

        // 1. Toplam konu sayısını çek (sabitlenmemiş olanları)
        const totalPostsQuery = pool.query('SELECT COUNT(*) FROM posts WHERE is_pinned = false');
        
        // 2. Sabitlenmiş konuları çek (bunlar sayfalama dışıdır, her zaman en üstte)
        const pinnedPostsQuery = pool.query(`
            SELECT 
                p.id, p.title, p.is_pinned, p.created_at, 
                c.name AS category_name, c.slug AS category_slug,
                u.username AS author_username, u.avatar_url AS author_avatar,
                (SELECT COUNT(*) FROM replies r WHERE r.thread_id = p.id) AS reply_count,
                (SELECT COUNT(*) FROM thread_reactions tr WHERE tr.thread_id = p.id) AS like_count
            FROM posts p
            JOIN users u ON p.author_id = u.id
            JOIN categories c ON p.category_id = c.id
            WHERE p.is_pinned = true
            ORDER BY p.created_at DESC;
        `);

        // 3. Sayfalanmış normal konuları çek
        const postsQuery = pool.query(`
            SELECT 
                p.id, p.title, p.is_pinned, p.created_at, 
                c.name AS category_name, c.slug AS category_slug,
                u.username AS author_username, u.avatar_url AS author_avatar,
                (SELECT COUNT(*) FROM replies r WHERE r.thread_id = p.id) AS reply_count,
                (SELECT COUNT(*) FROM thread_reactions tr WHERE tr.thread_id = p.id) AS like_count
            FROM posts p
            JOIN users u ON p.author_id = u.id
            JOIN categories c ON p.category_id = c.id
            WHERE p.is_pinned = false
            ORDER BY p.created_at DESC
            LIMIT $1 OFFSET $2;
        `, [POSTS_PER_PAGE, offset]);

        // Sorguları paralel çalıştır
        const [totalResult, pinnedResult, postsResult] = await Promise.all([
            totalPostsQuery,
            pinnedPostsQuery,
            postsQuery
        ]);

        const totalPosts = parseInt(totalResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);
        
        // Sabitlenmiş konuları ve normal konuları birleştir
        const allPosts = [
            ...pinnedResult.rows,
            ...postsResult.rows
        ];
        
        res.json({
            posts: allPosts,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalPosts: totalPosts
            }
        });

    } catch (err) {
        console.error("Konuları getirirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});
router.get('/api/archive-posts', async (req, res) => { 
    try {
        const archivedPosts = await pool.query(`
            SELECT 
                p.id, p.title, p.content, p.created_at, 
                c.name AS category_name,
                c.slug AS category_slug,
                u.username AS author_username
            FROM posts p
            JOIN users u ON p.author_id = u.id
            JOIN categories c ON p.category_id = c.id
            ORDER BY p.created_at DESC;
        `);
        res.json(archivedPosts.rows);
    } catch (err) {
        console.error("Arşivlenmiş konuları getirirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});
router.get('/api/threads/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page, 10) || 1;
        const offset = (page - 1) * REPLIES_PER_PAGE;

        // 1. Konunun ana bilgisini çek (Reaksiyon bilgisi eklendi)
        const threadQuery = pool.query(`
            SELECT 
                p.id, p.title, p.content, p.created_at, p.is_locked, p.best_reply_id, p.author_id,
                c.name AS category_name,
                u.username AS author_username,
                u.avatar_url AS author_avatar,
                u.title AS author_title,
                u.post_count AS author_post_count,
                u.created_at AS author_join_date,
                
                (SELECT COUNT(*) FROM thread_reactions tr WHERE tr.thread_id = p.id) AS like_count,
                (SELECT ARRAY_AGG(tr.user_id) FROM thread_reactions tr WHERE tr.thread_id = p.id) AS liked_by_users

            FROM posts p
            JOIN users u ON p.author_id = u.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.id = $1;
        `, [id]);

        // 2. Sayfalanmış cevapları çek (Reaksiyon bilgisi eklendi)
        const repliesQuery = pool.query(`
            SELECT 
                r.id, r.content, r.created_at,
                u.username AS author_username,
                u.avatar_url AS author_avatar,
                u.title AS author_title,
                u.post_count AS author_post_count,
                u.created_at AS author_join_date,

                (SELECT COUNT(*) FROM reply_reactions rr WHERE rr.reply_id = r.id) AS like_count,
                (SELECT ARRAY_AGG(rr.user_id) FROM reply_reactions rr WHERE rr.reply_id = r.id) AS liked_by_users

            FROM replies r
            JOIN users u ON r.author_id = u.id
            WHERE r.thread_id = $1
            ORDER BY r.created_at ASC
            LIMIT $2 OFFSET $3; 
        `, [id, REPLIES_PER_PAGE, offset]);

        // 3. Toplam cevap sayısını çek (Aynı kaldı)
        const repliesCountQuery = pool.query(
            'SELECT COUNT(*) FROM replies WHERE thread_id = $1',
            [id]
        );

        // Sorguları çalıştır
        const [threadResult, repliesResult, repliesCountResult] = await Promise.all([
            threadQuery, 
            repliesQuery, 
            repliesCountQuery
        ]);

        if (threadResult.rows.length === 0) {
            return res.status(404).json({ message: 'Konu bulunamadı.' });
        }

        const thread = threadResult.rows[0];
        const replies = repliesResult.rows;
        const totalReplies = parseInt(repliesCountResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalReplies / REPLIES_PER_PAGE);
        
        // 4. En iyi cevabı çek (Aynı kaldı)
        let bestReply = null;
        if (thread.best_reply_id) {
            const bestReplyQuery = await pool.query(`
                SELECT 
                    r.id, r.content, r.created_at,
                    u.username AS author_username,
                    u.avatar_url AS author_avatar,
                    u.title AS author_title,
                    u.post_count AS author_post_count,
                    u.created_at AS author_join_date,
                    
                    (SELECT COUNT(*) FROM reply_reactions rr WHERE rr.reply_id = r.id) AS like_count,
                    (SELECT ARRAY_AGG(rr.user_id) FROM reply_reactions rr WHERE rr.reply_id = r.id) AS liked_by_users
                    
                FROM replies r
                JOIN users u ON r.author_id = u.id
                WHERE r.id = $1;
            `, [thread.best_reply_id]);
            
            if (bestReplyQuery.rows.length > 0) {
                bestReply = bestReplyQuery.rows[0];
            }
        }

        res.json({ 
            thread, 
            replies,
            bestReply: bestReply,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalReplies: totalReplies,
                repliesPerPage: REPLIES_PER_PAGE
            }
        });

    } catch (err) {
        console.error("Konu ve cevapları getirirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});
router.post('/api/threads/:id/reply', authenticateToken, async (req, res) => {
    try {
        const { id: threadId } = req.params; 
        const { content } = req.body;        
        const authorId = req.user.id;      

        if (!content) {
            return res.status(400).json({ message: 'Cevap içeriği boş olamaz.' });
        }
        
        const threadCheck = await pool.query('SELECT is_locked FROM posts WHERE id = $1', [threadId]);
        if (threadCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Konu bulunamadı.' });
        }
        if (threadCheck.rows[0].is_locked) {
            return res.status(403).json({ message: 'Bu konu kilitlenmiştir, yeni cevap yazılamaz.' }); 
        }
        
        const repliesCountResult = await pool.query(
            'SELECT COUNT(*) FROM replies WHERE thread_id = $1',
            [threadId]
        );
        const totalReplies = parseInt(repliesCountResult.rows[0].count, 10);
        
        const newReply = await pool.query(
            'INSERT INTO replies (content, thread_id, author_id) VALUES ($1, $2, $3) RETURNING *',
            [content, threadId, authorId]
        );
        
        await pool.query('UPDATE users SET post_count = post_count + 1 WHERE id = $1', [authorId]);

        const newTotalReplies = totalReplies + 1;
        const lastPage = Math.ceil(newTotalReplies / REPLIES_PER_PAGE);

        res.status(201).json({
            message: 'Cevabınız başarıyla eklendi.',
            reply: newReply.rows[0],
            lastPage: lastPage 
        });

    } catch (err) {
        console.error("Cevap eklerken hata:", err.message);
        if (err.code === '23503') { 
             return res.status(404).json({ message: 'Cevap yazmaya çalıştığınız konu bulunamadı.' });
        }
        res.status(500).send('Sunucu Hatası');
    }
});
router.get('/api/profile/:username', async (req, res) => {
    try {
        const { username } = req.params;

        // 1. Kullanıcı bilgilerini çek (username'e göre)
        const userQuery = pool.query(
            'SELECT id, username, avatar_url, title, post_count, created_at FROM users WHERE username = $1',
            [username]
        );

        // 2. Kullanıcının son 15 cevabını çek
        const userResult = await userQuery;
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }
        
        const user = userResult.rows[0];
        const userId = user.id;

        // Şimdi bu ID ile son cevapları çekelim
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
        console.error("Profil bilgisi getirilirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

module.exports = router;