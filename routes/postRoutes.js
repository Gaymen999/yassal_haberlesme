const express = require('express');
const { pool } = require('../config/db'); // DB bağlantısı
const { authenticateToken } = require('../middleware/authMiddleware'); // Sadece token kontrolü
const router = express.Router();

// --- KATEGORİ ROTALARI ---

// YENİ: Tüm kategorileri listele
// (Yeni konu açma formunda <select> doldurmak için)
router.get('/api/categories', async (req, res) => {
    try {
        const categories = await pool.query('SELECT * FROM categories ORDER BY name ASC');
        res.json(categories.rows);
    } catch (err) {
        console.error("Kategorileri getirirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

// YENİ: Belirli bir kategorideki tüm konuları listele
router.get('/api/categories/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const postsInCategory = await pool.query(`
            SELECT 
                p.id, p.title, p.is_pinned, p.created_at, 
                u.email AS author_email,
                c.name AS category_name,
                c.slug AS category_slug
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

// Yeni Konu Açma (/posts)
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

// Ana Sayfa Konu Listeleme (/api/posts)
router.get('/api/posts', async (req, res) => {
    try {
        const approvedPosts = await pool.query(`
            SELECT 
                p.id, p.title, p.content, p.is_pinned, p.created_at, 
                u.email AS author_email,
                c.name AS category_name, 
                c.slug AS category_slug  
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

// Arşiv Listeleme (/api/archive-posts)
// (Bu rotayı artık ana sayfayla aynı, istersen silebilirsin)
router.get('/api/archive-posts', async (req, res) => {
    try {
        const archivedPosts = await pool.query(`
            SELECT 
                p.id, p.title, p.content, p.created_at, 
                u.email AS author_email,
                c.name AS category_name,
                c.slug AS category_slug
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

// YENİ: Tek bir konuyu ve TÜM cevaplarını getir
router.get('/api/threads/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Konunun ana bilgisini çek
        const threadQuery = pool.query(`
            SELECT 
                p.id, p.title, p.content, p.created_at, 
                u.email AS author_email,
                c.name AS category_name
            FROM posts p
            JOIN users u ON p.author_id = u.id
            JOIN categories c ON p.category_id = c.id
            WHERE p.id = $1;
        `, [id]);

        // 2. Konuya ait tüm cevapları çek
        const repliesQuery = pool.query(`
            SELECT 
                r.id, r.content, r.created_at,
                u.email AS author_email
            FROM replies r
            JOIN users u ON r.author_id = u.id
            WHERE r.thread_id = $1
            ORDER BY r.created_at ASC;
        `, [id]);

        // İki sorguyu aynı anda çalıştır
        const [threadResult, repliesResult] = await Promise.all([threadQuery, repliesQuery]);

        if (threadResult.rows.length === 0) {
            return res.status(404).json({ message: 'Konu bulunamadı.' });
        }

        // Sonucu birleştir
        const thread = threadResult.rows[0];
        const replies = repliesResult.rows;

        res.json({ thread, replies });

    } catch (err) {
        console.error("Konu ve cevapları getirirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});


// --- CEVAP (REPLY) ROTALARI ---

// YENİ: Bir konuya cevap yazma
router.post('/api/threads/:id/reply', authenticateToken, async (req, res) => {
    try {
        const { id: threadId } = req.params; // Konunun ID'si
        const { content } = req.body;        // Cevabın içeriği
        const authorId = req.user.id;      // Cevabı yazan kullanıcı (token'dan)

        if (!content) {
            return res.status(400).json({ message: 'Cevap içeriği boş olamaz.' });
        }

        const newReply = await pool.query(
            'INSERT INTO replies (content, thread_id, author_id) VALUES ($1, $2, $3) RETURNING *',
            [content, threadId, authorId]
        );

        res.status(201).json({
            message: 'Cevabınız başarıyla eklendi.',
            reply: newReply.rows[0]
        });

    } catch (err) {
        console.error("Cevap eklerken hata:", err.message);
        // Eğer olmayan bir konuya cevap yazılmaya çalışılırsa
        if (err.code === '23503') { 
             return res.status(404).json({ message: 'Cevap yazmaya çalıştığınız konu bulunamadı.' });
        }
        res.status(500).send('Sunucu Hatası');
    }
});

module.exports = router;