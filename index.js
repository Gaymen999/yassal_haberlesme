const express = require('express');
const path = require('path'); 
const cookieParser = require('cookie-parser');
const { createTables } = require('./config/db'); // Sadece tablo oluşturucuyu çağır

// Rota dosyalarını import et
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// --- GENEL MIDDLEWARE'LER ---
app.use(express.json()); // Body'deki JSON'ları okumak için
app.use(cookieParser()); // Cookie'leri okumak için
app.use(express.static(path.join(__dirname, 'public'))); // Frontend dosyalarını sunmak için

// --- ROTA YÖNLENDİRMELERİ ---
// Gelen istekleri ilgili rota dosyalarına yönlendir
app.use('/', authRoutes);     // (/login, /register, /logout, /api/user-status)
app.use('/', postRoutes);   // (/posts, /api/posts, /api/archive-posts)
app.use('/admin', adminRoutes); // (/admin/pending-posts, /admin/posts/:id)

// --- SUNUCUYU BAŞLATMA ---
app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda başlatıldı...`);
  // Sunucu başlarken veritabanı tablolarını kontrol et/oluştur
  createTables(); 
});