const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path'); 

const app = express();
app.use(express.json()); 
app.use(express.static(path.join(__dirname, 'public'))); 

// --- VERİTABANI AYARLARI ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// --- TABLO OLUŞTURMA FONKSİYONU ---
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
  const postsTableQuery = `
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      author_id INTEGER NOT NULL REFERENCES users(id),
      status VARCHAR(50) DEFAULT 'pending' NOT NULL, 
      category VARCHAR(50) DEFAULT 'Genel' NOT NULL, 
      is_pinned BOOLEAN DEFAULT FALSE NOT NULL,     
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
const authorizeAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Bu işlem için yetkiniz yok.' });
    }
    next();
};


// --- API ROTALARI ---

// KULLANICI ROTALARI
app.post('/register', async (req, res) => {
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
app.post('/login', async (req, res) => {
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
        res.json({ token });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

// PAYLAŞIM GÖNDERME ROTASI
app.post('/posts', authenticateToken, async (req, res) => { 
    try {
        const { title, content, category } = req.body; 
        const authorId = req.user.id; 

        if (!title || !content) {
            return res.status(400).json({ message: 'Başlık ve içerik zorunludur.' });
        }
        const postCategory = category || 'Genel'; 

        const newPost = await pool.query(
            'INSERT INTO posts (title, content, category, author_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [title, content, postCategory, authorId]
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

// ANA SAYFA LİSTELEME ROTASI
app.get('/api/posts', async (req, res) => {
    try {
        const approvedPosts = await pool.query(`
            SELECT 
                p.id, 
                p.title, 
                p.content, 
                p.category,           
                p.is_pinned,          
                p.created_at, 
                u.email AS author_email 
            FROM posts p
            JOIN users u ON p.author_id = u.id
            WHERE p.status = 'approved' 
            ORDER BY 
                p.is_pinned DESC,  
                p.created_at DESC; 
        `);
        
        res.json(approvedPosts.rows);

    } catch (err) {
        console.error("Onaylanmış paylaşımları getirirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

// ARŞİV LİSTELEME ROTASI (YENİ EKLENEN)
app.get('/api/archive-posts', async (req, res) => {
    try {
        const archivedPosts = await pool.query(`
            SELECT 
                p.id, 
                p.title, 
                p.content, 
                p.category,          
                p.created_at, 
                u.email AS author_email 
            FROM posts p
            JOIN users u ON p.author_id = u.id
            WHERE p.status = 'approved' 
            ORDER BY p.created_at DESC;
        `);
        
        res.json(archivedPosts.rows);

    } catch (err) {
        console.error("Arşivlenmiş paylaşımları getirirken hata:", err.message);
        res.status(500).send('Sunucu Hatası');
    }
});


// ADMIN ROTALARI

// 1. Onay bekleyenleri getir
app.get('/admin/pending-posts', [authenticateToken, authorizeAdmin], async (req, res) => {
    try {
        const pendingPosts = await pool.query("SELECT * FROM posts WHERE status = 'pending' ORDER BY created_at DESC");
        res.json(pendingPosts.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Sunucu Hatası');
    }
});

// 2. PAYLAŞIM GÜNCELLEME (Onay/Reddet/Sabitleme/Kategori)
app.put('/admin/posts/:id', [authenticateToken, authorizeAdmin], async (req, res) => {
    try {
        const { id } = req.params; 
        const { action, category, is_pinned } = req.body; 
        
        const fields = [];
        const values = [];
        let paramIndex = 1;

        if (action) {
            if (!['approve', 'reject'].includes(action)) {
                return res.status(400).json({ message: "Geçersiz işlem. Sadece 'approve' veya 'reject' kullanılabilir." });
            }
            const newStatus = action === 'approve' ? 'approved' : 'rejected';
            fields.push(`status = $${paramIndex++}`);
            values.push(newStatus);
        }

        if (category !== undefined) {
            fields.push(`category = $${paramIndex++}`);
            values.push(category);
        }
        
        if (typeof is_pinned === 'boolean') { 
            fields.push(`is_pinned = $${paramIndex++}`);
            values.push(is_pinned);
        }
        
        if (fields.length === 0) {
            return res.status(400).json({ message: "Güncellenecek alan bulunamadı." });
        }

        values.push(id); 

        const queryText = `UPDATE posts SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        
        const updatedPost = await pool.query(queryText, values);

        if (updatedPost.rows.length === 0) {
            return res.status(404).json({ message: 'Paylaşım bulunamadı.' });
        }

        res.json({ message: `Paylaşım başarıyla güncellendi.`, post: updatedPost.rows[0] });

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