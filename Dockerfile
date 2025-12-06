# Stage 1: Build the Frontend
FROM node:18-alpine as frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Setup Backend with FFmpeg
FROM node:18-alpine
WORKDIR /app/backend

# Install FFmpeg (Critical for HLS Monitor)
RUN apk add --no-cache ffmpeg

# Install Backend Dependencies
COPY backend/package*.json ./
RUN npm install --production

# Copy Backend Source
COPY backend/ ./

# Copy Built Frontend from Stage 1
COPY --from=frontend-build /app/frontend/dist ../frontend/dist

# Expose Port
ENV PORT=5000
EXPOSE 5000

# Start Server
CMD ["node", "server.js"]
