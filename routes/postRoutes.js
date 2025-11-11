// routes/postRoutes.js

const express = require("express");
const { pool } = require("../config/db");
const { authenticateToken } = require("../middleware/authMiddleware");
const router = express.Router();
const jwt = require("jsonwebtoken"); // Kendi kendine token doğrulaması için
const { sendApprovalEmail } = require("../config/email");
const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

// Sabitler
const POSTS_PER_PAGE = 20;
const REPLIES_PER_PAGE = 20;

// --- KATEGORİ ROTALARI ---

// 1. HERKESİN görebileceği, FİLTRESİZ kategori listesi
// (Arşiv, Kategori sayfaları vb. için)
router.get("/api/categories", async (req, res) => {
  try {
    const categories = await pool.query(
      "SELECT * FROM categories ORDER BY id ASC"
    );
    res.json(categories.rows);
  } catch (err) {
    console.error("Kategorileri getirirken hata:", err.message);
    // DÜZELTME: JSON hatası yolla
    res
      .status(500)
      .json({ message: "Sunucu Hatası: Kategoriler yüklenemedi." });
  }
});

// 2. YENİ ROTA: Sadece "Konu Aç" sayfası için KORUMALI kategori listesi
router.get("/api/categories/postable", authenticateToken, async (req, res) => {
  try {
    let queryText = "";
    const userRole = req.user.role; // authMiddleware sayesinde req.user var

    if (userRole === "admin") {
      // Admin ise TÜM kategorileri getir
      queryText = "SELECT * FROM categories ORDER BY name ASC";
    } else {
      // Admin değilse, 'Bilgilendirme' kategorisi DIŞINDAKİLERİ getir
      queryText =
        "SELECT * FROM categories WHERE slug != 'bilgilendirme' ORDER BY name ASC";
    }

    const categories = await pool.query(queryText);
    res.json(categories.rows);
  } catch (err) {
    console.error("Yayınlanabilir kategorileri getirirken hata:", err.message);
    res
      .status(500)
      .json({ message: "Sunucu Hatası: Kategoriler yüklenemedi." });
  }
});

// 3. Kategori Detay Sayfası (Kategori içindeki postlar)
// GÜNCELLENDİ: Sadece 'approved' (onaylı) postları gösterecek
router.get("/api/categories/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const postsInCategory = await pool.query(
      `
            SELECT 
                p.id, p.title, p.is_pinned, p.created_at, 
                c.name AS category_name,
                c.slug AS category_slug,
                u.username AS author_username,
                u.avatar_url AS author_avatar
            FROM posts p
            JOIN users u ON p.author_id = u.id
            JOIN categories c ON p.category_id = c.id
            WHERE c.slug = $1 AND p.status = 'approved' -- ONAY FİLTRESİ
            ORDER BY p.is_pinned DESC, p.created_at DESC;
        `,
      [slug]
    );

    // Bu kısım kategori varsa ama post yoksa 404 vermesin diye
    if (postsInCategory.rows.length === 0) {
      const categoryCheck = await pool.query(
        "SELECT * FROM categories WHERE slug = $1",
        [slug]
      );
      if (categoryCheck.rows.length === 0) {
        return res.status(404).json({ message: "Kategori bulunamadı." });
      }
    }

    res.json(postsInCategory.rows);
  } catch (err) {
    console.error("Kategori postlarını getirirken hata:", err.message);
    res.status(500).json({ message: "Sunucu Hatası: Konular yüklenemedi." });
  }
});

// --- YENİ KONU OLUŞTURMA (GÜNCELLENDİ) ---
// (Onay sistemi ve Admin-only kategori koruması eklendi)

