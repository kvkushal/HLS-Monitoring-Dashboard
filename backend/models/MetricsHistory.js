const mongoose = require('mongoose');

const MetricsHistorySchema = new mongoose.Schema({
    streamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Stream',
        required: true,
        index: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    healthScore: Number,
    videoScore: Number,
    audioScore: Number,
    // Live signal data for graphs
    videoBitrate: Number,  // in bps
    audioBitrate: Number,  // in bps
    videoLevel: Number,    // 0-100 normalized
    audioLevel: Number,    // 0-100 normalized
    fps: Number,
    status: String,
    mediaSequence: Number,
    segmentCount: Number,
    errorCount: Number
});

// Compound index for efficient queries
MetricsHistorySchema.index({ streamId: 1, timestamp: -1 });

// Auto-delete old records (keep last 7 days)
MetricsHistorySchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 });

module.exports = mongoose.model('MetricsHistory', MetricsHistorySchema);
