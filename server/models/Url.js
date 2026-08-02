const mongoose = require("mongoose");

const urlSchema = new mongoose.Schema({

    originalUrl: {
        type: String,
        required: true
    },

    shortCode: {
        type: String,
        required: true,
        unique: true
    },

    clicks: {
        type: Number,
        default: 0
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    isActive: {
        type: Boolean,
        default: true
    },

    expiresAt: {
        type: Date,
        default: null
    },

    qrCode: {
        type: String,
        default: null
    }

}, {
    timestamps: true
});

module.exports = mongoose.model("Url", urlSchema);