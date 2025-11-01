const express = require('express');
const path = require('path'); 
const cookieParser = require('cookie-parser');
const cors = require('cors'); // <-- YENİ: CORS kütüphanesini import et
const { createTables } = require('./config/db'); 

// Rota dosyalarını import et
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// --- GENEL MIDDLEWARE'LER ---

// YENİ: CORS Middleware'ini EN BAŞA ekle
// Bu, OPTIONS isteklerini otomatik olarak ele alacak.
app.use(cors({
    origin: 'http://localhost:3000', // Sadece senin frontend'inden gelen isteklere izin ver
    credentials: true                // Cookie'lerin (HttpOnly) gönderilebilmesi için şart
}));

app.use(express.json()); // Body'deki JSON'ları okumak için
app.use(cookieParser()); // Cookie'leri okumak için
app.use(express.static(path.join(__dirname, 'public'))); // Frontend dosyalarını sunmak için

// --- ROTA YÖNLENDİRMELERİ ---
// (CORS'tan SONRA gelmeliler)
app.use('/', authRoutes);     
app.use('/', postRoutes);   
app.use('/admin', adminRoutes); 

// --- SUNUCUYU BAŞLATMA ---
app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda başlatıldı...`);
  createTables(); 
});