const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db'); // DB bağlantısını config'den al
const router = express.Router();

// --- KULLANICI ROTALARI ---

// DEĞİŞTİ: /register rotası artık 'username' alıyor
router.post('/register', async (req, res) => {
    try {
        // YENİ: 'username' body'den alındı
        const { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Kullanıcı adı, email ve şifre zorunludur.' });
        }

        // YENİ: Hem e-posta hem de kullanıcı adı daha önce alınmış mı diye kontrol et
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
        
        // YENİ: 'username' veritabanına ekleniyor
        const newUser = await pool.query(
          'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, role',
          [username, email, hashedPassword]
        );
        
        res.status(201).json({ message: 'Kullanıcı oluşturuldu.', user: newUser.rows[0] });
    
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

// DEĞİŞTİ: /login rotası artık 'username' VEYA 'email' ile çalışıyor
router.post('/login', async (req, res) => {
    try {
        // 'email' alanı artık 'loginField' gibi davranacak
        const { email, password } = req.body; 

        // YENİ: Kullanıcıyı hem username hem email ile ara
        const user = await pool.query(
            'SELECT * FROM users WHERE email = $1 OR username = $1', 
            [email] // (frontend hala 'email' input'undan gönderiyor)
        );

        if (user.rows.length === 0) {
            return res.status(400).json({ message: 'Hatalı giriş.' });
        }
        
        const validPassword = await bcrypt.compare(password, user.rows[0].password);
        if (!validPassword) {
            return res.status(400).json({ message: 'Hatalı giriş.' });
        }
        
        // Token oluştururken artık username'i de ekleyelim
        const tokenPayload = {
            id: user.rows[0].id, 
            role: user.rows[0].role,
            username: user.rows[0].username // YENİ
        };

        const token = jwt.sign(
            tokenPayload,
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

// /logout rotası (Aynı kaldı)
router.post('/logout', (req, res) => {
    res.clearCookie('authToken'); 
    res.status(200).json({ message: 'Çıkış başarılı.' });
});

// /api/user-status rotası (Aynı kaldı)
router.get('/api/user-status', (req, res) => {
    const token = req.cookies.authToken;
    if (!token) {
        return res.json({ loggedIn: false });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.json({ loggedIn: false });
        }
        // Token'a username'i eklediğimiz için o da dönecek
        res.json({ loggedIn: true, user: user }); 
    });
});

module.exports = router;