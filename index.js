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
app.set('trust proxy', 1);

// --- GENEL MIDDLEWARE'LER ---
app.use(cors({
    origin: ['https://yassal-haberlesme.onrender.com', 'http://localhost:3000', 'http://127.0.0.1:3000'], 
    credentials: true                
}));

app.use(express.json()); 
app.use(cookieParser()); 
app.use(express.static(path.join(__dirname, 'public'))); 

// --- ROTA YÖNLENDİRMELERİ ---
app.use('/', authRoutes);     
app.use('/', postRoutes);   
app.use('/api/admin', adminRoutes); 
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

// Uygulamayı başlat
initializeApp();