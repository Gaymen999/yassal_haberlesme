// routes/adminRoutes.js

const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, authorizeAdmin } = require('../middleware/authMiddleware');
const router = express.Router();

// --- MODERASYON ROTALARI ---

// Onay bekleyen konuları listele
router.get('/posts/pending', [authenticateToken, authorizeAdmin], async (req, res) => {
    try {
        const pendingPosts = await pool.query(`
            SELECT p.id, p.title, p.created_at, u.username AS author_username, c.name AS category_name
            FROM posts p
            JOIN users u ON p.author_id = u.id
            JOIN categories c ON p.category_id = c.id
            WHERE p.status = 'pending' ORDER BY p.created_at ASC;
        `);
        res.status(200).json(pendingPosts.rows);
    } catch (err) {
        console.error("Onay bekleyenler getirilirken hata:", err.message);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});

// Konu durumunu güncelle (Onayla / Reddet)
router.put('/posts/:id/status', [authenticateToken, authorizeAdmin], async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
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
             return res.status(400).json({ message: "Güncellenecek geçerli alan bulunamadı." });
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
        res.status(500).json({ message: 'Sunucu hatası: Konu güncellenemedi.' });
    }
});

// En İyi Cevap Seçme
router.put('/posts/:id/best-reply', [authenticateToken, authorizeAdmin], async (req, res) => {
    try {
        const { id: threadId } = req.params;
        const { reply_id } = req.body; 
        if (reply_id === null) {
            const updateQuery = 'UPDATE posts SET best_reply_id = NULL WHERE id = $1 RETURNING *';
            const updatedPost = await pool.query(updateQuery, [threadId]);
            return res.status(200).json({ message: 'En iyi cevap kaldırıldı.', post: updatedPost.rows[0] });
        }
        const replyCheck = await pool.query('SELECT * FROM replies WHERE id = $1 AND thread_id = $2', [reply_id, threadId]);
        if (replyCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Belirtilen cevap bu konuya ait değil.' });
        }
        const updateQuery = 'UPDATE posts SET best_reply_id = $1 WHERE id = $2 RETURNING *';
        const updatedPost = await pool.query(updateQuery, [reply_id, threadId]);
        res.status(200).json({ message: 'En iyi cevap seçildi.', post: updatedPost.rows[0] });
    } catch (err) {
        console.error("En İyi Cevap işaretlenirken hata:", err.message);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});

// Konu Silme (GÜNCELLENDİ: Post count düzeltmesi)
router.delete('/posts/:id', [authenticateToken, authorizeAdmin], async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Silinecek post ve reply'ların yazarlarını ve sayılarını bul
        const query = `
            WITH deleted_replies AS (
                SELECT author_id, COUNT(*) AS count FROM replies WHERE thread_id = $1 GROUP BY author_id
            ),
            deleted_post AS (
                SELECT author_id, 1 AS count FROM posts WHERE id = $1
            ),
            all_deletions AS (
                SELECT author_id, count FROM deleted_replies
                UNION ALL
                SELECT author_id, count FROM deleted_post
            )
            SELECT author_id, SUM(count)::INTEGER AS total_to_decrement
            FROM all_deletions
            WHERE author_id IS NOT NULL
            GROUP BY author_id;
        `;
        const authorsToUpdate = await client.query(query, [id]);

        // 2. Konuyu sil (replies cascade ile silinecek)
        const deletePost = await client.query('DELETE FROM posts WHERE id = $1 RETURNING *', [id]);

        if (deletePost.rows.length === 0) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(404).json({ message: 'Silinecek konu bulunamadı.' });
        }

        // 3. Tüm etkilenen yazarların post_count'unu güncelle
        for (const row of authorsToUpdate.rows) {
            await client.query(
                'UPDATE users SET post_count = post_count - $1 WHERE id = $2',
                [row.total_to_decrement, row.author_id]
            );
        }

        await client.query('COMMIT');
        client.release();
        res.status(200).json({ message: `Konu (ID: ${id}) ve tüm cevapları başarıyla silindi.` });
    
    } catch (err) {
        await client.query('ROLLBACK');
        client.release();
        console.error("Konu silinirken hata:", err.message);
        res.status(500).json({ message: 'Sunucu hatası: Konu silinemedi.' });
    }
});

// Cevap Silme (GÜNCELLENDİ: Post count düzeltmesi)
router.delete('/replies/:id', [authenticateToken, authorizeAdmin], async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Cevabın yazarını bul
        const reply = await client.query('SELECT author_id FROM replies WHERE id = $1', [id]);
        if (reply.rows.length === 0) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(404).json({ message: 'Silinecek cevap bulunamadı.' });
        }
        const authorId = reply.rows[0].author_id;

        // 2. Cevabı sil
        await client.query('DELETE FROM replies WHERE id = $1', [id]);

        // 3. Yazarın post_count'unu güncelle
        await client.query(
            'UPDATE users SET post_count = post_count - 1 WHERE id = $1',
            [authorId]
        );
        
        await client.query('COMMIT');
        client.release();
        res.status(200).json({ message: `Cevap (ID: ${id}) başarıyla silindi.` });

    } catch (err) {
        await client.query('ROLLBACK');
        client.release();
        console.error("Cevap silinirken hata:", err.message);
        res.status(500).json({ message: 'Sunucu hatası: Cevap silinemedi.' });
    }
});

module.exports = router;