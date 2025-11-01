const express = require('express');
const path = require('path'); 
const cookieParser = require('cookie-parser');
const cors = require('cors'); 
const { createTables } = require('./config/db'); // createTables fonksiyonunu import et

// Rota dosyalarını import et
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// --- GENEL MIDDLEWARE'LER ---
app.use(cors({
    // Render'da deploy ettiğin için origin kısmını dinamik tutmak daha iyidir
    // Render URL'ini buraya eklediysen (örneğin 'https://seninprojen.onrender.com'), o adresi kullan
    // Veya sadece yerel test için şimdilik ['http://localhost:3000', 'http://127.0.0.1:3000'] kullan
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

// --- SUNUCUYU BAŞLATMA FONKSİYONU (YENİ) ---
// Sunucuyu başlatmadan önce createTables fonksiyonunun bitmesini bekler.
const initializeApp = async () => {
    try {
        console.log("Veritabanı tabloları kontrol ediliyor/oluşturuluyor...");
        // KRİTİK DÜZELTME: createTables fonksiyonunun bitmesini BEKLE
        await createTables(); 
        console.log("Veritabanı kurulumu tamamlandı. Tablolar hazır.");

        app.listen(PORT, () => {
            console.log(`Sunucu ${PORT} portunda başarıyla başlatıldı.`);
        });
    } catch (error) {
        console.error("Uygulama başlatılırken KRİTİK HATA oluştu:", error.message);
        // Hata durumunda uygulamayı kapatır, bu Render'ın tekrar denemesini tetikler.
        process.exit(1); 
    }
};

// Uygulamayı başlat
initializeApp();