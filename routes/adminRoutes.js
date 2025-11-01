const express = require('express');
const { pool } = require('../config/db'); // DB bağlantısı
const { authenticateToken, authorizeAdmin } = require('../middleware/authMiddleware'); // İKİ KONTROL DE GEREKLİ
const router = express.Router();

// --- MODERASYON ROTALARI ---

// Konu Güncelleme (Sabitleme)
router.put('/posts/:id', [authenticateToken, authorizeAdmin], async (req, res) => {
    try {
        const { id } = req.params; 
        const { is_pinned } = req.body; 
        
        const fields = [];
        const values = [];
        let paramIndex = 1;

        if (typeof is_pinned === 'boolean') { 
            fields.push(`is_pinned = $${paramIndex++}`);
            values.push(is_pinned);
        } else {
             return res.status(400).json({ message: "Güncellenecek geçerli alan bulunamadı. (Sadece is_pinned)" });
        }
        
        values.push(id); 
        const queryText = `UPDATE posts SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const updatedPost = await pool.query(queryText, values);

        if (updatedPost.rows.length === 0) {
            return res.status(404).json({ message: 'Konu bulunamadı.' });
        }
        res.json({ message: `Konu başarıyla güncellendi.`, post: updatedPost.rows[0] });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

// YENİ: Konu Silme (Tüm cevaplarıyla birlikte)
router.delete('/posts/:id', [authenticateToken, authorizeAdmin], async (req, res) => {
    try {
        const { id } = req.params;
        
        // 'posts' tablosunda ON DELETE CASCADE ayarı olduğu için,
        // biz konuyu sildiğimizde veritabanı otomatik olarak 
        // bu konuya bağlı tüm cevapları (replies) da silecektir.
        const deletePost = await pool.query('DELETE FROM posts WHERE id = $1 RETURNING *', [id]);

        if (deletePost.rows.length === 0) {
            return res.status(404).json({ message: 'Silinecek konu bulunamadı.' });
        }
        
        res.status(200).json({ message: `Konu (ID: ${id}) ve tüm cevapları başarıyla silindi.` });

    } catch (err) {
        console.error("Konu silinirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

// YENİ: Tek Bir Cevabı Silme
router.delete('/replies/:id', [authenticateToken, authorizeAdmin], async (req, res) => {
    try {
        const { id } = req.params;
        
        const deleteReply = await pool.query('DELETE FROM replies WHERE id = $1 RETURNING *', [id]);

        if (deleteReply.rows.length === 0) {
            return res.status(404).json({ message: 'Silinecek cevap bulunamadı.' });
        }
        
        res.status(200).json({ message: `Cevap (ID: ${id}) başarıyla silindi.` });

    } catch (err) {
        console.error("Cevap silinirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

module.exports = router;