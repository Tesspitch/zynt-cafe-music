import * as queueService from '../services/queueService.js';
import * as youtubeService from '../services/youtubeService.js';
import { getIo } from '../socket.js';
import { config } from '../config/env.js';
import { QUEUE_STATUS } from '../models/queueModel.js';

export const getQueue = (req, res) => {
    res.json(queueService.getQueue());
};

export const getMyQueue = (req, res) => {
    res.json(queueService.getQueueForUser(req.session.userName));
};

export const addQueue = async (req, res) => {
    const { videoId, url } = req.body;
    const userName = req.session.userName;
    
    // Cooldown check
    const now = Date.now();
    const lastReq = req.session.lastRequestTime || 0;
    if (now - lastReq < config.requestCooldownSeconds * 1000) {
        return res.status(429).json({ error: 'REQUEST_COOLDOWN' });
    }
    
    // Limit check
    if (!queueService.canUserRequest(userName)) {
        return res.status(403).json({ error: 'REQUEST_LIMIT_REACHED' });
    }

    let finalVideoId = videoId;
    if (url) {
        finalVideoId = youtubeService.extractVideoIdFromUrl(url);
        if (!finalVideoId) {
            return res.status(400).json({ error: 'INVALID_YOUTUBE_URL' });
        }
    }

    if (!finalVideoId) {
        return res.status(400).json({ error: 'YOUTUBE_VIDEO_NOT_FOUND' });
    }

    // Duplicate check
    if (queueService.isDuplicate(finalVideoId)) {
        return res.status(409).json({ error: 'SONG_ALREADY_IN_QUEUE' });
    }

    try {
        const songDetails = await youtubeService.getVideoDetails(finalVideoId);
        if (!songDetails) {
            return res.status(404).json({ error: 'YOUTUBE_VIDEO_NOT_FOUND' });
        }

        const newItem = queueService.addSongToQueue(songDetails, userName);
        req.session.lastRequestTime = Date.now();

        // Check if anything is currently playing or waiting before this one
        const currentQueue = queueService.getQueue();
        const hasActiveSongs = currentQueue.some(q => 
            (q.status === QUEUE_STATUS.PLAYING || q.status === QUEUE_STATUS.WAITING) && q.id !== newItem.id
        );
        
        if (!hasActiveSongs) {
            queueService.changeStatus(newItem.id, QUEUE_STATUS.PLAYING);
        }

        // Broadcast event
        const io = getIo();
        if (io) {
            io.emit('QUEUE_UPDATE', queueService.getQueue());
            io.emit('SONG_ADDED', newItem);
            if (!hasActiveSongs) {
                io.emit('SONG_STARTED', queueService.getQueue().find(q => q.id === newItem.id));
            }
        }

        res.json(newItem);
    } catch (error) {
        res.status(500).json({ error: 'YOUTUBE_ERROR', message: error.message });
    }
};

export const deleteQueue = (req, res) => {
    const { id } = req.params;
    const userName = req.session.userName;
    
    // Only allow removing own WAITING songs
    const queue = queueService.getQueue();
    const item = queue.find(q => q.id === id);
    
    if (!item) {
        return res.status(404).json({ error: 'NOT_FOUND' });
    }
    
    if (item.requestedBy !== userName) {
        return res.status(403).json({ error: 'UNAUTHORIZED' });
    }

    if (item.status !== QUEUE_STATUS.WAITING) {
        return res.status(400).json({ error: 'CANNOT_REMOVE_PLAYING_SONG' });
    }

    queueService.changeStatus(id, QUEUE_STATUS.REMOVED);
    
    const io = getIo();
    if (io) {
        io.emit('QUEUE_UPDATE', queueService.getQueue());
        io.emit('SONG_REMOVED', item);
    }
    
    res.json({ success: true });
};
