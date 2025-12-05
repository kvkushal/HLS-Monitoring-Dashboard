const axios = require('axios');
const m3u8Parser = require('m3u8-parser');
const Stream = require('../models/Stream');
const MetricsHistory = require('../models/MetricsHistory');
const { ErrorTypes } = require('../models/Stream');
const { processSegment } = require('./processor');
const { v4: uuidv4 } = require('uuid');

const MONITOR_INTERVAL = 7000; // 7 seconds as requested

// Calculate health score (0-100)
function calculateHealthScore(stream) {
    let score = 100;
    const health = stream.health || {};
    if (health.isStale) score -= 30;
    if (health.sequenceJumps > 0) score -= Math.min(health.sequenceJumps * 5, 20);
    if (health.sequenceResets > 0) score -= Math.min(health.sequenceResets * 10, 30);
    if (health.totalErrors > 0) score -= Math.min(health.totalErrors * 2, 20);
    if (stream.status === 'error') score -= 40;
    if (stream.status === 'offline') score -= 50;
    return Math.max(0, Math.min(100, score));
}

// Calculate video/audio scores based on stream quality
function calculateVideoScore(stream) {
    let score = 100;
    const video = stream.stats?.video;
    if (!video) return 50;
    if (!video.codec) score -= 20;
    if (video.width && video.width < 720) score -= 10;
    if (video.width && video.width >= 1920) score += 0;
    return Math.max(0, Math.min(100, score));
}

function calculateAudioScore(stream) {
    let score = 100;
    const audio = stream.stats?.audio;
    if (!audio) return 50;
    if (!audio.codec) score -= 20;
    if (audio.sampleRate && audio.sampleRate < 44100) score -= 10;
    return Math.max(0, Math.min(100, score));
}
const streamState = new Map();

