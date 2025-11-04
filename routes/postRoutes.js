// routes/postRoutes.js

const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/authMiddleware');
const router = express.Router();
const jwt = require('jsonwebtoken'); // YENİ: user-status için eklendi

const POSTS_PER_PAGE = 20; 
const REPLIES_PER_PAGE = 20;

// --- KATEGORİ ROTALARI ---
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
            const categoryCheck = await pool.query('SELECT * FROM categories WHERE slug = $1', [slug]);
            if (categoryCheck.rows.length === 0) {
                return res.status(404).json({ message: 'Kategori bulunamadı.' });
            }
        }
        
        res.json(postsInCategory.rows);
    } catch (err) {
        console.error("Kategori postlarını getirirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

// --- YENİ KONU OLUŞTURMA ---
router.post('/posts', authenticateToken, async (req, res) => {
    try {
        const { title, content, category_id } = req.body;
        const author_id = req.user.id; 

        if (!title || !content || !category_id) {
            return res.status(400).json({ message: 'Başlık, içerik ve kategori zorunludur.' });
        }
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            const newPost = await client.query(
                'INSERT INTO posts (title, content, author_id, category_id) VALUES ($1, $2, $3, $4) RETURNING *',
                [title, content, author_id, category_id]
            );
            
            await client.query(
                'UPDATE users SET post_count = post_count + 1 WHERE id = $1',
                [author_id]
            );
            
            await client.query('COMMIT');
            
            res.status(201).json({ message: 'Konu başarıyla oluşturuldu.', post: newPost.rows[0] });

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (err) {
        console.error("Konu oluştururken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

// --- ANA SAYFA (SON KONULAR) ---
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
            ORDER BY p.is_pinned DESC, p.created_at DESC
            LIMIT 15;
        `);
        res.json(recentPosts.rows);
    } catch (err) {
        console.error("Son konuları getirirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});


// --- YENİ EKLENDİ: ARŞİV / ARAMA ROTASI (Madde 3 ve Admin Paneli için) ---
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
        let whereClauses = [];
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
        
        // Admin paneli için sabitlenmişleri de üste al
        queryText += ' ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT 100;'; 

        const allPosts = await pool.query(queryText, params);
        res.json(allPosts.rows);
        
    } catch (err) {
        console.error("Arşiv getirirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});


// --- KONU (THREAD) DETAY SAYFASI ---
router.get('/api/threads/:id', async (req, res) => {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * REPLIES_PER_PAGE;
    
    let currentUserId = null;
    if (req.cookies.authToken) {
        try {
            // YENİ: Token'ı burada da doğrula (güvenlik)
            const user = jwt.verify(req.cookies.authToken, process.env.JWT_SECRET);
            currentUserId = user.id;
        } catch (err) {
            // Token geçersizse misafir olarak devam et
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
            return res.status(404).json({ message: 'Konu bulunamadı.' });
        }
        thread = threadResult.rows[0];

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
                totalReplies: totalReplies + (bestReply ? 1 : 0)
            }
        });

    } catch (err) {
        console.error("Konu detaylarını getirirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

// --- KONUYA CEVAP VERME ---
router.post('/api/threads/:id/reply', authenticateToken, async (req, res) => {
    const { id: threadId } = req.params;
    const { content } = req.body;
    const authorId = req.user.id;

    if (!content) {
        return res.status(400).json({ message: 'Cevap içeriği boş olamaz.' });
    }

    try {
        const threadCheck = await pool.query('SELECT is_locked, best_reply_id FROM posts WHERE id = $1', [threadId]);
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
            
            const newReply = await client.query(
                'INSERT INTO replies (content, thread_id, author_id) VALUES ($1, $2, $3) RETURNING id',
                [content, threadId, authorId]
            );
            newReplyId = newReply.rows[0].id;
            
            await client.query(
                'UPDATE users SET post_count = post_count + 1 WHERE id = $1',
                [authorId]
            );
            
            await client.query('COMMIT');
            
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
        res.status(500).send('Sunucu Hatası');
    }
});


// --- KULLANICI PROFİL ROTASI ---
router.get('/api/profile/:username', async (req, res) => {
    try {
        const { username } = req.params;

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
        console.error("Profil getirirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});


module.exports = router;