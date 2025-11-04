// config/db.js

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

  const postsTableQuery = `
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      is_pinned BOOLEAN DEFAULT FALSE NOT NULL,
      is_locked BOOLEAN DEFAULT FALSE NOT NULL,
      best_reply_id INTEGER NULL, 
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  const repliesTableQuery = `
    CREATE TABLE IF NOT EXISTS replies (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      thread_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMTOASTZ DEFAULT NOW()
    );
  `;
  const threadReactionsTableQuery = `
    CREATE TABLE IF NOT EXISTS thread_reactions (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      thread_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      reaction_type VARCHAR(50) DEFAULT 'like' NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, thread_id)
    );
  `;
  const replyReactionsTableQuery = `
    CREATE TABLE IF NOT EXISTS reply_reactions (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reply_id INTEGER NOT NULL REFERENCES replies(id) ON DELETE CASCADE,
      reaction_type VARCHAR(50) DEFAULT 'like' NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, reply_id)
    );
  `;

  try {
    await pool.query(usersTableQuery);
    await pool.query(categoriesTableQuery); 
    await pool.query(postsTableQuery); 
    await pool.query(repliesTableQuery); 
    await pool.query(threadReactionsTableQuery);
    await pool.query(replyReactionsTableQuery);
    
    console.log("Tablolar başarıyla kontrol edildi/oluşturuldu.");

    // --- DEĞİŞTİ: Kategori Ekleme Bloğu ---
    // 'if (categoriesCheck.rows.length === 0)' bloğu yerine
    // 'ON CONFLICT (slug) DO NOTHING' kullanıyoruz.
    // Bu sayede sunucu her başladığında eksik kategoriler eklenir.
    console.log('Varsayılan kategoriler kontrol ediliyor/ekleniyor...');
    const insertCategoriesQuery = `
        INSERT INTO categories (name, description, slug) VALUES
        ('9. Sınıf', '9. Sınıf duyuruları ve tartışmaları.', '9-sinif'),
        ('10. Sınıf', '10. Sınıf duyuruları ve tartışmaları.', '10-sinif'),
        ('11. Sınıf', '11. Sınıf duyuruları ve tartışmaları.', '11-sinif'),
        ('12. Sınıf', '12. Sınıf duyuruları ve tartışmaları.', '12-sinif'),
        ('Hocalar Hakkında Bilgilendirme', 'Hocalarla ilgili genel bilgilendirmeler.', 'hocalar-hakkinda-bilgilendirme'),
        ('Ders Notu', 'Paylaşılan ders notları ve kaynaklar.', 'ders-notu')
        ON CONFLICT (slug) DO NOTHING; 
    `;
    await pool.query(insertCategoriesQuery);
    console.log('Kategori kontrolü tamamlandı.');
    // --- DEĞİŞİKLİK BİTTİ ---

  } catch (err) {
    console.error("Tablolar oluşturulurken hata:", err);
  }
};

module.exports = {
    pool,
    createTables
};