// server.js
require('dotenv').config(); // .env dosyasındaki değişkenleri yükler
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');

// Veritabanı ve Tablo Oluşturma Fonksiyonu
const { createTables } = require('./config/db');

// Rota Dosyalarının İçe Aktarılması
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const adminRoutes = require('./routes/adminRoutes');
const reactionRoutes = require('./routes/reactionRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARE (ARA YAZILIMLAR) ---

// 1. Güvenlik Başlıkları (Helmet)
// Content-Security-Policy (CSP) ayarını, harici scriptlere (Quill, DOMPurify vb.) izin verecek şekilde gevşetiyoruz.
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.quilljs.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.quilljs.com"],
            imgSrc: ["'self'", "data:", "https:"], // Resimlere izin ver
            connectSrc: ["'self'", "https://yassal-haberlesme.onrender.com"] // API çağrılarına izin ver
        }
    }
}));

// 2. Sıkıştırma (Performans)
app.use(compression());

// 3. CORS Ayarları (Tarayıcı Güvenliği)
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? 'https://yassal-haberlesme.onrender.com' // Canlı domaininiz
        : 'http://localhost:3000',               // Yerel geliştirme ortamı
    credentials: true // Cookie gönderimine izin ver
}));

// 4. Veri İşleme
app.use(express.json()); // JSON verilerini okur
app.use(express.urlencoded({ extended: true })); // Form verilerini okur
app.use(cookieParser()); // Cookie'leri okur

// 5. Statik Dosyalar (Frontend)
// 'public' klasöründeki HTML, CSS, JS dosyalarını dışarıya açar
app.use(express.static(path.join(__dirname, 'public')));

// --- ROTALARIN TANIMLANMASI ---

// Auth Rotaları (Giriş, Kayıt, Çıkış) -> /login, /register
app.use('/', authRoutes); 

// Post Rotaları (Konular, Kategoriler) -> /api/posts, /posts
app.use('/', postRoutes); 

// Admin Rotaları -> /admin/stats, /admin/users
app.use('/admin', adminRoutes); 

// Reaksiyon Rotaları -> /api/threads/:id/react
app.use('/api', reactionRoutes);

// Bildirim Rotaları -> /api/notifications
app.use('/api', notificationRoutes);

// --- VERİTABANI BAĞLANTISI VE SUNUCUYU BAŞLATMA ---

// Önce tabloları oluştur/kontrol et, sonra sunucuyu aç
createTables()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Sunucu ${PORT} portunda çalışıyor...`);
            console.log(`Geliştirme: http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error("Veritabanı başlatılamadı:", err);
        process.exit(1); // Hata durumunda uygulamayı kapat
    });