router.post("/posts", authenticateToken, async (req, res) => {
  try {
    const { title, content, category_id } = req.body; // <-- content buradan geliyor (HENÜZ TEMİZ DEĞİL)
    const author_id = req.user.id;
    const author_role = req.user.role;
    const author_username = req.user.username; // Token'dan alıyoruz

    // --- YENİ: XSS KORUMASI ---
    // Gelen 'content'i veritabanına kaydetmeden ÖNCE temizle
    const cleanContent = DOMPurify.sanitize(content);

    // 1. Kontrolü 'cleanContent' üzerinden yap
    if (!title || !cleanContent || cleanContent.trim() === '' || cleanContent === '<p><br></p>' || !category_id) {
      return res
        .status(400)
        .json({ message: "Başlık, içerik ve kategori zorunludur." });
    }
    
    // --- (Kategori güvenlik kontrolü aynı kalıyor) ---
    if (author_role !== "admin") {
      const categoryCheck = await pool.query(
        "SELECT slug FROM categories WHERE id = $1",
        [category_id]
      );
      if (categoryCheck.rows.length === 0) {
        return res.status(400).json({ message: "Geçersiz kategori." });
      }
      if (categoryCheck.rows[0].slug === "bilgilendirme") {
        return res
          .status(403)
          .json({ message: "Bu kategoriye sadece adminler konu açabilir." });
      }
    }

    const status = author_role === "admin" ? "approved" : "pending";

    const client = await pool.connect();
    let newPostData; // Mail için post verisini tut
    try {
      await client.query("BEGIN");

      // --- KRİTİK DEĞİŞİKLİK: 'content' yerine 'cleanContent' kaydediliyor ---
      const newPost = await client.query(
        "INSERT INTO posts (title, content, author_id, category_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [title, cleanContent, author_id, category_id, status] // $2 GÜNCELLENDİ
      );
      newPostData = newPost.rows[0]; // Veriyi değişkene ata

      await client.query(
        "UPDATE users SET post_count = post_count + 1 WHERE id = $1",
        [author_id]
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err; // Hata ana catch bloğuna gitsin
    } finally {
      client.release();
    }

    // --- (Mail gönderme ve res.json kısmı aynı) ---
    if (status === "pending") {
      // Hata olursa bile akışı bozmuyoruz (await yok)
      sendApprovalEmail(newPostData, author_username).catch((emailError) =>
        console.error(
          "Mail gönderme işlemi arka planda hata verdi:",
          emailError
        )
      );
    }
    
    const message =
      status === "approved"
        ? "Konu başarıyla oluşturuldu."
        : "Konunuz onaya gönderildi. Admin tarafından incelenecektir.";

    res.status(201).json({
      message: message,
      post: newPostData,
      status: status,
    });
  } catch (err) {
    console.error("Konu oluştururken hata:", err.message);
    res.status(500).json({ message: "Sunucu Hatası: Konu oluşturulamadı." });
  }
});

// --- ANA SAYFA (SON KONULAR) (GÜNCELLENDİ) ---
// (Sadece 'approved' postları gösterecek)
router.get("/api/posts/recent", async (req, res) => {
  try {
    const recentPosts = await pool.query(`
            SELECT 
                p.id, p.title, p.is_pinned, p.is_locked, p.created_at, 
                c.name AS category_name,
                c.slug AS category_slug,
                u.username AS author_username,
                (SELECT COUNT(*) FROM replies r WHERE r.thread_id = p.id) AS reply_count,
                (SELECT COUNT(*) FROM thread_reactions tr WHERE tr.thread_id = p.id) AS like_count
            FROM posts p
            JOIN users u ON p.author_id = u.id
            JOIN categories c ON p.category_id = c.id
            WHERE p.status = 'approved' -- ONAY FİLTRESİ
            ORDER BY p.is_pinned DESC, p.created_at DESC
            LIMIT 15;
        `);
    res.json(recentPosts.rows);
  } catch (err) {
    console.error("Son konuları getirirken hata:", err.message);
    res.status(500).json({ message: "Sunucu Hatası: Konular yüklenemedi." });
  }
});

// --- ARŞİV SAYFASI (GÜNCELLENDİ) ---
// (Sadece 'approved' postları gösterecek + Arama)
router.get("/api/posts/archive", async (req, res) => {
  try {
    // 1. URL'den parametreleri al (?category=...&search=...)
    const { category, search } = req.query;

    // 2. Temel SQL sorgusu (Sadece onaylıları getir)
    let queryText = `
            SELECT 
                p.id, p.title, p.created_at, 
                c.name AS category_name,
                c.id AS category_id,
                u.username AS author_username
            FROM posts p
            JOIN users u ON p.author_id = u.id
            JOIN categories c ON p.category_id = c.id
            WHERE p.status = 'approved'
        `;

    const queryParams = [];

    // 3. Arama filtresi (search) varsa, sorguya ekle
    if (search) {
      queryParams.push(`%${search}%`);
      queryText += ` AND p.title ILIKE $${queryParams.length}`;
    }

    // 4. Kategori filtresi (category) varsa (ID'ye göre), sorguya ekle
    if (category) {
      queryParams.push(category);
      queryText += ` AND c.id = $${queryParams.length}`;
    }

    // 5. Sıralama
    queryText += " ORDER BY p.created_at DESC";

    // 6. Sorguyu çalıştır
    const posts = await pool.query(queryText, queryParams);

    res.status(200).json(posts.rows);
  } catch (err) {
    console.error("Arşiv getirilirken hata:", err.message);
    res.status(500).json({ message: "Sunucu Hatası: Arşiv yüklenemedi." });
  }
});
//API THREADS ID
// routes/postRoutes.js

// ... (dosyanın üstündeki diğer importlar ve sabitler) ...
// const REPLIES_PER_PAGE = 20; // Bunun tanımlı olduğundan emin ol

// --- KONU (THREAD) DETAY SAYFASI (GÜVENLİ VE DÜZELTİLMİŞ) ---
router.get('/api/threads/:id', async (req, res) => {
    const { id } = req.params;

    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * REPLIES_PER_PAGE;
    
    let currentUserId = null;
    let currentUserRole = 'user';
    if (req.cookies.authToken) {
        try {
            const user = jwt.verify(req.cookies.authToken, process.env.JWT_SECRET);
            currentUserId = user.id;
            currentUserRole = user.role;
        } catch (err) { /* Misafir */ }
    }

    try {
        const client = await pool.connect();
        let thread, replies, bestReply = null, totalReplies, totalPages;

        // --- 1. Ana Konu (Thread) Bilgilerini Çek (GÜVENLİ) ---
        
        // Parametreleri hazırla
        const threadQueryParams = [id]; // $1 = id
        
        let isLikedQuery = 'FALSE AS is_liked_by_user';
        if (currentUserId) {
            threadQueryParams.push(currentUserId); // $2 = currentUserId
            isLikedQuery = `EXISTS(SELECT 1 FROM thread_reactions tr WHERE tr.thread_id = p.id AND tr.user_id = $${threadQueryParams.length})`;
        }

        const threadQuery = `
            SELECT 
                p.*, 
                u.username AS author_username, 
                u.avatar_url AS author_avatar,
                u.title AS author_title,
                u.post_count AS author_post_count,
                u.created_at AS author_join_date,
                (SELECT COUNT(*) FROM thread_reactions tr WHERE tr.thread_id = p.id) AS like_count,
                ${isLikedQuery} 
            FROM posts p
            JOIN users u ON p.author_id = u.id
            WHERE p.id = $1; 
        `;
        
        const threadResult = await client.query(threadQuery, threadQueryParams); // Güvenli sorgu
        
        // Onay Kontrolü
        if (threadResult.rows.length === 0) { 
            client.release();
            return res.status(404).json({ message: 'Konu bulunamadı.' });
        }
        thread = threadResult.rows[0];
        // Onaylanmamış konuyu sadece admin görebilir
        if (thread.status !== 'approved' && currentUserRole !== 'admin') {
            client.release();
            return res.status(403).json({ message: 'Bu konuyu görüntüleme yetkiniz yok.' });
        }

        // --- 2. Varsa En İyi Cevabı Çek (GÜVENLİ) ---
        if (thread.best_reply_id) {
            const bestReplyQueryParams = [thread.best_reply_id]; // $1 = best_reply_id
            
            let isBestReplyLikedQuery = 'FALSE AS is_liked_by_user';
            if (currentUserId) {
                bestReplyQueryParams.push(currentUserId); // $2 = currentUserId
                isBestReplyLikedQuery = `EXISTS(SELECT 1 FROM reply_reactions rr WHERE rr.reply_id = r.id AND rr.user_id = $${bestReplyQueryParams.length})`;
            }

            const bestReplyQuery = `
                SELECT 
                    r.*,
                    u.username AS author_username, 
                    u.avatar_url AS author_avatar,
                    u.title AS author_title,
                    u.post_count AS author_post_count,
                    u.created_at AS author_join_date,
                    (SELECT COUNT(*) FROM reply_reactions rr WHERE rr.reply_id = r.id) AS like_count,
                    ${isBestReplyLikedQuery}
                FROM replies r
                JOIN users u ON r.author_id = u.id
                WHERE r.id = $1;
            `;
            const bestReplyResult = await client.query(bestReplyQuery, bestReplyQueryParams); // Güvenli sorgu
            if (bestReplyResult.rows.length > 0) {
                bestReply = bestReplyResult.rows[0];
            }
        }

        // --- 3. Toplam Cevap Sayısı (GÜVENLİ) ---
        const totalRepliesParams = [id]; // $1 = id
        let totalRepliesQuery = `SELECT COUNT(*) FROM replies WHERE thread_id = $1`;
        
        if (thread.best_reply_id) {
            totalRepliesParams.push(thread.best_reply_id); // $2 = best_reply_id
            totalRepliesQuery += ` AND id != $${totalRepliesParams.length}`; // "AND id != $2"
        }
        
        const totalRepliesResult = await client.query(totalRepliesQuery, totalRepliesParams); // Güvenli sorgu
        totalReplies = parseInt(totalRepliesResult.rows[0].count, 10);
        totalPages = Math.ceil(totalReplies / REPLIES_PER_PAGE);

        // --- 4. Diğer Cevapları Çek (GÜVENLİ) ---
        const repliesParams = [id, REPLIES_PER_PAGE, offset]; // $1, $2, $3
        
        let isReplyLikedQuery = 'FALSE AS is_liked_by_user';
        if (currentUserId) {
            repliesParams.push(currentUserId); // $4 = currentUserId
            isReplyLikedQuery = `EXISTS(SELECT 1 FROM reply_reactions rr WHERE rr.reply_id = r.id AND rr.user_id = $${repliesParams.length})`;
        }
        
        let bestReplyFilter = '';
        if (thread.best_reply_id) {
            repliesParams.push(thread.best_reply_id); // $4 veya $5
            bestReplyFilter = `AND r.id != $${repliesParams.length}`;
        }

        const repliesQuery = `
            SELECT 
                r.*,
                u.username AS author_username, 
                u.avatar_url AS author_avatar,
                u.title AS author_title,
                u.post_count AS author_post_count,
                u.created_at AS author_join_date,
                (SELECT COUNT(*) FROM reply_reactions rr WHERE rr.reply_id = r.id) AS like_count,
                ${isReplyLikedQuery}
            FROM replies r
            JOIN users u ON r.author_id = u.id
            WHERE r.thread_id = $1
            ${bestReplyFilter}
            ORDER BY r.created_at ASC
            LIMIT $2 OFFSET $3;
        `;
        const repliesResult = await client.query(repliesQuery, repliesParams); // Güvenli sorgu
        replies = repliesResult.rows;
        
        client.release();
        
        // Başarılı yanıt
        res.json({
            thread: thread,
            replies: replies,
            bestReply: bestReply,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalReplies: totalReplies
            }
        });

    } catch (err) {
        // DÜZELTME: Hata yönetimi CATCH bloğunun İÇİNDE
        console.error("Konu detaylarını getirirken hata:", err.message);
        res.status(500).json({ message: 'Sunucu Hatası: Konu detayları yüklenemedi.' });
    }
});

