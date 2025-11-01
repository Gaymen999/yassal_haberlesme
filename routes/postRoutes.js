const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/authMiddleware');
const router = express.Router();

// Sayfa başına gösterilecek cevap sayısı
const REPLIES_PER_PAGE = 20; // Technopat 20 kullanıyor

// --- KATEGORİ ROTALARI ---
// (Bu rotalar değişmedi, aynı kalıyor)
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
    // TODO: Bu rota da ileride sayfalama gerektirecek (kategori başına 500 konu varsa)
    // Ama şimdilik aynı bırakıyoruz.
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

// Yeni Konu Açma (/posts) (Aynı kaldı)
router.post('/posts', authenticateToken, async (req, res) => { 
    try {
        const { title, content, category_id } = req.body; 
        const authorId = req.user.id; 

        if (!title || !content || !category_id) {
            return res.status(400).json({ message: 'Başlık, içerik ve kategori ID zorunludur.' });
        }
        
        const newPost = await pool.query(
            'INSERT INTO posts (title, content, category_id, author_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [title, content, category_id, authorId]
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

// Ana Sayfa Konu Listeleme (/api/posts) (Aynı kaldı)
// TODO: Bu rota da ileride sayfalama gerektirecek.
router.get('/api/posts', async (req, res) => { 
    try {
        const approvedPosts = await pool.query(`
            SELECT 
                p.id, p.title, p.content, p.is_pinned, p.created_at, 
                c.name AS category_name, 
                c.slug AS category_slug,
                u.username AS author_username,
                u.avatar_url AS author_avatar
            FROM posts p
            JOIN users u ON p.author_id = u.id
            JOIN categories c ON p.category_id = c.id
            ORDER BY p.is_pinned DESC, p.created_at DESC; 
        `);
        res.json(approvedPosts.rows);
    } catch (err) {
        console.error("Konuları getirirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

// Arşiv Listeleme (/api/archive-posts) (Aynı kaldı)
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

// DEĞİŞTİ: Tek bir konuyu getir (/api/threads/:id)
router.get('/api/threads/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // YENİ: Sayfa numarasını URL'den al (örn: ?page=2)
        // parseInt ile sayıya çevir, NaN (Not a Number) ise 1 yap
        const page = parseInt(req.query.page, 10) || 1;
        // Atlanacak cevap sayısı (Sayfa 1 ise 0, Sayfa 2 ise 20 atla)
        const offset = (page - 1) * REPLIES_PER_PAGE;

        // 1. Konunun ana bilgisini çek (Aynı kaldı)
        const threadQuery = pool.query(`
            SELECT 
                p.id, p.title, p.content, p.created_at, p.is_locked, 
                c.name AS category_name,
                u.username AS author_username,
                u.avatar_url AS author_avatar,
                u.title AS author_title,
                u.post_count AS author_post_count,
                u.created_at AS author_join_date
            FROM posts p
            JOIN users u ON p.author_id = u.id
            JOIN categories c ON p.category_id = c.id
            WHERE p.id = $1;
        `, [id]);

        // 2. Konuya ait o sayfadaki cevapları çek (DEĞİŞTİ: LIMIT ve OFFSET eklendi)
        const repliesQuery = pool.query(`
            SELECT 
                r.id, r.content, r.created_at,
                u.username AS author_username,
                u.avatar_url AS author_avatar,
                u.title AS author_title,
                u.post_count AS author_post_count,
                u.created_at AS author_join_date
            FROM replies r
            JOIN users u ON r.author_id = u.id
            WHERE r.thread_id = $1
            ORDER BY r.created_at ASC
            LIMIT $2 OFFSET $3; 
        `, [id, REPLIES_PER_PAGE, offset]); // Parametreler eklendi

        // YENİ: 3. Toplam cevap sayısını çek (Toplam sayfa sayısını hesaplamak için)
        const repliesCountQuery = pool.query(
            'SELECT COUNT(*) FROM replies WHERE thread_id = $1',
            [id]
        );

        // Üç sorguyu aynı anda çalıştır
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
        
        // Toplam cevap sayısını ve sayfa sayısını hesapla
        const totalReplies = parseInt(repliesCountResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalReplies / REPLIES_PER_PAGE);

        // Sonucu birleştir
        res.json({ 
            thread, 
            replies,
            // YENİ: Sayfalama bilgisi frontend'e gönderiliyor
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


// --- CEVAP (REPLY) ROTALARI ---

// DEĞİŞTİ: Bir konuya cevap yazma (/api/threads/:id/reply)
router.post('/api/threads/:id/reply', authenticateToken, async (req, res) => {
    try {
        const { id: threadId } = req.params; 
        const { content } = req.body;        
        const authorId = req.user.id;      

        if (!content) {
            return res.status(400).json({ message: 'Cevap içeriği boş olamaz.' });
        }
        
        // Konu kilitli mi diye kontrol et
        const threadCheck = await pool.query('SELECT is_locked FROM posts WHERE id = $1', [threadId]);
        if (threadCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Konu bulunamadı.' });
        }
        if (threadCheck.rows[0].is_locked) {
            return res.status(403).json({ message: 'Bu konu kilitlenmiştir, yeni cevap yazılamaz.' }); 
        }
        
        // YENİ: Cevap eklendikten sonra kullanıcıyı son sayfaya yönlendirmek için
        // Önce mevcut cevap sayısını al
        const repliesCountResult = await pool.query(
            'SELECT COUNT(*) FROM replies WHERE thread_id = $1',
            [threadId]
        );
        const totalReplies = parseInt(repliesCountResult.rows[0].count, 10);
        
        // Yeni cevabı ekle
        const newReply = await pool.query(
            'INSERT INTO replies (content, thread_id, author_id) VALUES ($1, $2, $3) RETURNING *',
            [content, threadId, authorId]
        );
        
        // Post sayısını artır
        await pool.query('UPDATE users SET post_count = post_count + 1 WHERE id = $1', [authorId]);

        // YENİ: Yeni cevabın eklendiği sayfa numarasını hesapla
        const newTotalReplies = totalReplies + 1;
        const lastPage = Math.ceil(newTotalReplies / REPLIES_PER_PAGE);

        res.status(201).json({
            message: 'Cevabınız başarıyla eklendi.',
            reply: newReply.rows[0],
            // YENİ: Frontend'i yönlendirmek için son sayfa bilgisi
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

module.exports = router;