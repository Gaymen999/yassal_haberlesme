const express = require('express');
const { pool } = require('../config/db'); // DB bağlantısı
const { authenticateToken, authorizeAdmin } = require('../middleware/authMiddleware'); // İKİ KONTROL DE GEREKLİ
const router = express.Router();

// --- MODERASYON ROTALARI ---

// KALDIRILDI: Onay bekleyenleri getirme rotası (/pending-posts)
// 'status' kolonu artık olmadığı için bu rota kaldırıldı.

// DEĞİŞTİ: PAYLAŞIM GÜNCELLEME (/admin/posts/:id)
// Bu rota artık SADECE moderasyon işlemleri (sabitleme vb.) yapar.
router.put('/posts/:id', [authenticateToken, authorizeAdmin], async (req, res) => {
    try {
        const { id } = req.params; 
        // DEĞİŞTİ: 'action' ve 'category' kaldırıldı. Sadece 'is_pinned' kaldı.
        const { is_pinned } = req.body; 
        
        const fields = [];
        const values = [];
        let paramIndex = 1;

        // KALDIRILDI: 'action' (approve/reject) bloğu tamamen silindi.
        // KALDIRILDI: 'category' bloğu silindi.

        if (typeof is_pinned === 'boolean') { 
            fields.push(`is_pinned = $${paramIndex++}`);
            values.push(is_pinned);
        } else {
            // Eğer is_pinned dışında bir şey gelirse (veya hiçbir şey gelmezse)
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

module.exports = router;