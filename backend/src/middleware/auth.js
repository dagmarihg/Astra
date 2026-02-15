const { verifyToken } = require('../utils/jwt');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_token' });
  }

  const token = authHeader.slice(7); // Remove 'Bearer '
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  req.user = payload;
  next();
}

module.exports = authMiddleware;
