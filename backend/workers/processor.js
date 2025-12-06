const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

async function processSegment(stream, segmentUrl, io) {
    // 1. Deep Analysis with FFprobe
    ffmpeg.ffprobe(segmentUrl, (err, metadata) => {
        if (err) {
            console.error(`[PROBE] ${stream.name}: ${err.message}`);
            return;
        }

        try {
            // Container stats
            let videoBitrate = 0;
            let audioBitrate = 0;

            if (metadata.format) {
                stream.stats.container = {
                    formatName: metadata.format.format_name,
                    duration: parseFloat(metadata.format.duration) || 0,
                    size: parseInt(metadata.format.size) || 0,
                    bitRate: parseInt(metadata.format.bit_rate) || 0
                };
            }

            // Video stream
            const video = metadata.streams.find(s => s.codec_type === 'video');
            if (video) {
                stream.stats.resolution = `${video.width}x${video.height}`;
                stream.stats.fps = video.r_frame_rate ? eval(video.r_frame_rate) : 0;
                videoBitrate = parseInt(video.bit_rate) || (metadata.format?.bit_rate * 0.85) || 0;

                stream.stats.video = {
                    codec: video.codec_name,
                    profile: video.profile,
                    level: video.level?.toString(),
                    width: video.width,
                    height: video.height,
                    pixFmt: video.pix_fmt,
                    colorSpace: video.color_space || video.color_primaries || 'unknown',
                    bitRate: videoBitrate
                };
            }

            // Audio stream
            const audio = metadata.streams.find(s => s.codec_type === 'audio');
            if (audio) {
                audioBitrate = parseInt(audio.bit_rate) || 128000;
                stream.stats.audio = {
                    codec: audio.codec_name,
                    channels: audio.channels,
                    sampleRate: parseInt(audio.sample_rate) || 0,
                    bitRate: audioBitrate
                };
            }

            // Emit LIVE signal levels for waveform display
            // Normalize bitrates to 0-100 scale for visualization
            const videoLevel = Math.min(100, Math.max(0, (videoBitrate / 5000000) * 100)); // Assuming 5Mbps as max
            const audioLevel = Math.min(100, Math.max(0, (audioBitrate / 320000) * 100)); // Assuming 320kbps as max

            // Add some natural variation to simulate live signal
            const variation = (Math.random() - 0.5) * 10;

            io.emit('stream:signal', {
                id: stream._id,
                timestamp: Date.now(),
                video: Math.max(0, Math.min(100, videoLevel + variation)),
                audio: Math.max(0, Math.min(100, audioLevel + variation)),
                videoBitrate: videoBitrate,
                audioBitrate: audioBitrate,
                fps: stream.stats.fps || 0
            });

            // Emit stats update
            stream.save().then(() => {
                io.emit('stream:update', stream);
            });

        } catch (parseErr) {
            console.error(`[PROBE PARSE] ${stream.name}: ${parseErr.message}`);
        }
    });

    // 2. Generate Sprite (thumbnail) - Store as base64 in DB
    const os = require('os');
    const tempFile = path.join(os.tmpdir(), `sprite-${stream._id}-${Date.now()}.jpg`);

    ffmpeg(segmentUrl)
        .inputOptions(['-ss', '0.5'])
        .outputOptions([
            '-vframes', '1',
            '-vf', 'scale=320:-1',  // Smaller size for DB storage
            '-q:v', '5'             // Lower quality to reduce size
        ])
        .on('end', () => {
            try {
                // Read file as base64
                const imageBuffer = fs.readFileSync(tempFile);
                const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

                // Store in database
                stream.thumbnail = base64Image;
                stream.save().then(() => {
                    io.emit('stream:sprite', { id: stream._id, url: base64Image });
                });

                // Clean up temp file
                fs.unlinkSync(tempFile);

                console.log(`[SPRITE] ${stream.name}: Stored in DB`);
            } catch (readErr) {
                console.error(`[SPRITE] ${stream.name}: Read error - ${readErr.message}`);
            }
        })
        .on('error', (err) => {
            console.error(`[SPRITE] ${stream.name}: ${err.message}`);
        })
        .save(tempFile);
}

module.exports = { processSegment };
