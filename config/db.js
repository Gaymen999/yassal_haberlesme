const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

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
  
  // YENİ: "Kategoriler" tablosunun SQL tanımı
  const categoriesTableQuery = `
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      -- URL dostu linkler için (örn: /forum/masaustu-bilgisayarlar)
      slug VARCHAR(100) NOT NULL UNIQUE 
    );
  `;

  // DEĞİŞTİ: "posts" tablosu artık "threads" (konular) olarak davranacak
  const postsTableQuery = `
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      
      -- Konuyu açan kullanıcı
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      
      -- YENİ: Konunun hangi kategoriye ait olduğu
      -- 'category' metin alanı kaldırıldı, yerine bu eklendi.
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,

      is_pinned BOOLEAN DEFAULT FALSE NOT NULL,     
      created_at TIMESTAMPTZ DEFAULT NOW()
      
      -- KALDIRILDI (Bir sonraki adımda kaldıracağız ama şimdiden sildim): 
      -- status, approver_id, approval_date forumda olmayacak.
    );
  `;

  const repliesTableQuery = `
    CREATE TABLE IF NOT EXISTS replies (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      thread_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  try {
    await pool.query(usersTableQuery);
    
    // YENİ: 'posts' tablosu 'categories' tablosuna bağlı olduğu için,
    // ÖNCE 'categories' tablosunu oluşturmalıyız.
    await pool.query(categoriesTableQuery); 
    
    await pool.query(postsTableQuery); 
    await pool.query(repliesTableQuery); 
    
    console.log("Tablolar başarıyla kontrol edildi/oluşturuldu.");
  } catch (err) {
    console.error("Tablolar oluşturulurken hata:", err);
  }
};

module.exports = {
    pool,
    createTables
};