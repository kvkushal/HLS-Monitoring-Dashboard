const mongoose = require('mongoose');

const VisitorSchema = new mongoose.Schema({
    visitorId: { type: String, required: true, unique: true }, // Client-generated UUID stored in localStorage
    ip: String,
    // Location Data from geoip-lite
    location: {
        country: String,
        region: String,
        city: String,
        ll: [Number], // Latitude, Longitude
        timezone: String
    },
    // Device Data from ua-parser-js
    device: {
        browser: String,
        browserVersion: String,
        os: String,
        osVersion: String,
        deviceType: String, // mobile, tablet, console, smarttv, wearable, embedded
        deviceModel: String,
        deviceVendor: String,
        cpuArchitecture: String
    },
    // Screen/Display Data from client
    screen: {
        width: Number,
        height: Number,
        colorDepth: Number,
        pixelRatio: Number
    },
    // User Info
    name: { type: String, default: 'Guest' }, // Placeholder for future auth
    email: { type: String },

    // Usage Stats
    visitCount: { type: Number, default: 0 },
    lastVisit: { type: Date, default: Date.now },
    firstVisit: { type: Date, default: Date.now },

    // Metadata
    metadata: {
        referrer: String,
        landingPage: String,
        language: String
    }
}, { timestamps: true });

// Update lastVisit on save
VisitorSchema.pre('save', function (next) {
    this.lastVisit = new Date();
    next();
});

module.exports = mongoose.model('Visitor', VisitorSchema);
