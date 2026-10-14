import { Server } from 'socket.io';
import * as queueService from './services/queueService.js';

let io;
const onlineUsers = new Map();

const getUniqueOnlineUsers = () => {
    return [...new Set(Array.from(onlineUsers.values()))].filter(Boolean);
};

let chatHistory = [];
const MAX_CHAT_HISTORY = 50;

let skipVotes = new Set();
let currentVoteSongId = null;
let skipTriggeredSongId = null;

const addChatMessage = (message) => {
    chatHistory.push(message);
    if (chatHistory.length > MAX_CHAT_HISTORY) chatHistory.shift();
    io.emit('NEW_CHAT_MESSAGE', message);
};

const getSkipVoteProgress = (songId) => {
    const total = getUniqueOnlineUsers().filter(user => user !== 'Admin').length || 1;
    const votes = skipVotes.size;
    return { songId, votes, total, percentage: Math.min(100, Math.round((votes / total) * 100)) };
};

const handleSkipVote = (socket, requestedSongId, respond = () => {}) => {
    const userName = onlineUsers.get(socket.id);
    const playingSong = queueService.getQueue().find(item => item.status === 'PLAYING');

    if (!userName || userName === 'Admin') {
        return respond({ ok: false, error: 'USER_NOT_ELIGIBLE' });
    }
    if (!playingSong || (requestedSongId && requestedSongId !== playingSong.id)) {
        return respond({ ok: false, error: 'SONG_NOT_PLAYING' });
    }
    if (skipTriggeredSongId === playingSong.id) {
        return respond({ ok: true, passed: true, ...getSkipVoteProgress(playingSong.id) });
    }

    if (currentVoteSongId !== playingSong.id) {
        skipVotes.clear();
        currentVoteSongId = playingSong.id;
        skipTriggeredSongId = null;
        addChatMessage({
            id: Date.now().toString(),
            user: 'System',
            text: `<b>${userName}</b> เริ่มโหวตข้ามเพลง กดปุ่ม <b>Vote to skip</b> เพื่อร่วมโหวต`,
            timestamp: new Date().toISOString()
        });
    }

    const alreadyVoted = skipVotes.has(userName);
    if (!alreadyVoted) skipVotes.add(userName);

    const progress = getSkipVoteProgress(playingSong.id);
    if (!alreadyVoted) {
        addChatMessage({
            id: (Date.now() + 1).toString(),
            user: 'System',
            text: `โหวตข้ามเพลง: ${progress.votes}/${progress.total} (${progress.percentage}%)`,
            timestamp: new Date().toISOString()
        });
        io.emit('SKIP_VOTE_UPDATE', progress);
    }

    const passed = progress.votes / progress.total >= 0.6;
    if (passed && skipTriggeredSongId !== playingSong.id) {
        skipTriggeredSongId = playingSong.id;
        io.emit('FORCE_SKIP_CURRENT', playingSong.id);
        addChatMessage({
            id: (Date.now() + 2).toString(),
            user: 'System',
            text: 'โหวตสำเร็จ กำลังข้ามเพลง...',
            timestamp: new Date().toISOString()
        });
    }

    return respond({ ok: true, alreadyVoted, passed, ...progress });
};

export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: true,
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    io.on('connection', (socket) => {
        socket.emit('QUEUE_UPDATE', queueService.getQueue());
        socket.emit('ONLINE_USERS', getUniqueOnlineUsers());
        socket.emit('CHAT_HISTORY', chatHistory);

        socket.on('REGISTER_USER', (userName) => {
            if (userName) {
                onlineUsers.set(socket.id, userName);
                io.emit('ONLINE_USERS', getUniqueOnlineUsers());
                if (currentVoteSongId && skipVotes.size > 0) {
                    io.emit('SKIP_VOTE_UPDATE', getSkipVoteProgress(currentVoteSongId));
                }
            }
        });

        socket.on('SEND_CHAT', (data) => {
            const userName = onlineUsers.get(socket.id) || 'Anonymous';
            const text = data.text.trim();
            
            if (text.toLowerCase() === '/skip') {
                handleSkipVote(socket, null);
                return;
            }

            const chatMsg = {
                id: Date.now().toString(),
                user: userName,
                text: data.text,
                nowPlaying: data.nowPlaying, // Context of the song playing
                timestamp: new Date().toISOString()
            };
            
            chatHistory.push(chatMsg);
            if (chatHistory.length > MAX_CHAT_HISTORY) {
                chatHistory.shift();
            }
            
            io.emit('NEW_CHAT_MESSAGE', chatMsg);
        });

        socket.on('VOTE_SKIP', (data = {}, respond) => {
            handleSkipVote(socket, data.songId, typeof respond === 'function' ? respond : undefined);
        });

        socket.on('disconnect', () => {
            onlineUsers.delete(socket.id);
            io.emit('ONLINE_USERS', getUniqueOnlineUsers());
            if (currentVoteSongId && skipVotes.size > 0) {
                io.emit('SKIP_VOTE_UPDATE', getSkipVoteProgress(currentVoteSongId));
            }
        });
    });

    return io;
};

export const getIo = () => {
    if (!io) {
        console.warn('Socket.io not initialized yet');
    }
    return io;
};