// --- KONUYA CEVAP VERME (GÜVENLİ HALE GETİRİLDİ) ---
router.post("/api/threads/:id/reply", authenticateToken, async (req, res) => {
  const { id: threadId } = req.params;
  const { content } = req.body;
  const authorId = req.user.id;

  // 1. Backend XSS Koruması: İçeriği temizle
  const cleanContent = DOMPurify.sanitize(content);

  // 2. Boş içerik kontrolünü temizlenmiş veri üzerinden yap
  // (Kullanıcı <script></script> gibi boş ama zararlı etiketler göndermesin)
  if (
    !cleanContent ||
    cleanContent.trim() === "" ||
    cleanContent === "<p><br></p>"
  ) {
    return res.status(400).json({ message: "Cevap içeriği boş olamaz." });
  }

  try {
    // Konu kilitli mi diye kontrol et
    const threadCheck = await pool.query(
      "SELECT is_locked, best_reply_id, status FROM posts WHERE id = $1",
      [threadId]
    );
    if (threadCheck.rows.length === 0) {
      return res.status(404).json({ message: "Konu bulunamadı." });
    }
    if (threadCheck.rows[0].is_locked) {
      return res
        .status(403)
        .json({ message: "Bu konu kilitlenmiştir, cevap yazılamaz." });
    }

    const client = await pool.connect();
    let newReplyId;
    try {
      await client.query("BEGIN");

      // 3. Cevabı Ekle (XSS DÜZELTMESİ)
      // Veritabanına 'content' yerine 'cleanContent' kaydediliyor
      const newReply = await client.query(
        "INSERT INTO replies (content, thread_id, author_id) VALUES ($1, $2, $3) RETURNING id",
        [cleanContent, threadId, authorId] // Düzeltildi
      );
      newReplyId = newReply.rows[0].id;

      // 4. Kullanıcının post sayısını güncelle
      await client.query(
        "UPDATE users SET post_count = post_count + 1 WHERE id = $1",
        [authorId]
      );

      await client.query("COMMIT");

      // 5. Son sayfa numarasını hesapla (SQL INJECTION DÜZELTMESİ)
      const bestReplyId = threadCheck.rows[0].best_reply_id;

      // Sorguyu parametreli hale getir
      const queryParams = [threadId]; // $1 = threadId
      let totalRepliesQuery = `
                SELECT COUNT(*) FROM replies 
                WHERE thread_id = $1
            `;

      if (bestReplyId) {
        queryParams.push(bestReplyId); // $2 = bestReplyId
        totalRepliesQuery += ` AND id != $${queryParams.length}`; // "AND id != $2"
      }

      // Sorguyu güvenli parametrelerle çalıştır
      const totalRepliesResult = await pool.query(
        totalRepliesQuery,
        queryParams
      );
      const totalReplies = parseInt(totalRepliesResult.rows[0].count, 10);

      // REPLIES_PER_PAGE sabitinin dosyanın üstünde tanımlı olduğundan emin ol
      const lastPage = Math.ceil(totalReplies / REPLIES_PER_PAGE);

      // YENİ: Konu sahibine bildirim gönder (eğer cevaplayan kişi konu sahibi değilse)
      const threadAuthorResult = await client.query(
        "SELECT author_id, title FROM posts WHERE id = $1",
        [threadId]
      );
      const threadAuthorId = threadAuthorResult.rows[0].author_id;
      const threadTitle = threadAuthorResult.rows[0].title;

      if (threadAuthorId !== authorId) {
        await client.query(
          "INSERT INTO notifications (user_id, type, source_id, message) VALUES ($1, $2, $3, $4)",
          [
            threadAuthorId,
            "new_reply",
            newReplyId,
            `Konunuz "${threadTitle}" için yeni bir cevap var.`,
          ]
        );
      }

      res.status(201).json({
        message: "Cevap başarıyla eklendi.",
        replyId: newReplyId,
        lastPage: lastPage,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err; // Hata ana 'catch' bloğuna gitsin
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Cevap eklerken hata:", err.message);
    res.status(500).json({ message: "Sunucu Hatası: Cevap eklenemedi." });
  }
});

// --- KULLANICI PROFİL ROTASI (GÜVENLİ HALE GETİRİLDİ) ---
router.get("/api/profile/:username", async (req, res) => {
  try {
    const { username } = req.params;

    // --- 1. GİRİŞ YAPAN KULLANICIYI AL (YENİ) ---
    // Token'ı doğrula ve isteği yapanın ID'sini al
    let currentUserId = null;
    if (req.cookies.authToken) {
      try {
        // Token'ı doğrula (JWT_SECRET'ınız process.env'de olmalı)
        const user = jwt.verify(req.cookies.authToken, process.env.JWT_SECRET);
        currentUserId = user.id; // Giriş yapan kullanıcının ID'si
      } catch (err) {
        // Token geçersizse veya süresi dolmuşsa misafir olarak devam et
      }
    }

    // --- 2. PROFİL KULLANICI BİLGİLERİNİ ÇEK (MEVCUT) ---
    const userResult = await pool.query(
      "SELECT id, username, avatar_url, title, post_count, created_at FROM users WHERE username = $1",
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }

    const user = userResult.rows[0];
    const profileUserId = user.id; // Bu, bakılan profilin ID'si

    // --- 3. SORGULARI HAZIRLA ---

    // A. Herkesin görebileceği sorgu (Onaylı Aktiviteler)
    const recentRepliesQuery = pool.query(
      `
            SELECT 
                r.id AS reply_id, 
                r.content, 
                r.created_at,
                p.id AS thread_id,
                p.title AS thread_title
            FROM replies r
            JOIN posts p ON r.thread_id = p.id
            WHERE r.author_id = $1 AND p.status = 'approved'
            ORDER BY r.created_at DESC
            LIMIT 15;
        `,
      [profileUserId]
    ); // DÜZELTME: Tanımsız 'userId' yerine 'profileUserId' kullanıldı

    // B. Gizli sorgular için varsayılan boş sonuçları hazırla
    let rejectedPostsQuery = Promise.resolve({ rows: [] });
    let pendingPostsQuery = Promise.resolve({ rows: [] });

    // --- 4. ERİŞİM KONTROLÜ (YENİ) ---
    // Sadece giriş yapan kullanıcı, baktığı profilin sahibiyse
    // reddedilen ve bekleyen postları sorgula.
    if (currentUserId && currentUserId === profileUserId) {
      rejectedPostsQuery = pool.query(
        `
                SELECT id, title, status FROM posts 
                WHERE author_id = $1 AND status = 'rejected'
                ORDER BY created_at DESC
                LIMIT 5;
            `,
        [profileUserId]
      ); // DÜZELTME: Tanımsız 'userId' yerine 'profileUserId' kullanıldı

      pendingPostsQuery = pool.query(
        `
                SELECT id, title, status FROM posts
                WHERE author_id = $1 AND status = 'pending'
                ORDER BY created_at DESC
                LIMIT 5;
            `,
        [profileUserId]
      ); // DÜZELTME: Tanımsız 'userId' yerine 'profileUserId' kullanıldı
    }

    // --- 5. TÜM SORGULARI ÇALIŞTIR ---
    // Sorgular ya dolu (eğer yetkisi varsa) ya da boş (varsayılan) olarak çalışacak
    const [repliesResult, rejectedPostsResult, pendingPostsResult] =
      await Promise.all([
        recentRepliesQuery,
        rejectedPostsQuery,
        pendingPostsQuery,
      ]);

    // --- 6. GÜVENLİ YANITI GÖNDER ---
    res.json({
      user: user,
      recentActivity: repliesResult.rows,
      rejectedPosts: rejectedPostsResult.rows, // Artık güvenli
      pendingPosts: pendingPostsResult.rows, // Artık güvenli
    });
  } catch (err) {
    console.error("Profil getirirken hata:", err.message);
    res.status(500).json({ message: "Sunucu Hatası: Profil yüklenemedi." });
  }
});

module.exports = router;