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

// --- TABLO OLUŞTURMA FONKSİYONU ---
// Sunucu her başladığında 'users' tablosu var mı diye kontrol eder, yoksa oluşturur.
const createUsersTable = async () => {
  const queryText = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'user' NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  try {
    await pool.query(queryText);
    console.log("'users' tablosu başarıyla kontrol edildi/oluşturuldu.");
  } catch (err) {
    console.error("'users' tablosu oluşturulurken hata:", err);
  }
};

// --- API ROTALARI ---

// Ana sayfa
app.get('/', (req, res) => {
  res.send('Kullanıcı Sistemi API\'si çalışıyor!');
});

// 1. KULLANICI KAYIT (/register)
app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Email ve şifre boş mu diye kontrol et
    if (!email || !password) {
      return res.status(400).json({ message: 'Email ve şifre alanları zorunludur.' });
    }

    // Bu email daha önce alınmış mı?
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(409).json({ message: 'Bu email adresi zaten kullanılıyor.' });
    }

    // Şifreyi hash'le (güvenli hale getir)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Yeni kullanıcıyı veritabanına kaydet
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

        // Kullanıcıyı email'e göre bul
        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) {
            return res.status(400).json({ message: 'Geçersiz email veya şifre.' });
        }

        // Veritabanındaki hash'lenmiş şifre ile kullanıcının girdiği şifreyi karşılaştır
        const validPassword = await bcrypt.compare(password, user.rows[0].password);
        if (!validPassword) {
            return res.status(400).json({ message: 'Geçersiz email veya şifre.' });
        }

        // Başarılı giriş -> JWT (Kimlik Kartı) oluştur
        const token = jwt.sign(
            { id: user.rows[0].id, role: user.rows[0].role }, // Karta ne yazılacağı
            process.env.JWT_SECRET, // Gizli anahtar ile imzala
            { expiresIn: '1h' } // Kartın geçerlilik süresi
        );

        res.json({ token });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Sunucu Hatası');
    }
});


// --- SUNUCUYU BAŞLATMA ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda başlatıldı...`);
  createUsersTable(); // Sunucu başlarken tabloyu kontrol et/oluştur.
});