function generateErrorId() {
    return `eid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function addError(stream, errorType, details, mediaType = 'VIDEO', code = null) {
    const error = {
        eid: generateErrorId(),
        date: new Date(),
        errorType,
        mediaType,
        variant: stream.stats?.bandwidth?.toString() || 'unknown',
        details,
        code
    };

    if (!stream.streamErrors) stream.streamErrors = [];
    stream.streamErrors.push(error);
    stream.health.totalErrors++;
    stream.health.timeSinceLastError = 0;

    console.log(`[ERROR] ${stream.name}: ${errorType} - ${details}`);
}

async function fetchManifest(url) {
    const response = await axios.get(url, { timeout: 10000 });
    const parser = new m3u8Parser.Parser();
    parser.push(response.data);
    parser.end();
    return parser.manifest;
}

async function resolveVariantUrl(masterUrl, variantUri) {
    if (variantUri.startsWith('http')) return variantUri;
    const baseUrl = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);
    return baseUrl + variantUri;
}

async function checkStream(stream, io) {
    const now = Date.now();
    const state = streamState.get(stream._id.toString()) || {
        lastPollTime: 0,
        lastMediaSequence: -1,
        consecutiveStales: 0
    };

    try {
        // --- FETCH MANIFEST ---
        let manifest;
        let variantUrl = stream.url;

        try {
            manifest = await fetchManifest(stream.url);
        } catch (err) {
            addError(stream, ErrorTypes.MANIFEST_RETRIEVAL,
                `Failed to fetch manifest: ${err.message}`, 'MASTER', err.response?.status);
            stream.status = 'error';
            await stream.save();
            io.emit('stream:update', stream);
            return;
        }

        // --- HANDLE MASTER PLAYLIST ---
        if (manifest.playlists && manifest.playlists.length > 0) {
            // It's a master, follow first variant
            const variant = manifest.playlists[0];
            variantUrl = await resolveVariantUrl(stream.url, variant.uri);

            // Update bandwidth from master
            if (variant.attributes?.BANDWIDTH) {
                stream.stats.bandwidth = variant.attributes.BANDWIDTH;
            }
            if (variant.attributes?.RESOLUTION) {
                stream.stats.resolution = `${variant.attributes.RESOLUTION.width}x${variant.attributes.RESOLUTION.height}`;
            }

            try {
                manifest = await fetchManifest(variantUrl);
            } catch (err) {
                addError(stream, ErrorTypes.MANIFEST_RETRIEVAL,
                    `Failed to fetch variant: ${err.message}`, 'VIDEO', err.response?.status);
                stream.status = 'error';
                await stream.save();
                io.emit('stream:update', stream);
                return;
            }
        }

        // --- ANALYZE MEDIA PLAYLIST ---
        if (!manifest.segments || manifest.segments.length === 0) {
            addError(stream, ErrorTypes.PLAYLIST_CONTENT, 'Playlist has no segments');
            stream.status = 'error';
            await stream.save();
            io.emit('stream:update', stream);
            return;
        }

        const currentSequence = manifest.mediaSequence || 0;
        const segmentCount = manifest.segments.length;
        const targetDuration = manifest.targetDuration || 0;

        // --- STALENESS CHECK ---
        if (currentSequence === state.lastMediaSequence) {
            state.consecutiveStales++;
            stream.health.timeSinceLastUpdate = now - state.lastPollTime;

            if (stream.health.timeSinceLastUpdate > stream.health.staleThreshold) {
                stream.health.isStale = true;
                stream.status = 'stale';
                addError(stream, ErrorTypes.STALE_MANIFEST,
                    `Playlist stale for ${stream.health.timeSinceLastUpdate}ms`);
            }
        } else {
            // Playlist updated
            stream.health.isStale = false;
            stream.health.lastManifestUpdate = new Date();
            stream.health.timeSinceLastUpdate = 0;
            state.consecutiveStales = 0;
            stream.status = 'online';
        }

        // --- SEQUENCE CHECKS ---
        if (state.lastMediaSequence !== -1) {
            const expectedSequence = state.lastMediaSequence + 1;

            // Check for sequence jump (gap)
            if (currentSequence > expectedSequence) {
                const gap = currentSequence - expectedSequence;
                stream.health.sequenceJumps++;
                addError(stream, ErrorTypes.MEDIA_SEQUENCE,
                    `Sequence jumped from ${state.lastMediaSequence} to ${currentSequence} (gap: ${gap})`);
            }

            // Check for sequence reset
            if (currentSequence < state.lastMediaSequence) {
                stream.health.sequenceResets++;
                addError(stream, ErrorTypes.MEDIA_SEQUENCE,
                    `Sequence reset from ${state.lastMediaSequence} to ${currentSequence}`);
            }
        }

        // --- DISCONTINUITY CHECK ---
        let currentDiscontinuityCount = 0;
        manifest.segments.forEach(seg => {
            if (seg.discontinuity) currentDiscontinuityCount++;
        });

        if (manifest.discontinuitySequence !== undefined) {
            if (stream.health.discontinuitySequence !== manifest.discontinuitySequence) {
                stream.health.discontinuitySequence = manifest.discontinuitySequence;
            }
        }
        stream.health.discontinuityCount = currentDiscontinuityCount;

        // --- UPDATE HEALTH ---
        stream.health.previousMediaSequence = state.lastMediaSequence;
        stream.health.mediaSequence = currentSequence;
        stream.health.segmentCount = segmentCount;
        stream.health.targetDuration = targetDuration;
        stream.health.playlistType = manifest.playlistType || 'LIVE';

        // Update state
        state.lastMediaSequence = currentSequence;
        state.lastPollTime = now;
        streamState.set(stream._id.toString(), state);

        // --- TRIGGER SPRITE GENERATION ---
        // Always process the latest segment for sprite
        const latestSegment = manifest.segments[manifest.segments.length - 1];
        let segmentUrl = latestSegment.uri;
        if (!segmentUrl.startsWith('http')) {
            const baseUrl = variantUrl.substring(0, variantUrl.lastIndexOf('/') + 1);
            segmentUrl = baseUrl + segmentUrl;
        }

        processSegment(stream, segmentUrl, io);

        // Update timestamp
        stream.lastChecked = new Date();
        await stream.save();

        // Calculate signal levels for graphs
        const videoBitrate = stream.stats?.video?.bitRate || stream.stats?.container?.bitRate * 0.85 || 0;
        const audioBitrate = stream.stats?.audio?.bitRate || 128000;
        const videoLevel = Math.min(100, Math.max(0, (videoBitrate / 5000000) * 100));
        const audioLevel = Math.min(100, Math.max(0, (audioBitrate / 320000) * 100));

        // Record metrics history for graphs (runs in background for ALL streams)
        try {
            await MetricsHistory.create({
                streamId: stream._id,
                healthScore: calculateHealthScore(stream),
                videoScore: calculateVideoScore(stream),
                audioScore: calculateAudioScore(stream),
                videoBitrate: videoBitrate,
                audioBitrate: audioBitrate,
                videoLevel: videoLevel,
                audioLevel: audioLevel,
                fps: stream.stats?.fps || 0,
                status: stream.status,
                mediaSequence: currentSequence,
                segmentCount: segmentCount,
                errorCount: stream.health.totalErrors || 0
            });
        } catch (histErr) {
            console.error(`[METRICS] ${stream.name}: ${histErr.message}`);
        }

        io.emit('stream:update', stream);

        console.log(`[OK] ${stream.name}: seq=${currentSequence}, segments=${segmentCount}`);

    } catch (err) {
        console.error(`[FATAL] ${stream.name}:`, err.message);
        stream.status = 'error';
        addError(stream, ErrorTypes.MANIFEST_RETRIEVAL, err.message);
        await stream.save();
        io.emit('stream:update', stream);
    }
}

async function monitorLoop(io) {
    const streams = await Stream.find();

    for (const stream of streams) {
        await checkStream(stream, io);
    }
}

module.exports = function (io) {
    console.log(`[MONITOR] Starting with ${MONITOR_INTERVAL}ms interval`);

    // Initial run
    setTimeout(() => monitorLoop(io), 1000);

    // Loop every 7 seconds
    setInterval(() => monitorLoop(io), MONITOR_INTERVAL);
};
