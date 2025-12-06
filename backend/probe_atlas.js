const mongoose = require('mongoose');

// The URI we are using in server.js
const MONGO_URI = 'mongodb+srv://surajbcd23_db_user:BNM1234@hlsmonitor.rs0iizl.mongodb.net/hls-monitor?appName=HLSmonitor';

const Stream = require('./models/Stream');

async function probe() {
    try {
        console.log('🔌 Connecting to Atlas...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected.');

        const streamCount = await Stream.countDocuments();
        console.log(`📊 Streams found in 'hls-monitor' DB: ${streamCount}`);

        if (streamCount === 0) {
            console.warn('⚠️ No streams found! Data might be missing or in a different DB.');
        } else {
            console.log('✅ Data is present.');
        }

    } catch (err) {
        console.error('❌ Connection Failed:', err.message);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

probe();
