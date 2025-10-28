const express = require('express');
const { Pool } = require('pg'); // pg paketini dahil et
const app = express();

// Render'ın bize vereceği portu veya lokalde 3000'i kullan
const PORT = process.env.PORT || 3000;

// Veritabanı bağlantı havuzu oluştur
// DATABASE_URL ortam değişkenini otomatik olarak kullanır
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Bağlantıyı test etmek için basit bir fonksiyon
async function testDbConnection() {
  try {
    await pool.query('SELECT NOW()'); // Veritabanına basit bir sorgu at
    console.log('Veritabanına başarıyla bağlanıldı!');
  } catch (err) {
    console.error('Veritabanı bağlantı hatası:', err);
  }
}

app.get('/', (req, res) => {
  res.send('Merhaba Dünya! Sunucum Render üzerinde çalışıyor ve veritabanına bağlanmaya hazır!');
});

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda başlatıldı...`);
  testDbConnection(); // Sunucu başladığında veritabanı bağlantısını test et
});