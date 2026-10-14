import { queue, QUEUE_STATUS } from '../models/queueModel.js';
import { config } from '../config/env.js';

export const getQueue = () => {
    return queue;
};

export const getQueueForUser = (userName) => {
    return queue.filter(item => item.requestedBy === userName);
};

export const canUserRequest = (userName) => {
    const activeRequests = queue.filter(
        item => item.requestedBy === userName && 
        (item.status === QUEUE_STATUS.WAITING || item.status === QUEUE_STATUS.PLAYING)
    );
    return activeRequests.length < config.maxActiveRequestsPerUser;
};

export const isDuplicate = (videoId) => {
    return queue.some(
        item => item.youtubeVideoId === videoId && 
        (item.status === QUEUE_STATUS.WAITING || item.status === QUEUE_STATUS.PLAYING)
    );
};

export const getActiveCount = (userName) => {
    return queue.filter(
        item => item.requestedBy === userName && 
        (item.status === QUEUE_STATUS.WAITING || item.status === QUEUE_STATUS.PLAYING)
    ).length;
};

export const addSongToQueue = (song, userName) => {
    const newItem = {
        id: Date.now().toString(),
        youtubeVideoId: song.videoId,
        title: song.title,
        thumbnailUrl: song.thumbnailUrl,
        channelName: song.channelName,
        duration: song.duration,
        requestedBy: userName,
        status: QUEUE_STATUS.WAITING,
        requestedAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
        isPaused: false,
        pausedAt: null,
        totalPausedMs: 0
    };
    
    queue.push(newItem);
    return newItem;
};

export const changeStatus = (id, newStatus) => {
    const item = queue.find(q => q.id === id);
    if (item) {
        item.status = newStatus;
        if (newStatus === QUEUE_STATUS.PLAYING) {
            item.startedAt = new Date().toISOString();
            item.isPaused = false;
            item.pausedAt = null;
            item.totalPausedMs = 0;
        } else if (newStatus === QUEUE_STATUS.PLAYED || newStatus === QUEUE_STATUS.SKIPPED) {
            item.finishedAt = new Date().toISOString();
            item.isPaused = false;
            item.pausedAt = null;
        }
    }
    return item;
};

export const pausePlayback = (id) => {
    const item = queue.find(q => q.id === id && q.status === QUEUE_STATUS.PLAYING);
    if (!item || item.isPaused) return item;
    item.isPaused = true;
    item.pausedAt = new Date().toISOString();
    return item;
};

export const resumePlayback = (id) => {
    const item = queue.find(q => q.id === id && q.status === QUEUE_STATUS.PLAYING);
    if (!item || !item.isPaused) return item;
    const pausedAtMs = new Date(item.pausedAt).getTime();
    if (Number.isFinite(pausedAtMs)) {
        item.totalPausedMs = (item.totalPausedMs || 0) + Math.max(0, Date.now() - pausedAtMs);
    }
    item.isPaused = false;
    item.pausedAt = null;
    return item;
};

export const getNextWaiting = () => {
    return queue.find(q => q.status === QUEUE_STATUS.WAITING);
};

export const clearQueue = () => {
    queue.length = 0;
};
