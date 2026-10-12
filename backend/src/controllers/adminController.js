import * as queueService from '../services/queueService.js';
import { getIo } from '../socket.js';
import { QUEUE_STATUS } from '../models/queueModel.js';

export const playNext = (req, res) => {
    // Stop current playing song if any
    const queue = queueService.getQueue();
    const currentPlaying = queue.find(q => q.status === QUEUE_STATUS.PLAYING);
    if (currentPlaying) {
        queueService.changeStatus(currentPlaying.id, QUEUE_STATUS.PLAYED);
        getIo()?.emit('SONG_PLAYED', currentPlaying);
    }

    const nextItem = queueService.getNextWaiting();
    if (nextItem) {
        queueService.changeStatus(nextItem.id, QUEUE_STATUS.PLAYING);
        getIo()?.emit('QUEUE_UPDATE', queueService.getQueue());
        getIo()?.emit('SONG_STARTED', nextItem);
        return res.json(nextItem);
    }
    
    getIo()?.emit('QUEUE_UPDATE', queueService.getQueue());
    res.json({ message: 'QUEUE_EMPTY' });
};

export const skipSong = (req, res) => {
    const { id } = req.params;
    const item = queueService.changeStatus(id, QUEUE_STATUS.SKIPPED);
    if (item) {
        getIo()?.emit('SONG_SKIPPED', item);
        getIo()?.emit('QUEUE_UPDATE', queueService.getQueue());
        return res.json(item);
    }
    res.status(404).json({ error: 'NOT_FOUND' });
};

export const removeSong = (req, res) => {
    const { id } = req.params;
    const item = queueService.changeStatus(id, QUEUE_STATUS.REMOVED);
    if (item) {
        getIo()?.emit('SONG_REMOVED', item);
        getIo()?.emit('QUEUE_UPDATE', queueService.getQueue());
        return res.json(item);
    }
    res.status(404).json({ error: 'NOT_FOUND' });
};

export const clearQueue = (req, res) => {
    queueService.clearQueue();
    const io = getIo();
    if (io) {
        io.emit('QUEUE_UPDATE', queueService.getQueue());
        io.emit('QUEUE_CLEARED');
    }
    res.json({ message: 'Queue cleared' });
};

export const forcePlay = (req, res) => {
    const { id } = req.params;
    const queue = queueService.getQueue();
    
    // Stop current playing song if any
    const currentPlaying = queue.find(q => q.status === QUEUE_STATUS.PLAYING);
    if (currentPlaying) {
        queueService.changeStatus(currentPlaying.id, QUEUE_STATUS.PLAYED);
        getIo()?.emit('SONG_PLAYED', currentPlaying);
    }
    
    // Play selected song
    const songToPlay = queue.find(q => q.id === id);
    if (!songToPlay) {
        return res.status(404).json({ error: 'Song not found' });
    }
    
    const updatedSong = queueService.changeStatus(id, QUEUE_STATUS.PLAYING);
    
    const io = getIo();
    if (io) {
        io.emit('QUEUE_UPDATE', queueService.getQueue());
        io.emit('SONG_STARTED', updatedSong);
    }
    
    res.json(updatedSong);
};
