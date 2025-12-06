const mongoose = require('mongoose');

// CONFIGURATION
const LOCAL_URI = 'mongodb://localhost:27017/hls-monitor';
const REMOTE_URI = 'mongodb+srv://surajbcd23_db_user:BNM1234@hlsmonitor.rs0iizl.mongodb.net/hls-monitor?appName=HLSmonitor';

// Models
const Stream = require('./models/Stream');
const Visitor = require('./models/Visitor');
const AuditLog = require('./models/AuditLog');
const MetricsHistory = require('./models/MetricsHistory');

async function migrate() {
    console.log('🚀 Starting Migration to hls-monitor DB...');

    // 1. Connect to Local DB
    console.log('Connecting to Local DB...');
    const localConn = await mongoose.createConnection(LOCAL_URI).asPromise();
    console.log('✅ Local Connected');

    // 2. Connect to Remote DB
    console.log('Connecting to Remote DB (Atlas)...');
    const remoteConn = await mongoose.createConnection(REMOTE_URI).asPromise();
    console.log('✅ Remote Connected');

    // Helper to Copy Collection
    const copyCollection = async (modelName, schema) => {
        console.log(`\n📦 Migrating ${modelName}...`);

        // Read from Local
        const LocalModel = localConn.model(modelName, schema);
        const docs = await LocalModel.find({});
        console.log(`   Found ${docs.length} documents locally.`);

        if (docs.length === 0) return;

        // Write to Remote
        const RemoteModel = remoteConn.model(modelName, schema);

        // Clear remote collection to prevent duplicates on re-run
        const remoteCount = await RemoteModel.countDocuments();
        if (remoteCount > 0) {
            console.log(`   ⚠️ Remote collection has ${remoteCount} docs. Clearing...`);
            await RemoteModel.deleteMany({});
        }

        if (docs.length > 0) {
            // Batch insert for performance and safety
            await RemoteModel.insertMany(docs);
            console.log(`   ✅ Successfully copied ${docs.length} documents to Atlas.`);
        }
    };

    try {
        await copyCollection('Stream', Stream.schema);
        await copyCollection('Visitor', Visitor.schema);
        await copyCollection('AuditLog', AuditLog.schema);
        // Metrics might be huge, but user wants "entire" database.
        await copyCollection('MetricsHistory', MetricsHistory.schema);

        console.log('\n✨ MIGRATION COMPLETE! ✨');

    } catch (err) {
        console.error('Migration Failed:', err);
    } finally {
        await localConn.close();
        await remoteConn.close();
        process.exit(0);
    }
}

migrate();
