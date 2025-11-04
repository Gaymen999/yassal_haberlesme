// routes/authRoutes.js

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db'); 
const router = express.Router();

// --- KULLANICI ROTALARI ---

// ( /register rotası aynı kalabilir )
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Kullanıcı adı, email ve şifre zorunludur.' });
        }

        const userExists = await pool.query(
            'SELECT * FROM users WHERE email = $1 OR username = $2', 
            [email, username]
        );

        if (userExists.rows.length > 0) {
            if (userExists.rows[0].email === email) {
                return res.status(409).json({ message: 'Bu email adresi zaten kullanılıyor.' });
            }
            if (userExists.rows[0].username === username) {
                return res.status(409).json({ message: 'Bu kullanıcı adı zaten alınmış.' });
            }
        }
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        const newUser = await pool.query(
          'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, role',
          [username, email, hashedPassword]
        );
        
        res.status(201).json({ message: 'Kayıt oluşturuldu.', user: newUser.rows[0] });
    
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Sunucu Hatası');
    }
});


// DEĞİŞTİ: /login rotası
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body; 

        const user = await pool.query(
            'SELECT * FROM users WHERE email = $1 OR username = $1', 
            [email] 
        );

        if (user.rows.length === 0) {
            return res.status(400).json({ message: 'Hatalı giriş.' });
        }
        
        const validPassword = await bcrypt.compare(password, user.rows[0].password);
        if (!validPassword) {
            return res.status(400).json({ message: 'Hatalı giriş.' });
        }
        
        const tokenPayload = {
            id: user.rows[0].id, 
            role: user.rows[0].role,
            username: user.rows[0].username 
        };

        const token = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.cookie('authToken', token, {
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            maxAge: 3600000,
            path: '/' // <<< YENİ: Çerezi tüm site için ayarla
        });

        res.json({ message: "Giriş başarılı." });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

// DEĞİŞTİ: /logout rotası
router.post('/logout', (req, res) => {
    // YENİ: Çerezi silerken de path belirt
    res.clearCookie('authToken', { path: '/' }); 
    res.status(200).json({ message: 'Çıkış başarılı.' });
});

// ( /api/user-status rotası aynı kalabilir )
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

module.exports = router;