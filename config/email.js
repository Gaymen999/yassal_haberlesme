// config/email.js
const nodemailer = require('nodemailer');

// --- YENİ SENDGRID AYARLARI ---
// Eski 'transporter' ayarlarını bununla değiştiriyorsun.
// 'EMAIL_PASS' artık kullanılmayacak, 'SENDGRID_API_KEY' ve 'SENDER_EMAIL' kullanılacak.
const transporter = nodemailer.createTransport({
    host: 'smtp.sendgrid.net', // SendGrid için sabit host
    port: 587,
    secure: false, // TLS için false (STARTTLS kullanır)
    auth: {
        user: 'apikey', // Bu kelime sabit, değişmiyor
        pass: process.env.SENDGRID_API_KEY // Render'a eklediğin SendGrid API Anahtarı
    }
});
// --- AYARLAR BİTTİ ---


// Mail gönderme fonksiyonu (İçeriği aynı, sadece 'from' adresi güncellendi)
const sendApprovalEmail = async (post, authorUsername) => {
    // SENDER_EMAIL, SendGrid'de doğruladığın e-posta adresin olmalı
    const verifiedSenderEmail = process.env.SENDER_EMAIL; 
    
    // Mailin kime gideceği (Adminin kendisi - bu değişmedi)
    const adminEmail = process.env.EMAIL_USER; //
    
    // Site linkleri (Bunlar da aynı)
    const siteUrl = "https://yassal-haberlesme.onrender.com"; //
    const postLink = `${siteUrl}/thread.html?id=${post.id}`; //
    const adminPanelLink = `${siteUrl}/admin.html`; //

    const mailOptions = {
        // ÖNEMLİ: 'from' adresi SendGrid'de doğruladığın adres OLMALIDIR.
        from: `"Yassal Haberleşme" <${verifiedSenderEmail}>`, // GÜNCELLENDİ
        
        to: adminEmail, //
        subject: `Yeni Konu Onay Bekliyor: "${post.title}"`, //
        html: `
            <h1>Yeni Bir Konu Onay Bekliyor</h1>
            <p><strong>Yazar:</strong> ${authorUsername}</p>
            <p><strong>Başlık:</strong> ${post.title}</p>
            <hr>
            <h3>İçerik (İlk 100 karakter):</h3>
            <p><i>${post.content.substring(0, 100)}...</i></p>
            <hr>
            <p>Konuyu incelemek ve onaylamak için aşağıdaki linkleri kullanabilirsiniz:</p>
            <p><a href="${postLink}" style="font-size: 16px; padding: 10px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
                Konuyu Görüntüle
            </a></p>
            <p><a href="${adminPanelLink}" style="font-size: 16px; padding: 10px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px;">
                Admin Paneline Git
            </a></p>
        ` // HTML içeriği aynı kaldı
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Onay maili gönderildi: ${post.title}`); //
    } catch (error) {
        console.error("Mail gönderme hatası:", error); //
        // Mail gitmese bile sunucunun çökmemesi için hatayı sadece log'luyoruz
    }
};

module.exports = {
    sendApprovalEmail //
};