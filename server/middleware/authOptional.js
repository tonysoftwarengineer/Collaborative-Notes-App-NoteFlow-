const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if no token
  if (!token) {
    req.user = null;
    req.isGuest = false;
    req.userName = null;
    return next();
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.userId;
    req.isGuest = decoded.isGuest || false;
    req.userName = decoded.name || null;
    next();
  } catch (err) {
    req.user = null;
    req.isGuest = false;
    req.userName = null;
    next();
  }
};
