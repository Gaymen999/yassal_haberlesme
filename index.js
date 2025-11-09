const express = require('express');
const path = require('path'); 
const cookieParser = require('cookie-parser');
const cors = require('cors'); 
const { createTables } = require('./config/db'); 
const rateLimit = require('express-rate-limit');

// Rota dosyalarını import et
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const adminRoutes = require('./routes/adminRoutes');
// YENİ: Reaksiyon rotalarını import et
const reactionRoutes = require('./routes/reactionRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// --- GENEL MIDDLEWARE'LER ---
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'], 
    credentials: true                
}));

app.use(express.json()); 
app.use(cookieParser()); 
app.use(express.static(path.join(__dirname, 'public'))); 

// --- ROTA YÖNLENDİRMELERİ ---
app.use('/', authRoutes);     
app.use('/', postRoutes);   
app.use('/admin', adminRoutes); 
// YENİ: Reaksiyon rotalarını /api öneki ile kullan
app.use('/api', reactionRoutes); 

// --- SUNUCUYU BAŞLATMA FONKSİYONU ---
const initializeApp = async () => {
    try {
        console.log("Veritabanı tabloları kontrol ediliyor/oluşturuluyor...");
        await createTables(); 
        console.log("Veritabanı kurulumu tamamlandı. Tablolar hazır.");

        app.listen(PORT, () => {
            console.log(`Sunucu ${PORT} portunda başarıyla başlatıldı.`);
        });
    } catch (error) {
        console.error("Uygulama başlatılırken KRİTİK HATA oluştu:", error.message);
        process.exit(1); 
    }
};

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 15, // Her IP için 15 istek
    message: { message: 'Çok fazla giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.' },
    standardHeaders: true, // Geri sayım bilgilerini header'a ekler
    legacyHeaders: false, 
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 saat
    max: 10, 
    message: { message: 'Bu IP adresinden çok fazla hesap oluşturuldu, lütfen 1 saat sonra deneyin.' },
});

// Uygulamayı başlat
initializeApp();