import { io } from 'socket.io-client';

const API_URL = import.meta.env.PROD 
    ? '' 
    : `http://${window.location.hostname}:8080`;

let socket = null;

export const initSocket = (onQueueUpdate, onOnlineUsersUpdate, onChatHistory, onNewChatMessage, userName = null, onSkipVoteUpdate = null) => {
    if (!socket) {
        socket = io(API_URL, {
            withCredentials: true
        });

        socket.on('QUEUE_UPDATE', (queue) => {
            if (onQueueUpdate) onQueueUpdate(queue);
        });

        socket.on('ONLINE_USERS', (users) => {
            if (onOnlineUsersUpdate) onOnlineUsersUpdate(users);
        });
        
        socket.on('CHAT_HISTORY', (history) => {
            if (onChatHistory) onChatHistory(history);
        });

        socket.on('NEW_CHAT_MESSAGE', (msg) => {
            if (onNewChatMessage) onNewChatMessage(msg);
        });

        socket.on('SKIP_VOTE_UPDATE', (progress) => {
            if (onSkipVoteUpdate) onSkipVoteUpdate(progress);
        });

        socket.on('SONG_ADDED', (song) => console.log('Song added:', song));
        socket.on('SONG_STARTED', (song) => console.log('Song started:', song));
        socket.on('SONG_PLAYED', (song) => console.log('Song finished:', song));
        socket.on('SONG_SKIPPED', (song) => console.log('Song skipped:', song));
        socket.on('SONG_REMOVED', (song) => console.log('Song removed:', song));
        socket.on('QUEUE_CLEARED', () => console.log('Queue cleared'));
    }
    
    // Always register user if provided (even if reconnecting or re-initializing)
    if (userName) {
        socket.emit('REGISTER_USER', userName);
    }
    
    return socket;
};

export const getSocket = () => socket;

export const sendChatMessage = (text, nowPlaying) => {
    if (socket) {
        socket.emit('SEND_CHAT', { text, nowPlaying });
    }
};

export const voteToSkip = (songId, callback) => {
    if (!socket) {
        callback?.({ ok: false, error: 'SOCKET_NOT_CONNECTED' });
        return;
    }
    socket.emit('VOTE_SKIP', { songId }, callback);
};
