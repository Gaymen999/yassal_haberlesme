const express = require('express');
const { pool } = require('../config/db'); // DB bağlantısı
const { authenticateToken } = require('../middleware/authMiddleware'); // Sadece token kontrolü
const router = express.Router();

// --- GENEL DUYURU ROTALARI ---

// DEĞİŞTİ: PAYLAŞIM GÖNDERME (/posts)
// Artık "Yeni Konu Açma" rotası oldu. Onay sistemi yok.
router.post('/posts', authenticateToken, async (req, res) => { 
    try {
        // YENİ: 'category' (metin) yerine 'category_id' (sayı) bekliyoruz.
        const { title, content, category_id } = req.body; 
        const authorId = req.user.id; 

        if (!title || !content || !category_id) {
            return res.status(400).json({ message: 'Başlık, içerik ve kategori ID zorunludur.' });
        }
        
        // DEĞİŞTİ: SQL Sorgusu
        // 'status' kolonu kaldırıldı. 'category_id' eklendi.
        const newPost = await pool.query(
            'INSERT INTO posts (title, content, category_id, author_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [title, content, category_id, authorId]
        );

        res.status(201).json({ 
            message: 'Konunuz başarıyla yayınlandı!', // Mesaj değişti
            post: newPost.rows[0] 
        });
    } catch (err) {
        console.error("Yeni konu oluşturulurken hata:", err.message);
        // Hata mesajı 'category_id' bulunamazsa (Foreign Key hatası) olabilir
        if (err.code === '23503') { // Foreign key violation
             return res.status(404).json({ message: 'Geçersiz kategori ID.' });
        }
        res.status(500).send('Sunucu Hatası');
    }
});

// DEĞİŞTİ: ANA SAYFA LİSTELEME (/api/posts)
// Onay filtresi kaldırıldı. Kategori bilgisi JOIN ile çekildi.
router.get('/api/posts', async (req, res) => {
    try {
        const approvedPosts = await pool.query(`
            SELECT 
                p.id, p.title, p.content, p.is_pinned, p.created_at, 
                u.email AS author_email,
                c.name AS category_name, -- YENİ: Kategori adı
                c.slug AS category_slug  -- YENİ: Kategori URL'i
            FROM posts p
            JOIN users u ON p.author_id = u.id
            JOIN categories c ON p.category_id = c.id -- YENİ: Kategorileri JOINle
            -- KALDIRILDI: WHERE p.status = 'approved' 
            ORDER BY p.is_pinned DESC, p.created_at DESC; 
        `);
        res.json(approvedPosts.rows);
    } catch (err) {
        console.error("Konuları getirirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

// DEĞİŞTİ: ARŞİV LİSTELEME (/api/archive-posts)
// Onay filtresi kaldırıldı.
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
            -- KALDIRILDI: WHERE p.status = 'approved' 
            ORDER BY p.created_at DESC;
        `);
        res.json(archivedPosts.rows);
    } catch (err) {
        console.error("Arşivlenmiş konuları getirirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

module.exports = router;