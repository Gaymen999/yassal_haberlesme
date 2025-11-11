// routes/notificationRoutes.js

const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/authMiddleware');
const router = express.Router();

// GET /api/notifications - Kullanıcının bildirimlerini getir
router.get('/notifications', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const notifications = await pool.query(
            `SELECT id, type, source_id, message, is_read, created_at 
             FROM notifications 
             WHERE user_id = $1 
             ORDER BY created_at DESC`,
            [userId]
        );
        res.json(notifications.rows);
    } catch (err) {
        console.error('Bildirimler getirilirken hata:', err.message);
        res.status(500).json({ message: 'Sunucu Hatası: Bildirimler yüklenemedi.' });
    }
});

// PUT /api/notifications/:id/read - Bildirimi okundu olarak işaretle
router.put('/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await pool.query(
            `UPDATE notifications 
             SET is_read = TRUE 
             WHERE id = $1 AND user_id = $2 
             RETURNING id`,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Bildirim bulunamadı veya bu bildirimi güncelleme yetkiniz yok.' });
        }

        res.json({ message: 'Bildirim okundu olarak işaretlendi.' });
    } catch (err) {
        console.error('Bildirim okundu olarak işaretlenirken hata:', err.message);
        res.status(500).json({ message: 'Sunucu Hatası: Bildirim güncellenemedi.' });
    }
});

module.exports = router;