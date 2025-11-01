const express = require('express');
const { pool } = require('../config/db'); // DB bağlantısı
const { authenticateToken } = require('../middleware/authMiddleware'); // Sadece token kontrolü
const router = express.Router();

// --- GENEL DUYURU ROTALARI ---

// PAYLAŞIM GÖNDERME (/posts)
// Sadece giriş yapmış kullanıcılar (authenticateToken)
router.post('/posts', authenticateToken, async (req, res) => { 
    try {
        const { title, content, category } = req.body; 
        const authorId = req.user.id; 

        if (!title || !content) {
            return res.status(400).json({ message: 'Başlık ve içerik zorunludur.' });
        }
        const postCategory = category || 'Genel'; 

        const newPost = await pool.query(
            'INSERT INTO posts (title, content, category, author_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [title, content, postCategory, authorId]
        );

        res.status(201).json({ 
            message: 'Paylaşımınız onaya gönderildi. Teşekkürler!', 
            post: newPost.rows[0] 
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

// ANA SAYFA LİSTELEME (/api/posts)
// Herkese açık
router.get('/api/posts', async (req, res) => {
    try {
        const approvedPosts = await pool.query(`
            SELECT 
                p.id, p.title, p.content, p.category, p.is_pinned, p.created_at, 
                u.email AS author_email 
            FROM posts p
            JOIN users u ON p.author_id = u.id
            WHERE p.status = 'approved' 
            ORDER BY p.is_pinned DESC, p.created_at DESC; 
        `);
        res.json(approvedPosts.rows);
    } catch (err) {
        console.error("Onaylanmış paylaşımları getirirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

// ARŞİV LİSTELEME (/api/archive-posts)
// Herkese açık
router.get('/api/archive-posts', async (req, res) => {
    try {
        const archivedPosts = await pool.query(`
            SELECT 
                p.id, p.title, p.content, p.category, p.created_at, 
                u.email AS author_email 
            FROM posts p
            JOIN users u ON p.author_id = u.id
            WHERE p.status = 'approved' 
            ORDER BY p.created_at DESC;
        `);
        res.json(archivedPosts.rows);
    } catch (err) {
        console.error("Arşivlenmiş paylaşımları getirirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

module.exports = router; // Bu rota grubunu export et