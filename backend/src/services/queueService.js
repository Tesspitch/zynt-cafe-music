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
        finishedAt: null
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
        } else if (newStatus === QUEUE_STATUS.PLAYED || newStatus === QUEUE_STATUS.SKIPPED) {
            item.finishedAt = new Date().toISOString();
        }
    }
    return item;
};

export const getNextWaiting = () => {
    return queue.find(q => q.status === QUEUE_STATUS.WAITING);
};

export const clearQueue = () => {
    queue.length = 0;
};
