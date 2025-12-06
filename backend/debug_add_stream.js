const mongoose = require('mongoose');
const Stream = require('./models/Stream');

async function testAddStream() {
    try {
        await mongoose.connect('mongodb://localhost:27017/hls-monitor');
        console.log('Connected to MongoDB');

        const testStream = {
            name: "Test Stream " + Date.now(),
            url: "https://test.com/playlist.m3u8"
        };

        const stream = new Stream(testStream);
        await stream.save();
        console.log('Stream saved successfully:', stream);

    } catch (err) {
        console.error('Error saving stream:', err);
    } finally {
        await mongoose.disconnect();
    }
}

testAddStream();
