# HLS Monitor Pro

A professional real-time HLS (HTTP Live Streaming) monitor with detailed analytics, live signal visualization, and comprehensive stream health tracking.

![HLS Monitor](https://img.shields.io/badge/HLS-Monitor-purple)
![Node.js](https://img.shields.io/badge/Node.js-v18+-green)
![React](https://img.shields.io/badge/React-18-blue)
![MongoDB](https://img.shields.io/badge/MongoDB-Required-green)

## Features

- 🎬 **Real-time HLS Stream Monitoring** - Check stream health every 7 seconds
- 📊 **Live Signal Visualization** - VU meters and scrollable historical graphs
- 🖼️ **Live Sprite Generation** - Auto-updating thumbnails from stream I-frames
- 📈 **Health Score Tracking** - 0-100 score based on staleness, errors, sequence jumps
- 📥 **Downloadable Logs** - Human-readable daily log files
- 🔍 **Detailed Stream Stats** - Video, audio, container analysis via FFprobe
- 📝 **Audit Logging** - Track all user operations (add, delete, download)

## Tech Stack

- **Backend**: Node.js, Express, MongoDB, Socket.io
- **Frontend**: React, Vite, Tailwind CSS, Recharts
- **Analysis**: FFmpeg, FFprobe

## Prerequisites

- Node.js v18+
- MongoDB running on localhost:27017
- FFmpeg installed and in PATH

## Installation

```bash
# Clone the repository
git clone https://github.com/Suraj-B12/HLS_Monitor.git
cd HLS_Monitor

# Install backend dependencies
cd saas-app/backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

## Running the Application

### Terminal 1 - Backend
```bash
cd saas-app/backend
node server.js
```

### Terminal 2 - Frontend
```bash
cd saas-app/frontend
npm run dev
```

Open http://localhost:5173 in your browser.

## Seeding Test Streams

```bash
cd saas-app/backend
node seed.js
```

This adds 3 test streams: Tastemade, Gusto ESP, and AccuWeather.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/streams` | GET | List all streams |
| `/api/streams` | POST | Add a new stream |
| `/api/streams/:id` | GET | Get single stream |
| `/api/streams/:id` | DELETE | Remove a stream |
| `/api/streams/:id/log` | GET | Download stream log |
| `/api/streams/:id/metrics` | GET | Get metrics history |
| `/api/audit-logs` | GET | View audit logs |

## Screenshots

Click any stream tile to see detailed analytics with:
- Live signal strength meters
- Scrollable historical graphs
- Video/Audio/Container stats
- Error log

## License

MIT
