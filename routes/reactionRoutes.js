const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/authMiddleware'); // Koruma için şart
const router = express.Router();

// --- REAKSİYON ROTALARI ---

/**
 * Bir Konuyu (Thread) Beğen / Beğeniyi Geri Al (Toggle)
 * Rota: POST /api/threads/:id/react
 */
router.post('/threads/:id/react', authenticateToken, async (req, res) => {
    const { id: threadId } = req.params;
    const userId = req.user.id;
    // İleride "komik", "bilgilendirici" gibi reaksiyonlar için:
    const reactionType = req.body.reactionType || 'like'; 

    try {
        // 1. Kullanıcı bu konuya zaten reaksiyon vermiş mi?
        const existingReaction = await pool.query(
            'SELECT * FROM thread_reactions WHERE user_id = $1 AND thread_id = $2',
            [userId, threadId]
        );

        if (existingReaction.rows.length > 0) {
            // 2. Varsa: Beğeniyi geri al (DELETE)
            await pool.query(
                'DELETE FROM thread_reactions WHERE user_id = $1 AND thread_id = $2',
                [userId, threadId]
            );
            res.status(200).json({ message: 'Beğeni geri alındı.', liked: false });
        } else {
            // 3. Yoksa: Beğen (INSERT)
            await pool.query(
                'INSERT INTO thread_reactions (user_id, thread_id, reaction_type) VALUES ($1, $2, $3)',
                [userId, threadId, reactionType]
            );
            res.status(201).json({ message: 'Konu beğenildi.', liked: true });
        }
    } catch (err) {
        // 23503: Foreign key violation (konu yoksa)
        if (err.code === '23503') {
             return res.status(404).json({ message: 'Beğenmeye çalıştığınız konu bulunamadı.' });
        }
        console.error("Konu reaksiyon hatası:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

/**
 * Bir Cevabı (Reply) Beğen / Beğeniyi Geri Al (Toggle)
 * Rota: POST /api/replies/:id/react
 */
router.post('/replies/:id/react', authenticateToken, async (req, res) => {
    const { id: replyId } = req.params;
    const userId = req.user.id;
    const reactionType = req.body.reactionType || 'like';

    try {
        // 1. Kullanıcı bu cevaba zaten reaksiyon vermiş mi?
        const existingReaction = await pool.query(
            'SELECT * FROM reply_reactions WHERE user_id = $1 AND reply_id = $2',
            [userId, replyId]
        );

        if (existingReaction.rows.length > 0) {
            // 2. Varsa: Beğeniyi geri al (DELETE)
            await pool.query(
                'DELETE FROM reply_reactions WHERE user_id = $1 AND reply_id = $2',
                [userId, replyId]
            );
            res.status(200).json({ message: 'Beğeni geri alındı.', liked: false });
        } else {
            // 3. Yoksa: Beğen (INSERT)
            await pool.query(
                'INSERT INTO reply_reactions (user_id, reply_id, reaction_type) VALUES ($1, $2, $3)',
                [userId, replyId, reactionType]
            );
            res.status(201).json({ message: 'Cevap beğenildi.', liked: true });
        }
    } catch (err) {
        if (err.code === '23503') {
             return res.status(404).json({ message: 'Beğenmeye çalıştığınız cevap bulunamadı.' });
        }
        console.error("Cevap reaksiyon hatası:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

module.exports = router;