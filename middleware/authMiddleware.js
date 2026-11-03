const jwt = require('jsonwebtoken');

module.exports = function authMiddleware(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, process.env.SECRET_KEY);
    req.userId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
