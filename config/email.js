// config/email.js
const nodemailer = require('nodemailer');

// Nodemailer transporter'ını (taşıyıcı) oluştur
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Render'a eklediğin e-posta
        pass: process.env.EMAIL_PASS  // Render'a eklediğin uygulama şifresi
    }
});

// Mail gönderme fonksiyonu
const sendApprovalEmail = async (post, authorUsername) => {
    const adminEmail = process.env.EMAIL_USER; // Maili yine adminin kendine (sana) yolluyoruz
    
    // Postu görüntüleme linki (Site adresini manuel yazman gerekebilir)
    // Render'daki site adresini buraya ekle:
    const siteUrl = "https://yassal-haberlesme.onrender.com"; // VEYA kendi domainin
    const postLink = `${siteUrl}/thread.html?id=${post.id}`;
    const adminPanelLink = `${siteUrl}/admin.html`;

    const mailOptions = {
        from: `"Yassal Haberleşme" <${process.env.EMAIL_USER}>`,
        to: adminEmail, // Adminin kendisine
        subject: `Yeni Konu Onay Bekliyor: "${post.title}"`,
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
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Onay maili gönderildi: ${post.title}`);
    } catch (error) {
        console.error("Mail gönderme hatası:", error);
        // Mail gitmese bile sunucunun çökmemesi için hatayı sadece log'luyoruz
    }
};

module.exports = {
    sendApprovalEmail
};