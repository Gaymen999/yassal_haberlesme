const express = require('express');
const { pool } = require('../config/db'); // DB bağlantısı
const { authenticateToken, authorizeAdmin } = require('../middleware/authMiddleware'); // İKİ KONTROL DE GEREKLİ
const router = express.Router();

// --- ADMİN ROTALARI ---
// ÖNEMLİ: Bu dosyadaki tüm rotalar '/admin' öneki ile başlar.
// Bu yüzden '/admin/pending-posts' yerine '/pending-posts' yazarız.
// Ana index.js dosyasında bu öneki ekleyeceğiz.

// 1. Onay bekleyenleri getir (/admin/pending-posts)
router.get('/pending-posts', [authenticateToken, authorizeAdmin], async (req, res) => {
    try {
        const pendingPosts = await pool.query("SELECT * FROM posts WHERE status = 'pending' ORDER BY created_at DESC");
        res.json(pendingPosts.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

// 2. PAYLAŞIM GÜNCELLEME (/admin/posts/:id)
router.put('/posts/:id', [authenticateToken, authorizeAdmin], async (req, res) => {
    try {
        const { id } = req.params; 
        const { action, category, is_pinned } = req.body; 
        const adminId = req.user.id; 
        
        const fields = [];
        const values = [];
        let paramIndex = 1;

        if (action) {
            if (!['approve', 'reject'].includes(action)) {
                return res.status(400).json({ message: "Geçersiz işlem." });
            }
            const newStatus = action === 'approve' ? 'approved' : 'rejected';
            fields.push(`status = $${paramIndex++}`);
            values.push(newStatus);
            fields.push(`approver_id = $${paramIndex++}`);
            values.push(adminId);
            fields.push(`approval_date = NOW()`);
        }

        if (category !== undefined) {
            fields.push(`category = $${paramIndex++}`);
            values.push(category);
        }
        
        if (typeof is_pinned === 'boolean') { 
            fields.push(`is_pinned = $${paramIndex++}`);
            values.push(is_pinned);
        }
        
        if (fields.length === 0) {
            return res.status(400).json({ message: "Güncellenecek alan bulunamadı." });
        }

        values.push(id); 
        const queryText = `UPDATE posts SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const updatedPost = await pool.query(queryText, values);

        if (updatedPost.rows.length === 0) {
            return res.status(404).json({ message: 'Paylaşım bulunamadı.' });
        }
        res.json({ message: `Paylaşım başarıyla güncellendi.`, post: updatedPost.rows[0] });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Sunucu Hatası');
    }
});


module.exports = router; // Bu rota grubunu export et