const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/sprites', express.static('public/sprites'));

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/hls-monitor')
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// Models
const Stream = require('./models/Stream');
const AuditLog = require('./models/AuditLog');

// Audit Logger Helper
async function logAction(action, streamData, req) {
    try {
        await AuditLog.create({
            action,
            streamId: streamData._id || streamData.id,
            streamName: streamData.name,
            streamUrl: streamData.url,
            details: streamData.details || null,
            ipAddress: req.ip || req.connection?.remoteAddress,
            userAgent: req.get('User-Agent')
        });
    } catch (err) {
        console.error('Audit log error:', err.message);
    }
}

// Routes
app.get('/', (req, res) => {
    res.send('HLS Monitor API is running');
});

// ===== STREAM ROUTES =====

// Add stream
app.post('/api/streams', async (req, res) => {
    try {
        const { url, name } = req.body;
        const stream = new Stream({ url, name });
        await stream.save();

        // Log the action
        await logAction('STREAM_ADDED', stream, req);

        res.status(201).json(stream);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get all streams
app.get('/api/streams', async (req, res) => {
    try {
        const streams = await Stream.find().sort({ createdAt: -1 });
        res.json(streams);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single stream
app.get('/api/streams/:id', async (req, res) => {
    try {
        const stream = await Stream.findById(req.params.id);
        if (!stream) return res.status(404).json({ error: 'Not found' });
        res.json(stream);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete stream
app.delete('/api/streams/:id', async (req, res) => {
    try {
        const stream = await Stream.findById(req.params.id);
        if (!stream) return res.status(404).json({ error: 'Not found' });

        // Log before deleting
        await logAction('STREAM_DELETED', stream, req);

        await Stream.findByIdAndDelete(req.params.id);
        res.json({ message: 'Stream deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Download stream log (Human-Readable Format)
app.get('/api/streams/:id/log', async (req, res) => {
    try {
        const stream = await Stream.findById(req.params.id);
        if (!stream) return res.status(404).json({ error: 'Not found' });

        // Log the download action
        await logAction('LOG_DOWNLOADED', {
            ...stream.toObject(),
            details: `Log file downloaded for stream: ${stream.name}`
        }, req);

        const health = stream.health || {};
        const stats = stream.stats || {};
        const errors = stream.streamErrors || [];

        // Build human-readable log
        let log = `
╔════════════════════════════════════════════════════════════════════╗
║                    HLS MONITOR - STREAM LOG                        ║
╚════════════════════════════════════════════════════════════════════╝

📺 STREAM INFORMATION
─────────────────────────────────────────────────────────────────────
  Name:           ${stream.name}
  URL:            ${stream.url}
  Status:         ${stream.status?.toUpperCase() || 'UNKNOWN'}
  Export Date:    ${new Date().toLocaleString()}

📊 HEALTH METRICS
─────────────────────────────────────────────────────────────────────
  Is Stale:           ${health.isStale ? 'YES ⚠️' : 'NO ✅'}
  Media Sequence:     ${health.mediaSequence ?? 'N/A'}
  Segment Count:      ${health.segmentCount ?? 'N/A'}
  Target Duration:    ${health.targetDuration ? health.targetDuration + 's' : 'N/A'}
  Playlist Type:      ${health.playlistType || 'N/A'}
  
  Sequence Jumps:     ${health.sequenceJumps ?? 0}
  Sequence Resets:    ${health.sequenceResets ?? 0}
  Discontinuities:    ${health.discontinuityCount ?? 0}
  Total Errors:       ${health.totalErrors ?? 0}

🎬 VIDEO STREAM
─────────────────────────────────────────────────────────────────────
  Codec:          ${stats.video?.codec || 'N/A'}
  Profile:        ${stats.video?.profile || 'N/A'}
  Level:          ${stats.video?.level || 'N/A'}
  Resolution:     ${stats.resolution || 'N/A'}
  FPS:            ${stats.fps?.toFixed(2) || 'N/A'}
  Pixel Format:   ${stats.video?.pixFmt || 'N/A'}
  Color Space:    ${stats.video?.colorSpace || 'N/A'}
  Video Bitrate:  ${stats.video?.bitRate ? (stats.video.bitRate / 1000).toFixed(0) + ' kbps' : 'N/A'}

🔊 AUDIO STREAM
─────────────────────────────────────────────────────────────────────
  Codec:          ${stats.audio?.codec || 'N/A'}
  Channels:       ${stats.audio?.channels || 'N/A'}
  Sample Rate:    ${stats.audio?.sampleRate ? stats.audio.sampleRate + ' Hz' : 'N/A'}
  Audio Bitrate:  ${stats.audio?.bitRate ? (stats.audio.bitRate / 1000).toFixed(0) + ' kbps' : 'N/A'}

📦 CONTAINER INFO
─────────────────────────────────────────────────────────────────────
  Format:         ${stats.container?.formatName || 'N/A'}
  Duration:       ${stats.container?.duration ? stats.container.duration.toFixed(2) + 's' : 'N/A'}
  Size:           ${stats.container?.size ? (stats.container.size / 1024).toFixed(1) + ' KB' : 'N/A'}
  Total Bitrate:  ${stats.container?.bitRate ? (stats.container.bitRate / 1000).toFixed(0) + ' kbps' : 'N/A'}
  Bandwidth:      ${stats.bandwidth ? (stats.bandwidth / 1000000).toFixed(2) + ' Mbps' : 'N/A'}

📅 TIMESTAMPS
─────────────────────────────────────────────────────────────────────
  Created:        ${stream.createdAt ? new Date(stream.createdAt).toLocaleString() : 'N/A'}
  Last Updated:   ${stream.updatedAt ? new Date(stream.updatedAt).toLocaleString() : 'N/A'}
  Last Checked:   ${stream.lastChecked ? new Date(stream.lastChecked).toLocaleString() : 'N/A'}

`;

        // Add errors section if any
        if (errors.length > 0) {
            log += `⚠️  ERROR LOG (${errors.length} errors)
─────────────────────────────────────────────────────────────────────
`;
            errors.forEach((err, i) => {
                log += `
  [${i + 1}] ${err.errorType || 'Unknown Error'}
      Time:    ${err.date ? new Date(err.date).toLocaleString() : 'N/A'}
      Details: ${err.details || 'No details'}
      Type:    ${err.mediaType || 'N/A'}
`;
            });
        } else {
            log += `✅ NO ERRORS RECORDED
─────────────────────────────────────────────────────────────────────
  This stream has no recorded errors.
`;
        }

        log += `
═════════════════════════════════════════════════════════════════════
                    Generated by HLS Monitor
═════════════════════════════════════════════════════════════════════
`;

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${stream.name.replace(/[^a-z0-9]/gi, '_')}_log_${new Date().toISOString().split('T')[0]}.txt"`);
        res.send(log);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===== METRICS HISTORY ROUTES =====
const MetricsHistory = require('./models/MetricsHistory');

// Get metrics history for a stream (for graphs) - returns ALL data from start
app.get('/api/streams/:id/metrics', async (req, res) => {
    try {
        const metrics = await MetricsHistory.find({ streamId: req.params.id })
            .sort({ timestamp: 1 });  // No limit - get all historical data
        res.json(metrics);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===== AUDIT LOG ROUTES =====

// Get all audit logs
app.get('/api/audit-logs', async (req, res) => {
    try {
        const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(100);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get audit logs by action type
app.get('/api/audit-logs/:action', async (req, res) => {
    try {
        const logs = await AuditLog.find({ action: req.params.action.toUpperCase() })
            .sort({ timestamp: -1 })
            .limit(50);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Socket.io
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Start Workers
require('./workers/monitor')(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
