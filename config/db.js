const { Pool } = require('pg');

// index.js'den veritabanı ayarlarını buraya taşıdık
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// index.js'den tablo oluşturma fonksiyonunu buraya taşıdık
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      approver_id INTEGER REFERENCES users(id), 
      approval_date TIMESTAMPTZ                
    );
  `;

  // YENİ: "Cevaplar" tablosunun SQL tanımı
  const repliesTableQuery = `
    CREATE TABLE IF NOT EXISTS replies (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      
      -- Bu cevabın hangi konuya (thread/post) bağlı olduğu
      -- ON DELETE CASCADE: Eğer ana konu (post) silinirse, bu cevaplar da otomatik silinir.
      thread_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      
      -- Bu cevabı hangi kullanıcının yazdığı
      -- ON DELETE CASCADE: Eğer kullanıcı silinirse, bu cevapları da silinir.
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  try {
    await pool.query(usersTableQuery);
    await pool.query(postsTableQuery); 
    await pool.query(repliesTableQuery); // YENİ: Yeni tabloyu oluşturma komutu eklendi
    
    console.log("Tablolar başarıyla kontrol edildi/oluşturuldu.");
  } catch (err) {
    console.error("Tablolar oluşturulurken hata:", err);
  }
};

// Veritabanı havuzunu (pool) diğer dosyalarda kullanmak için export et
// ve createTables fonksiyonunu sunucu başlarken çağır.
module.exports = {
    pool,
    createTables
};