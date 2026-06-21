const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // no token
    if (!authHeader) {
      return res.status(401).json({
        message: 'Unauthorized',
      });
    }

    // extract token
    const token = authHeader.split(' ')[1];

    // verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // attach user info
    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      message: 'Invalid token',
    });
  }
};