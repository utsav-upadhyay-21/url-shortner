const mongoose = require("mongoose");

const clickSchema = new mongoose.Schema({
    url: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Url",
        required: true,
        index: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    ip: {
        type: String,
        default: null
    },
    userAgent: {
        type: String,
        default: null
    },
    referrer: {
        type: String,
        default: null
    },
    country: {
        type: String,
        default: "Unknown"
    },
    city: {
        type: String,
        default: "Unknown"
    },
    browser: {
        type: String,
        default: "Unknown"
    },
    os: {
        type: String,
        default: "Unknown"
    },
    device: {
        type: String,
        default: "Unknown"
    }
}, {
    timestamps: true
});

clickSchema.index({ url: 1, timestamp: -1 });

module.exports = mongoose.model("Click", clickSchema);
