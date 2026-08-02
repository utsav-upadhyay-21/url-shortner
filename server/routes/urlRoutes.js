const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");
const {

    createShortUrl,

    redirectUrl,

    getMyUrls,

    updateUrl,

    deleteUrl,

    getAnalytics,

    getQrCode

} = require("../controllers/urlController");

const {
    createUrlLimiter,
    redirectLimiter
} = require("../middleware/rateLimiter");

router.post(
    "/",
    auth,
    createUrlLimiter,
    createShortUrl
);

router.get(
    "/:shortCode",
    redirectLimiter,
    redirectUrl
);

router.post("/", auth, createUrlLimiter, createShortUrl);

router.get("/my-urls", auth, getMyUrls);

router.put("/:shortCode", auth, updateUrl);

router.delete("/:shortCode", auth, deleteUrl);

router.get("/:shortCode/analytics", auth, getAnalytics);

router.get("/:shortCode/qr", auth, getQrCode);

router.get("/:shortCode", redirectLimiter, redirectUrl);

module.exports = router;