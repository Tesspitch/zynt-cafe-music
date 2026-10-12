import express from 'express';
import http from 'http';
import cors from 'cors';
import session from 'express-session';
import { config } from './config/env.js';
import { initSocket } from './socket.js';

import * as sessionController from './controllers/sessionController.js';
import * as youtubeController from './controllers/youtubeController.js';
import * as queueController from './controllers/queueController.js';
import * as adminController from './controllers/adminController.js';

import { authMiddleware } from './middlewares/authMiddleware.js';
import { adminMiddleware } from './middlewares/adminMiddleware.js';

const app = express();
const server = http.createServer(app);

// Init Socket.io
initSocket(server);

// Middlewares
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 1 day memory cookie
}));

// --- Routes ---

// Session API
app.post('/api/session', sessionController.createSession);
app.get('/api/session/me', sessionController.getSession);
app.delete('/api/session', sessionController.deleteSession);

// YouTube API
app.get('/api/youtube/search', authMiddleware, youtubeController.search);
app.get('/api/youtube/video/:videoId', authMiddleware, youtubeController.getVideo);

// Queue API
app.get('/api/queue', queueController.getQueue); // Public view
app.get('/api/queue/me', authMiddleware, queueController.getMyQueue);
app.post('/api/queue', authMiddleware, queueController.addQueue);
app.delete('/api/queue/:id', authMiddleware, queueController.deleteQueue);

// Admin API
app.post('/api/admin/queue/play-next', adminMiddleware, adminController.playNext);
app.post('/api/admin/queue/:id/skip', adminMiddleware, adminController.skipSong);
app.post('/api/admin/queue/:id/play', adminMiddleware, adminController.forcePlay);
app.delete('/api/admin/queue/:id', adminMiddleware, adminController.removeSong);
app.delete('/api/admin/queue', adminMiddleware, adminController.clearQueue);

// Serve Static Frontend (Production Build)
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '../../frontend/dist');

app.use(express.static(distPath));

// Fallback to index.html for SPA (if we had routing) or just root
app.use((req, res, next) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

// Start server
server.listen(config.port, () => {
    console.log(`Cafe Music Queue Backend running on port ${config.port}`);
});
