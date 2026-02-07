# HLS Monitoring Dashboard  
Production-Grade Real-Time Stream Observability Platform  

---

## Overview

The HLS Monitoring Dashboard is a real-time stream observability system designed to monitor, analyze, and visualize HLS streams at scale.

It performs deep playlist validation, segment analysis, audio level detection, thumbnail generation, sliding-window health scoring, and stores time-series metrics for historical graphing.

This project was built as a production-ready solution with:

- 7 second polling architecture
- Real-time socket updates
- Sliding window error scoring with decay logic
- FFprobe deep media inspection
- Concurrency-controlled FFmpeg processing
- MongoDB TTL-based auto cleanup
- Audit logging and visitor tracking
- Secure API with validation and rate limiting

---

## Live Demo

https://hls-monitor.onrender.com/

---

## Architecture

### Backend
- Node.js
- Express 5
- MongoDB with Mongoose
- Socket.io
- FFmpeg / FFprobe
- m3u8-parser
- GeoIP + UA Parser

### Frontend
- React 18
- Vite
- Tailwind CSS
- Recharts
- Socket.io client

---

## System Design

### 1. Monitoring Engine

Located in:

```
backend/workers/monitor.js
```

Runs every **7 seconds**.

Each cycle:
1. Fetch master manifest
2. Resolve variant playlist
3. Validate media sequence progression
4. Detect sequence jumps and resets
5. Detect stale manifests
6. Track discontinuities
7. Trigger deep segment processing
8. Emit live socket updates
9. Store time-series metrics

Monitoring is non-blocking and self-scheduled.  
It waits for the current cycle to finish before scheduling the next.

---

### 2. Health Scoring Engine

Health score is calculated between 0 and 100.

It uses:

- Immediate penalties (offline, error, stale)
- Sliding window metrics (last ~12 minutes)
- Sequence jumps and resets
- Total error count
- Error decay forgiveness over time

Decay logic progressively reduces penalties as time passes since the last error.

This avoids permanently punishing a stream for old issues.

---

### 3. Deep Media Analysis (FFprobe)

Located in:

```
backend/workers/processor.js
```

Each new segment triggers:

- Container analysis
- Video codec inspection
- FPS extraction
- Bitrate calculation
- Audio channel layout detection
- Peak and average dB detection
- Silence detection
- Thumbnail generation
- Live signal visualization updates

Concurrency is limited to 4 parallel FFmpeg processes to prevent memory spikes.

---

### 4. Metrics History

Stored in:

```
MetricsHistory
```

Features:

- Health score history
- Video and audio signal levels
- FPS tracking
- Media sequence tracking
- Segment counts
- Error count history
- 7 day TTL auto deletion

Used for rendering historical charts.

---

### 5. Security Features

- Helmet for secure HTTP headers
- Rate limiting on all API routes
- Stricter limit on stream creation
- Input validation using express-validator
- ObjectId validation middleware
- Secure delete confirmation phrase
- Request size limiting
- Safe GeoIP lookup
- Safe UA parsing
- Graceful handling of unhandled promise rejections

---

### 6. Audit Logging

All major actions are logged:

- STREAM_ADDED
- STREAM_DELETED
- LOG_DOWNLOADED

Logs auto expire after 7 days using MongoDB TTL indexes.

---

### 7. Visitor Tracking

Tracks:

- IP address
- Geolocation
- Browser
- OS
- Device type
- Screen resolution
- Visit count
- Referrer metadata

Visitor data is upserted safely and does not block user experience if tracking fails.

---

## API Overview

### Streams

GET `/api/streams`  
POST `/api/streams`  
GET `/api/streams/:id`  
DELETE `/api/streams/:id`  

### Errors

GET `/api/streams/:id/errors`  
GET `/api/streams/:id/log`  
GET `/api/streams/:id/logs/dates`

### Metrics

GET `/api/streams/:id/metrics`

### Audit Logs

GET `/api/audit-logs`  
GET `/api/audit-logs/:action`

### Visitors

POST `/api/visitors`

---

## Real-Time Events (Socket.io)

- `stream:update`
- `stream:signal`
- `stream:sprite`
- `stream:added`
- `stream:deleted`

---

## Folder Structure

```
backend/
  models/
  workers/
  server.js

frontend/
  src/
    components/
    utils/
```

---

## Running Locally

### 1. Clone Repository

```
git clone <repo-url>
cd hls-monitoring-dashboard
```

---

### 2. Setup Backend

```
cd backend
npm install
```

Create `.env` file:

```
MONGO_URI=your_mongodb_connection_string
PORT=5000
```

Start server:

```
npm run dev
```

---

### 3. Setup Frontend

```
cd frontend
npm install
npm run dev
```

---

## Docker Deployment

Dockerfile builds frontend and backend in multi-stage mode.

To build:

```
docker build -t hls-monitor .
docker run -p 5000:5000 hls-monitor
```

Make sure to pass `MONGO_URI` as an environment variable.

---

## Production Considerations

- Designed to run on Render, Railway, or similar Node hosting.
- FFmpeg required in production container.
- MongoDB TTL handles cleanup automatically.
- Monitoring is memory safe due to concurrency limiting.
- Sliding window logic avoids exponential penalty growth.
- Defensive coding prevents worker crashes.

---

## What Makes This Production Ready

- Concurrency-limited FFmpeg processing
- Sliding window health scoring
- Error decay forgiveness
- Rate limiting and validation
- TTL based automatic cleanup
- Safe error handling
- No blocking monitoring loop
- Real-time architecture
- Secure deletion flow

---

## Future Improvements

- Authentication and role-based access
- Multi-variant monitoring
- Alerting via Slack or email
- Prometheus export
- Horizontal scaling with worker isolation
- Redis queue for segment processing

---

## License

MIT
