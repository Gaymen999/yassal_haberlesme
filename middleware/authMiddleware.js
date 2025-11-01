const jwt = require('jsonwebtoken');

// index.js'den authenticateToken fonksiyonunu buraya taşıdık
const authenticateToken = (req, res, next) => {
    const token = req.cookies.authToken; 
    
    if (token == null) return res.sendStatus(401); // Yetkisiz

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Geçersiz Token
        req.user = user; 
        next();
    });
};

// index.js'den authorizeAdmin fonksiyonunu buraya taşıdık
const authorizeAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Bu işlem için yetkiniz yok.' }); // Admin Değil
    }
    next();
};

// İki fonksiyonu de export et
module.exports = {
    authenticateToken,
    authorizeAdmin
};