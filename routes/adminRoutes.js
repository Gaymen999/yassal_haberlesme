// routes/adminRoutes.js

const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, authorizeAdmin } = require('../middleware/authMiddleware');
const router = express.Router();

// --- MODERASYON ROTALARI ---

// YENİ: Onay bekleyen konuları listele
router.get('/posts/pending', [authenticateToken, authorizeAdmin], async (req, res) => {
    try {
        const pendingPosts = await pool.query(`
            SELECT 
                p.id, p.title, p.created_at, 
                u.username AS author_username,
                c.name AS category_name
            FROM posts p
            JOIN users u ON p.author_id = u.id
            JOIN categories c ON p.category_id = c.id
            WHERE p.status = 'pending'
            ORDER BY p.created_at ASC;
        `);
        
        res.status(200).json(pendingPosts.rows);

    } catch (err) {
        console.error("Onay bekleyenler getirilirken hata:", err.message);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});

// YENİ: Konu durumunu güncelle (Onayla / Reddet)
router.put('/posts/:id/status', [authenticateToken, authorizeAdmin], async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'approved' veya 'rejected'

        if (status !== 'approved' && status !== 'rejected') {
            return res.status(400).json({ message: 'Geçersiz durum bilgisi.' });
        }
        
        const updatedPost = await pool.query(
            'UPDATE posts SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );

        if (updatedPost.rows.length === 0) {
            return res.status(404).json({ message: 'Konu bulunamadı.' });
        }

        res.status(200).json({
            message: `Konu başarıyla '${status}' olarak işaretlendi.`,
            post: updatedPost.rows[0]
        });

    } catch (err) {
        console.error("Konu durumu güncellenirken hata:", err.message);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});


// Konu Güncelleme (Sabitleme / Kilitleme) - (Aynı, değişmedi)
router.put('/posts/:id', [authenticateToken, authorizeAdmin], async (req, res) => {
    try {
        const { id } = req.params; 
        const { is_pinned, is_locked } = req.body; 
        
        // ... (Bu fonksiyonun içi aynı) ...

    } catch (err) {
        console.error("Konu güncellenirken hata:", err.message);
        res.status(500).json({ message: 'Sunucu hatası: Konu güncellenemedi.' });
    }
});

// En İyi Cevap Seçme (Aynı, değişmedi)
router.put('/posts/:id/best-reply', [authenticateToken, authorizeAdmin], async (req, res) => {
    try {
        // ... (Bu fonksiyonun içi aynı) ...
    } catch (err) {
        console.error("En İyi Cevap işaretlenirken hata:", err.message);
        res.status(500).json({ message: 'Sunucu hatası: En iyi cevap seçilemedi.' });
    }
});


// Konu Silme (Aynı, değişmedi)
router.delete('/posts/:id', [authenticateToken, authorizeAdmin], async (req, res) => {
    try {
        // ... (Bu fonksiyonun içi aynı) ...
    } catch (err) {
        console.error("Konu silinirken hata:", err.message);
        res.status(500).json({ message: 'Sunucu hatası: Konu silinemedi.' });
    }
});

// Cevap Silme (Aynı, değişmedi)
router.delete('/replies/:id', [authenticateToken, authorizeAdmin], async (req, res) => {
    try {
        // ... (Bu fonksiyonun içi aynı) ...
    } catch (err) {
        console.error("Cevap silinirken hata:", err.message);
        res.status(500).json({ message: 'Sunucu hatası: Cevap silinemedi.' });
    }
});

module.exports = router;