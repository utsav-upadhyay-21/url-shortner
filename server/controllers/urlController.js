const validator = require("validator");

const Url = require("../models/Url");

const Click = require("../models/Click");

const generateShortCode = require("../utils/generateShortCode");

const redisClient = require("../config/redis");

const QRCode = require("qrcode");

function parseUserAgent(ua) {
    if (!ua) return { browser: "Unknown", os: "Unknown", device: "Unknown" };
    let browser = "Other";
    let os = "Other";
    let device = "Desktop";

    if (/mobile|android|iphone|ipod/i.test(ua)) device = "Mobile";
    else if (/ipad|tablet/i.test(ua)) device = "Tablet";

    if (/chrome/i.test(ua) && !/edge|opr|opera/i.test(ua)) browser = "Chrome";
    else if (/firefox/i.test(ua)) browser = "Firefox";
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
    else if (/edge/i.test(ua)) browser = "Edge";
    else if (/opr|opera/i.test(ua)) browser = "Opera";

    if (/windows/i.test(ua)) os = "Windows";
    else if (/macintosh|mac os/i.test(ua)) os = "macOS";
    else if (/linux/i.test(ua)) os = "Linux";
    else if (/android/i.test(ua)) os = "Android";
    else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";

    return { browser, os, device };
}

async function recordClick(urlId, req) {
    try {
        const ua = req.headers["user-agent"] || "";
        const referrer = req.headers["referer"] || req.headers["referrer"] || null;
        let ip = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.socket?.remoteAddress || null;
        if (ip && ip.includes(",")) ip = ip.split(",")[0].trim();
        if (ip === "::1" || ip === "127.0.0.1" || ip === "::ffff:127.0.0.1") ip = null;

        const { browser, os, device } = parseUserAgent(ua);

        let country = "Unknown";
        let city = "Unknown";

        const countryHeader = req.headers["cf-ipcountry"] || req.headers["x-country"] || null;
        if (countryHeader) {
            country = countryHeader;
        }

        const cityHeader = req.headers["x-city"] || null;
        if (cityHeader) {
            city = cityHeader;
        }

        await Click.create({
            url: urlId,
            ip,
            userAgent: ua,
            referrer,
            country,
            city,
            browser,
            os,
            device
        });
    } catch (err) {
        console.error("Failed to record click:", err.message);
    }
}

const createShortUrl = async (req, res) => {

    try {

        const { originalUrl } = req.body;

        if (!originalUrl) {

            return res.status(400).json({
                message: "URL is required"
            });

        }

        if (!validator.isURL(originalUrl)) {

            return res.status(400).json({
                message: "Invalid URL"
            });

        }

        const shortCode = generateShortCode();

        const url = await Url.create({

            originalUrl,

            shortCode,

            createdBy: req.user.id

        });

        // Create Short URL
        const shortUrl = `http://localhost:5173/${url.shortCode}`;

        // Generate QR Code
        const qrCode = await QRCode.toDataURL(shortUrl);

        // Save QR Code in MongoDB
        url.qrCode = qrCode;

        await url.save();

        res.status(201).json({

            success: true,

            message: "Short URL Created",

            data: {

                originalUrl: url.originalUrl,

                shortCode: url.shortCode,

                shortUrl,

                qrCode: url.qrCode

            }

        });

    }

    catch (error) {

        res.status(500).json({

            message: error.message

        });

    }

};
const getMyUrls = async (req, res) => {

    try {

        const userId = req.user.id;

        // Read page and limit from URL
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;

        // Calculate how many documents to skip
        const skip = (page - 1) * limit;

        // Count total URLs
        const totalUrls = await Url.countDocuments({
            createdBy: userId
        });

        // Fetch paginated URLs
        const urls = await Url.find({
            createdBy: userId
        })
        .sort({
            createdAt: -1
        })
        .skip(skip)
        .limit(limit);

        res.status(200).json({

            success: true,

            currentPage: page,

            pageSize: limit,

            totalUrls,

            totalPages: Math.ceil(totalUrls / limit),

            data: urls

        });

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }

};
const updateUrl = async(req,res)=>{

try{

const { shortCode } = req.params;

const { originalUrl } = req.body;

const url = await Url.findOne({ shortCode });

if(!url){

return res.status(404).json({

message:"URL not found"

});

}

if(

url.createdBy.toString()

!==

req.user.id

){

return res.status(403).json({

message:"Unauthorized"

});

}

if(

!validator.isURL(originalUrl)

){

return res.status(400).json({

message:"Invalid URL"

});

}

url.originalUrl = originalUrl;


await url.save();

// Remove old cache
await redisClient.del(url.shortCode);

res.status(200).json({

success:true,

message:"URL Updated",

data:url

});

}

catch(error){

res.status(500).json({

message:error.message

});

}

};

const deleteUrl = async(req,res)=>{

try{

const { shortCode } = req.params;

const url = await Url.findOne({ shortCode });

if(!url){

return res.status(404).json({

message:"URL not found"

});

}

if(

url.createdBy.toString()

!==

req.user.id

){

return res.status(403).json({

message:"Unauthorized"

});

}

await Url.findOneAndDelete({
    shortCode
});

await redisClient.del(url.shortCode);

res.status(200).json({
    success: true,
    message: "URL Deleted"
});

}

catch(error){

res.status(500).json({

message:error.message

});

}

};

