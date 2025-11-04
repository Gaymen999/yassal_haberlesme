// routes/adminRoutes.js

const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, authorizeAdmin } = require('../middleware/authMiddleware');
const router = express.Router();

// --- MODERASYON ROTALARI ---

// Konu Güncelleme (Sabitleme / Kilitleme)
router.put('/posts/:id', [authenticateToken, authorizeAdmin], async (req, res) => {
    try {
        const { id } = req.params; 
        const { is_pinned, is_locked } = req.body; 
        
        const fields = [];
        const values = [];
        let paramIndex = 1;

        if (typeof is_pinned === 'boolean') { 
            fields.push(`is_pinned = $${paramIndex++}`);
            values.push(is_pinned);
        }
        
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
        
        res.status(200).json({ 
            message: 'Konu başarıyla güncellendi.', 
            post: updatedPost.rows[0] 
        });

    } catch (err) {
        console.error("Konu güncellenirken hata:", err.message);
        // DEĞİŞTİ: res.send() yerine JSON yolla
        res.status(500).json({ message: 'Sunucu hatası: Konu güncellenemedi.' });
    }
});

// En İyi Cevap Seçme (GÜNCELLENDİ)
router.put('/posts/:id/best-reply', [authenticateToken, authorizeAdmin], async (req, res) => {
    try {
        const { id: threadId } = req.params;
        const { reply_id } = req.body; // reply_id'yi body'den al

        // reply_id null ise, en iyi cevabı kaldır
        if (reply_id === null) {
            const updateQuery = 'UPDATE posts SET best_reply_id = NULL WHERE id = $1 RETURNING *';
            const updatedPost = await pool.query(updateQuery, [threadId]);
            
            return res.status(200).json({
                message: 'En iyi cevap kaldırıldı.',
                bestReplyId: null,
                post: updatedPost.rows[0]
            });
        }
        
        // Önce böyle bir cevabın olup olmadığını ve bu konuya ait olup olmadığını kontrol et
        const replyCheck = await pool.query(
            'SELECT * FROM replies WHERE id = $1 AND thread_id = $2',
            [reply_id, threadId]
        );
        
        if (replyCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Belirtilen cevap bu konuya ait değil veya bulunamadı.' });
        }

        // En iyi cevap olarak ayarla
        const updateQuery = 'UPDATE posts SET best_reply_id = $1 WHERE id = $2 RETURNING *';
        const updatedPost = await pool.query(updateQuery, [reply_id, threadId]);

        res.status(200).json({ 
            message: 'En iyi cevap başarıyla seçildi.',
            bestReplyId: reply_id,
            post: updatedPost.rows[0]
        });

    } catch (err) {
        console.error("En İyi Cevap işaretlenirken hata:", err.message);
        // DEĞİŞTİ: res.send() yerine JSON yolla
        res.status(500).json({ message: 'Sunucu hatası: En iyi cevap seçilemedi.' });
    }
});


// Konu Silme
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
        // DEĞİŞTİ: res.send() yerine JSON yolla
        res.status(500).json({ message: 'Sunucu hatası: Konu silinemedi.' });
    }
});

// Cevap Silme
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
        // DEĞİŞTİ: res.send() yerine JSON yolla
        res.status(500).json({ message: 'Sunucu hatası: Cevap silinemedi.' });
    }
});

module.exports = router;