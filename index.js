const express = require('express');
const app = express();

// Render'ın bize vereceği portu veya lokalde 3000'i kullan
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Merhaba Dünya! Sunucum Render üzerinde çalışıyor!');
});

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda başlatıldı...`);
});