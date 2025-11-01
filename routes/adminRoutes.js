const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, authorizeAdmin } = require('../middleware/authMiddleware');
const router = express.Router();

// --- MODERASYON ROTALARI ---

// DEĞİŞTİ: Konu Güncelleme (Sabitleme VE Kilitleme)
router.put('/posts/:id', [authenticateToken, authorizeAdmin], async (req, res) => {
    try {
        const { id } = req.params; 
        // YENİ: 'is_locked' body'den alındı
        const { is_pinned, is_locked } = req.body; 
        
        const fields = [];
        const values = [];
        let paramIndex = 1;

        if (typeof is_pinned === 'boolean') { 
            fields.push(`is_pinned = $${paramIndex++}`);
            values.push(is_pinned);
        }
        
        // YENİ: is_locked için güncelleme mantığı eklendi
        if (typeof is_locked === 'boolean') {
            fields.push(`is_locked = $${paramIndex++}`);
            values.push(is_locked);
        }

        if (fields.length === 0) {
             return res.status(400).json({ message: "Güncellenecek geçerli alan bulunamadı. (is_pinned veya is_locked)" });
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

// Konu Silme (Aynı kaldı)
router.delete('/posts/:id', [authenticateToken, authorizeAdmin], async (req, res) => {
    try {
        const { id } = req.params;
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

// Cevap Silme (Aynı kaldı)
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