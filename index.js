const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt =require('jsonwebtoken');

const app = express();
app.use(express.json());

// YENİ EKLENDİ: Statik dosyaların (HTML, CSS, JS) dağıtımını etkinleştirir.
const path = require('path'); // Node.js'in standart dosya yolu kütüphanesi
app.use(express.static(path.join(__dirname, 'public')));
// Kullanıcı siteye girdiğinde 'public' klasörüne yönlendirilecek

// ... aşağıdaki authenticateToken, authorizeAdmin vb. devam edecek.

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
      role VARCHAR(50) DEFAULT 'user' NOT NULL, -- 'user' veya 'admin'
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
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
    await pool.query(postsTableQuery);
    console.log("Tablolar başarıyla kontrol edildi/oluşturuldu.");
  } catch (err) {
    console.error("Tablolar oluşturulurken hata:", err);
  }
};

// --- MIDDLEWARE'LER ---

// 1. Authentication: Kullanıcı giriş yapmış mı?
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// 2. YENİ EKLENDİ - Authorization: Kullanıcı admin mi?
const authorizeAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Bu işlem için yetkiniz yok.' });
    }
    next();
};


// --- API ROTALARI ---

// KULLANICI ROTALARI
app.post('/register', async (req, res) => { /* ... önceki kodun aynısı ... */ 
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
app.post('/login', async (req, res) => { /* ... önceki kodun aynısı ... */ 
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

// PAYLAŞIM ROTALARI
app.post('/posts', authenticateToken, async (req, res) => { /* ... önceki kodun aynısı ... */ 
    try {
        const { title, content } = req.body;
        const authorId = req.user.id;
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


// --- YENİ EKLENDİ: ADMIN ROTALARI ---
// Bu rotalara erişmek için hem giriş yapmış (authenticate) hem de admin (authorize) olmak gerekir.

// 1. Onay bekleyen tüm paylaşımları getir
app.get('/admin/pending-posts', [authenticateToken, authorizeAdmin], async (req, res) => {
    try {
        const pendingPosts = await pool.query("SELECT * FROM posts WHERE status = 'pending' ORDER BY created_at DESC");
        res.json(pendingPosts.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

// 2. Bir paylaşımı onayla veya reddet
app.put('/admin/posts/:id', [authenticateToken, authorizeAdmin], async (req, res) => {
    try {
        const { id } = req.params; // URL'den gelen post ID'si
        const { action } = req.body; // 'approve' veya 'reject'

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ message: "Geçersiz işlem. Sadece 'approve' veya 'reject' kullanılabilir." });
        }

        const newStatus = action === 'approve' ? 'approved' : 'rejected';

        const updatedPost = await pool.query(
            'UPDATE posts SET status = $1 WHERE id = $2 RETURNING *',
            [newStatus, id]
        );

        if (updatedPost.rows.length === 0) {
            return res.status(404).json({ message: 'Paylaşım bulunamadı.' });
        }

        res.json({ message: `Paylaşım başarıyla ${newStatus} olarak güncellendi.`, post: updatedPost.rows[0] });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Sunucu Hatası');
    }
});


// --- SUNUCUYU BAŞLATMA ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda başlatıldı...`);
  createTables();
});