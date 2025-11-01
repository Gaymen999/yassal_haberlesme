const express = require('express');
const path = require('path'); 
const cookieParser = require('cookie-parser');
const cors = require('cors'); 
const { createTables } = require('./config/db'); 

// Rota dosyalarını import et
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// --- GENEL MIDDLEWARE'LER ---

// DÜZELTME: origin'i bir dizi (array) olarak güncelle
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'], // Hem localhost hem IP'ye izin ver
    credentials: true                
}));

app.use(express.json()); 
app.use(cookieParser()); 
app.use(express.static(path.join(__dirname, 'public'))); 

// --- ROTA YÖNLENDİRMELERİ ---
app.use('/', authRoutes);     
app.use('/', postRoutes);   
app.use('/admin', adminRoutes); 

// --- SUNUCUYU BAŞLATMA ---
app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda başlatıldı...`);
  createTables(); 
});