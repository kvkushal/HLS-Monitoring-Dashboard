const mongoose = require('mongoose');
const Stream = require('./models/Stream');

mongoose.connect('mongodb://localhost:27017/hls-monitor')
    .then(async () => {
        console.log('MongoDB Connected');

        const testStreams = [
            { name: "Tastemade", url: "https://d2phskw6lgig3f.cloudfront.net/tastemade-triplelift/playlist.m3u8" },
            { name: "Gusto ESP", url: "https://d22d00x1qrobn5.cloudfront.net/gusto-esp-vtt/playlist.m3u8" },
            { name: "AccuWeather", url: "Https://d16c99krxqt3zb.cloudfront.net/AccuWeather-Xumo/playlist.m3u8" }
        ];

        for (const s of testStreams) {
            try {
                // Check if exists
                const exists = await Stream.findOne({ url: s.url });
                if (!exists) {
                    await Stream.create(s);
                    console.log(`Added ${s.name}`);
                } else {
                    console.log(`Skipped ${s.name} (exists)`);
                }
            } catch (e) {
                console.error(`Error adding ${s.name}:`, e.message);
            }
        }

        console.log('Seeding done');
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
