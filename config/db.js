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
      username VARCHAR(50) UNIQUE NOT NULL, 
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'user' NOT NULL, 
      avatar_url VARCHAR(255) DEFAULT 'default_avatar.png', 
      title VARCHAR(50) DEFAULT 'Yeni Üye',
      post_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  
  const categoriesTableQuery = `
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      slug VARCHAR(100) NOT NULL UNIQUE 
    );
  `;

  // DEĞİŞTİ: "posts" tablosuna 'is_locked' kolonu eklendi
  const postsTableQuery = `
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      is_pinned BOOLEAN DEFAULT FALSE NOT NULL,
      
      -- YENİ: Konu kilitli mi?
      is_locked BOOLEAN DEFAULT FALSE NOT NULL,
      
      created_at TIMESTAMPTZ DEFAULT NOW()
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