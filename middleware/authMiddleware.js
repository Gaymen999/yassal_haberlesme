// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');

// index.js'den authenticateToken fonksiyonunu buraya taşıdık
const authenticateToken = (req, res, next) => {
    // ... (authenticateToken fonksiyonunun içeriği aynı)
    const token = req.cookies.authToken; 
    
    // DEĞİŞTİ: res.sendStatus(401) yerine JSON yolla
    if (token == null) {
        return res.status(401).json({ message: 'Bu işlem için lütfen giriş yapın.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        // DEĞİŞTİ: res.sendStatus(403) yerine JSON yolla
        if (err) {
            return res.status(403).json({ message: 'Oturumunuz geçersiz veya süresi dolmuş.' });
        }
        req.user = user; 
        next();
    });
};

const isAdmin = (req, res, next) => { // ARTIK 'exports.' YOK, SADECE CONST
    // ... admin kontrol mantığı ...
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Yönetici yetkisi gerekli.' });
    }
};

// index.js'den authorizeAdmin fonksiyonunu buraya taşıdık
const authorizeAdmin = (req, res, next) => {
    // Bu kısım zaten doğruydu (JSON yolluyordu), aynı kalıyor
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Bu işlem için yetkiniz yok.' }); // Admin Değil
    }
    next();
};

// Üç fonksiyonu da export et
module.exports = {
    authenticateToken,
    authorizeAdmin,
    isAdmin // <<< İŞTE BU EKLENMELİYDİ!
};