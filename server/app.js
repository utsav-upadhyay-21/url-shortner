const express = require("express");

const app = express();

app.use(express.json());

const authRoutes = require("./routes/authRoutes");

const urlRoutes = require("./routes/urlRoutes");

app.use("/api/auth", authRoutes);

app.use("/api/url", urlRoutes);

app.get("/", (req, res) => {

    res.json({

        success: true,

        message: "Smart URL Shortener API"

    });

});

module.exports = app;