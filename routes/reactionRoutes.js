// routes/reactionRoutes.js

const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/authMiddleware');
const router = express.Router();

// --- REAKSİYON ROTALARI ---

/**
 * Bir Konuyu (Thread) Beğen / Beğeniyi Geri Al (Toggle)
 * Rota: POST /api/threads/:id/react
 */
router.post('/threads/:id/react', authenticateToken, async (req, res) => {
    const { id: threadId } = req.params;
    const userId = req.user.id;
    const reactionType = req.body?.reactionType || 'like'; // Çökme düzeltmesi (req.body?.)

    try {
        const existingReaction = await pool.query(
            'SELECT * FROM thread_reactions WHERE user_id = $1 AND thread_id = $2',
            [userId, threadId]
        );

        let liked = false; // Durumu belirle

        if (existingReaction.rows.length > 0) {
            // 1. Beğeniyi geri al
            await pool.query(
                'DELETE FROM thread_reactions WHERE user_id = $1 AND thread_id = $2',
                [userId, threadId]
            );
            liked = false;
        } else {
            // 2. Beğen
            await pool.query(
                'INSERT INTO thread_reactions (user_id, thread_id, reaction_type) VALUES ($1, $2, $3)',
                [userId, threadId, reactionType]
            );
            liked = true;
        }
        
        // 3. YENİ: Yeni beğeni sayısını veritabanından tekrar say
        const countResult = await pool.query(
            'SELECT COUNT(*) FROM thread_reactions WHERE thread_id = $1',
            [threadId]
        );
        const newLikeCount = parseInt(countResult.rows[0].count, 10);
        
        // 4. YENİ: newLikeCount'ı cevaba ekle
        res.status(liked ? 201 : 200).json({ 
            message: liked ? 'Konu beğenildi.' : 'Beğeni geri alındı.', 
            liked: liked,
            newLikeCount: newLikeCount // Frontend'in beklediği veri
        });

    } catch (err) {
        if (err.code === '23503') { 
            return res.status(404).json({ message: 'Konu bulunamadı.' });
        }
        console.error("Konu Reaksiyon hatası:", err.message);
        res.status(500).json({ message: 'Sunucu hatası: Beğenme işlemi yapılamadı.' });
    }
});

/**
 * Bir Cevabı (Reply) Beğen / Beğeniyi Geri Al (Toggle)
 * Rota: POST /api/replies/:id/react
 */
router.post('/replies/:id/react', authenticateToken, async (req, res) => {
    const { id: replyId } = req.params;
    const userId = req.user.id;
    const reactionType = req.body?.reactionType || 'like'; // Çökme düzeltmesi (req.body?.)

    try {
        const existingReaction = await pool.query(
            'SELECT * FROM reply_reactions WHERE user_id = $1 AND reply_id = $2',
            [userId, replyId]
        );

        let liked = false; // Durumu belirle

        if (existingReaction.rows.length > 0) {
            // 1. Beğeniyi geri al
            await pool.query(
                'DELETE FROM reply_reactions WHERE user_id = $1 AND reply_id = $2',
                [userId, replyId]
            );
            liked = false;
        } else {
            // 2. Beğen
            await pool.query(
                'INSERT INTO reply_reactions (user_id, reply_id, reaction_type) VALUES ($1, $2, $3)',
                [userId, replyId, reactionType]
            );
            liked = true;
        }
        
        // 3. YENİ: Yeni beğeni sayısını veritabanından tekrar say
        const countResult = await pool.query(
            'SELECT COUNT(*) FROM reply_reactions WHERE reply_id = $1',
            [replyId]
        );
        const newLikeCount = parseInt(countResult.rows[0].count, 10);

        // 4. YENİ: newLikeCount'ı cevaba ekle
        res.status(liked ? 201 : 200).json({ 
            message: liked ? 'Cevap beğenildi.' : 'Beğeni geri alındı.', 
            liked: liked,
            newLikeCount: newLikeCount // Frontend'in beklediği veri
        });

    } catch (err) {
        if (err.code === '23503') {
            return res.status(404).json({ message: 'Cevap bulunamadı.' });
        }
        console.error("Cevap Reaksiyon hatası:", err.message);
        res.status(500).json({ message: 'Sunucu hatası: Beğenme işlemi yapılamadı.' });
    }
});

module.exports = router;