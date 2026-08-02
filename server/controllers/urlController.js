const validator = require("validator");

const Url = require("../models/Url");

const generateShortCode = require("../utils/generateShortCode");

const redisClient = require("../config/redis");

const QRCode = require("qrcode");

const createShortUrl = async(req,res)=>{

    try{

        const{

            originalUrl

        }=req.body;

        if(!originalUrl){

            return res.status(400).json({

                message:"URL is required"

            });

        }

        if(!validator.isURL(originalUrl)){

            return res.status(400).json({

                message:"Invalid URL"

            });

        }

        const shortCode = generateShortCode();

        const url = await Url.create({

            originalUrl,

            shortCode,

            createdBy:req.user.id

        });

        res.status(201).json({

            success:true,

            message:"Short URL Created",

            data:{

                originalUrl:url.originalUrl,

                shortCode:url.shortCode,

                shortUrl:`http://localhost:5173/${url.shortCode}`

            }

        });

    }

    catch(error){

        res.status(500).json({

            message:error.message

        });

    }

};
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

const { id } = req.params;

const { originalUrl } = req.body;

const url = await Url.findById(id);

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

const { id } = req.params;

const url = await Url.findById(id);

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

        res.status(200).json({

            success:true,

            data:{

                originalUrl:url.originalUrl,

                shortCode:url.shortCode,

                clicks:url.clicks,

                status,

                expiresAt:url.expiresAt,

                createdAt:url.createdAt,

                updatedAt:url.updatedAt

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

module.exports = {

    createShortUrl,

    redirectUrl,

    getMyUrls,

    updateUrl,

    deleteUrl,

    getAnalytics,

    getQrCode

};
