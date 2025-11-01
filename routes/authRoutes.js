const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db'); // DB bağlantısını config'den al
const router = express.Router();

// --- KULLANICI ROTALARI ---

// /register rotası
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: 'Email ve şifre zorunludur.' });
        const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) return res.status(409).json({ message: 'Bu email adresi zaten kullanılıyor.' });
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = await pool.query(
          'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, role',
          [email, hashedPassword]
        );
        res.status(201).json({ message: 'Kullanıcı oluşturuldu.', user: newUser.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

// /login rotası
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) return res.status(400).json({ message: 'Hatalı giriş.' });
        const validPassword = await bcrypt.compare(password, user.rows[0].password);
        if (!validPassword) return res.status(400).json({ message: 'Hatalı giriş.' });
        
        const token = jwt.sign(
            { id: user.rows[0].id, role: user.rows[0].role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.cookie('authToken', token, {
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            maxAge: 3600000 
        });

        res.json({ message: "Giriş başarılı." });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

// /logout rotası
router.post('/logout', (req, res) => {
    res.clearCookie('authToken'); 
    res.status(200).json({ message: 'Çıkış başarılı.' });
});

// /api/user-status rotası
router.get('/api/user-status', (req, res) => {
    const token = req.cookies.authToken;
    if (!token) {
        return res.json({ loggedIn: false });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.json({ loggedIn: false });
        }
        res.json({ loggedIn: true, user: user });
    });
});

module.exports = router; // Bu rota grubunu export et