const getAnalytics = async(req,res)=>{

    try{

        const { shortCode } = req.params;

        const url = await Url.findOne({

            shortCode

        });

        if(!url){

            return res.status(404).json({

                message:"URL not found"

            });

        }

        if(

            url.createdBy.toString()

            !==

            req.user.id

        ){

            return res.status(403).json({

                message:"Unauthorized"

            });

        }

        const status = url.isActive

            ? "Active"

            : "Inactive";

        const clicksByDate = await Click.aggregate([
            { $match: { url: url._id } },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } },
            { $limit: 30 }
        ]);

        const clicksByCountry = await Click.aggregate([
            { $match: { url: url._id } },
            {
                $group: {
                    _id: "$country",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        const clicksByBrowser = await Click.aggregate([
            { $match: { url: url._id } },
            {
                $group: {
                    _id: "$browser",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        const clicksByOs = await Click.aggregate([
            { $match: { url: url._id } },
            {
                $group: {
                    _id: "$os",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        const clicksByDevice = await Click.aggregate([
            { $match: { url: url._id } },
            {
                $group: {
                    _id: "$device",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        const clicksByReferrer = await Click.aggregate([
            { $match: { url: url._id, referrer: { $ne: null } } },
            {
                $group: {
                    _id: "$referrer",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        const recentClicks = await Click.find({ url: url._id })
            .sort({ timestamp: -1 })
            .limit(50)
            .select("timestamp browser os device country city referrer");

        res.status(200).json({

            success:true,

            data:{

                originalUrl:url.originalUrl,

                shortCode:url.shortCode,

                clicks:url.clicks,

                status,

                expiresAt:url.expiresAt,

                createdAt:url.createdAt,

                updatedAt:url.updatedAt,

                analyticsEnabled: url.analyticsEnabled,

                clicksByDate: clicksByDate.map(d => ({ date: d._id, clicks: d.count })),

                clicksByCountry: clicksByCountry.map(d => ({ country: d._id, clicks: d.count })),

                clicksByBrowser: clicksByBrowser.map(d => ({ browser: d._id, clicks: d.count })),

                clicksByOs: clicksByOs.map(d => ({ os: d._id, clicks: d.count })),

                clicksByDevice: clicksByDevice.map(d => ({ device: d._id, clicks: d.count })),

                clicksByReferrer: clicksByReferrer.map(d => ({ referrer: d._id, clicks: d.count })),

                recentClicks

            }

        });

    }

    catch(error){

        res.status(500).json({

            message:error.message

        });

    }

};
const getQrCode = async (req, res) => {

    try {

        const { shortCode } = req.params;

        const url = await Url.findOne({

            shortCode

        });

        if (!url) {

            return res.status(404).json({

                message: "URL not found"

            });

        }

        if (url.createdBy.toString() !== req.user.id) {

            return res.status(403).json({

                message: "Unauthorized"

            });

        }

        res.status(200).json({

            success: true,

            data: {

                shortCode: url.shortCode,

                qrCode: url.qrCode

            }

        });

    }

    catch (error) {

        res.status(500).json({

            message: error.message

        });

    }

};

const redirectUrl = async (req, res) => {

    try {

        const { shortCode } = req.params;

        const cached = await redisClient.get(shortCode);

        if (cached) {

            const cachedUrl = JSON.parse(cached);

            const urlDoc = await Url.findOne({ shortCode });

            await Url.updateOne(
                { shortCode },
                { $inc: { clicks: 1 } }
            );

            if (urlDoc && urlDoc.analyticsEnabled) {
                recordClick(urlDoc._id, req);
            }

            return res.redirect(cachedUrl.originalUrl);

        }

        const url = await Url.findOne({
            shortCode
        });

        if (!url) {

            return res.status(404).json({
                message: "URL not found"
            });

        }

        if (!url.isActive) {

            return res.status(403).json({
                message: "URL is inactive"
            });

        }

        if (url.expiresAt && new Date(url.expiresAt) < new Date()) {

            return res.status(410).json({
                message: "URL has expired"
            });

        }

        await redisClient.set(
            shortCode,
            JSON.stringify({
                originalUrl: url.originalUrl
            })
        );

        await Url.updateOne(
            { shortCode },
            { $inc: { clicks: 1 } }
        );

        if (url.analyticsEnabled) {
            recordClick(url._id, req);
        }

        res.redirect(url.originalUrl);

    }

    catch (error) {

        res.status(500).json({
            message: error.message
        });

    }

};

const toggleAnalytics = async(req, res) => {
    try {
        const { shortCode } = req.params;
        const url = await Url.findOne({ shortCode });

        if (!url) {
            return res.status(404).json({ message: "URL not found" });
        }

        if (url.createdBy.toString() !== req.user.id) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        url.analyticsEnabled = !url.analyticsEnabled;
        await url.save();

        res.status(200).json({
            success: true,
            message: `Analytics ${url.analyticsEnabled ? "enabled" : "disabled"}`,
            data: { analyticsEnabled: url.analyticsEnabled }
        });
    } catch(error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {

    createShortUrl,

    redirectUrl,

    getMyUrls,

    updateUrl,

    deleteUrl,

    getAnalytics,

    getQrCode,

    toggleAnalytics

};
