const express = require("express");
const router = express.Router();

const {
    register,
    login,
    profile
} = require("../controllers/authController");

const {
    loginLimiter,
    registerLimiter
} = require("../middleware/rateLimiter");

const auth = require("../middleware/auth");

router.post(
    "/register",
    registerLimiter,
    register
);

router.post(
    "/login",
    loginLimiter,
    login
);

router.get("/profile", auth, profile);

module.exports = router;