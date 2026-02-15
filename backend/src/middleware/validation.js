const { body, validationResult } = require('express-validator');

function validationErrorHandler(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'validation_error',
      details: errors.array().map((e) => ({
        field: e.param,
        message: e.msg,
      })),
    });
  }
  next();
}

const validateSignup = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),
  body('username')
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-50 characters, alphanumeric and underscores only'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  validationErrorHandler,
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  validationErrorHandler,
];

module.exports = {
  validationErrorHandler,
  validateSignup,
  validateLogin,
};
