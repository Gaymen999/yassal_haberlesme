const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json()); // Gelen JSON verilerini okuyabilmek için

// --- VERİTABANI AYARLARI ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// --- TABLO OLUŞTURMA FONKSİYONLARI ---
const createTables = async () => {
  const usersTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'user' NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  // YENİ EKLENDİ: Paylaşımlar tablosu
  const postsTableQuery = `
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      author_id INTEGER NOT NULL REFERENCES users(id),
      status VARCHAR(50) DEFAULT 'pending' NOT NULL, -- pending, approved, rejected
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  try {
    await pool.query(usersTableQuery);
    await pool.query(postsTableQuery); // Yeni tabloyu da kontrol et/oluştur
    console.log("Tablolar başarıyla kontrol edildi/oluşturuldu.");
  } catch (err) {
    console.error("Tablolar oluşturulurken hata:", err);
  }
};


// --- YENİ EKLENDİ: AUTHENTICATION MIDDLEWARE ---
// Bir API isteğinin "giriş yapmış" bir kullanıcıdan gelip gelmediğini kontrol eder.
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) return res.sendStatus(401); // Token yoksa yetkisiz

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Token geçersizse yasaklı
        req.user = user; // Token geçerliyse, kullanıcı bilgisini isteğe ekle
        next(); // İşleme devam et
    });
};


// --- API ROTALARI ---

// Ana sayfa
app.get('/', (req, res) => {
  res.send('Kullanıcı Sistemi ve Paylaşım API\'si çalışıyor!');
});

// 1. KULLANICI KAYIT (/register)
app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email ve şifre alanları zorunludur.' });
    }
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(409).json({ message: 'Bu email adresi zaten kullanılıyor.' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, role',
      [email, hashedPassword]
    );
    res.status(201).json({ message: 'Kullanıcı başarıyla oluşturuldu.', user: newUser.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Sunucu Hatası');
  }
});

// 2. KULLANICI GİRİŞ (/login)
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) {
            return res.status(400).json({ message: 'Geçersiz email veya şifre.' });
        }
        const validPassword = await bcrypt.compare(password, user.rows[0].password);
        if (!validPassword) {
            return res.status(400).json({ message: 'Geçersiz email veya şifre.' });
        }
        const token = jwt.sign(
            { id: user.rows[0].id, role: user.rows[0].role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        res.json({ token });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

// 3. YENİ EKLENDİ: PAYLAŞIM GÖNDERME (/posts)
// authenticateToken sayesinde bu rotaya sadece giriş yapmış kullanıcılar erişebilir.
app.post('/posts', authenticateToken, async (req, res) => {
    try {
        const { title, content } = req.body;
        const authorId = req.user.id; // Token'dan gelen kullanıcı ID'si

        if (!title || !content) {
            return res.status(400).json({ message: 'Başlık ve içerik alanları zorunludur.' });
        }

        const newPost = await pool.query(
            'INSERT INTO posts (title, content, author_id) VALUES ($1, $2, $3) RETURNING *',
            [title, content, authorId]
        );

        res.status(201).json({ 
            message: 'Paylaşımınız onaya gönderildi. Teşekkürler!', 
            post: newPost.rows[0] 
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Sunucu Hatası');
    }
});


// --- SUNUCUYU BAŞLATMA ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda başlatıldı...`);
  createTables(); // Sunucu başlarken tüm tabloları kontrol et/oluştur.
});