const rateLimit = require("express-rate-limit");

// Login Limiter Rate Limiting
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: {
        success: false,
        message: "Too many login attempts. Please try again after 15 minutes."
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Register Limiter Rate Limiting
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: {
        success: false,
        message: "Too many registration attempts. Please try again later."
    }
});

// URL Creation Limiter 
const createUrlLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: {
        success: false,
        message: "Too many URLs created. Please slow down."
    }
});

// Redirect Limiter
const redirectLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 1000,
    message: {
        success: false,
        message: "Too many requests."
    }
});

module.exports = {
    loginLimiter,
    registerLimiter,
    createUrlLimiter,
    redirectLimiter
};