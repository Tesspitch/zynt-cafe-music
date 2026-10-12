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
            }
        });

        socket.on('SEND_CHAT', (data) => {
            const userName = onlineUsers.get(socket.id) || 'Anonymous';
            const text = data.text.trim();
            
            if (text.toLowerCase() === '/skip') {
                const queue = queueService.getQueue();
                const playingSong = queue.find(q => q.status === 'PLAYING');
                
                if (playingSong) {
                    if (currentVoteSongId !== playingSong.id) {
                        skipVotes.clear();
                        currentVoteSongId = playingSong.id;
                        
                        const msg = {
                            id: Date.now().toString(),
                            user: 'System',
                            text: `🗳️ <b>${userName}</b> เปิดโหวตข้ามเพลง! พิมพ์ <b>/skip</b> เพื่อโหวต`,
                            timestamp: new Date().toISOString()
                        };
                        chatHistory.push(msg);
                        io.emit('NEW_CHAT_MESSAGE', msg);
                    }
                    
                    if (userName !== 'Admin' && !skipVotes.has(userName)) {
                        skipVotes.add(userName);
                    } else if (userName === 'Admin') {
                        // Admin can auto skip or we just let admin vote count?
                        // Let admin vote normally but we exclude them from total. If they vote, it's just +1.
                        if (!skipVotes.has(userName)) skipVotes.add(userName);
                    }
                    
                    const uniqueUsers = getUniqueOnlineUsers();
                    const total = uniqueUsers.filter(u => u !== 'Admin').length || 1; 
                    const votes = skipVotes.size;
                    
                    const progressMsg = {
                        id: (Date.now() + 1).toString(),
                        user: 'System',
                        text: `📊 โหวตข้ามเพลง: ${votes}/${total} (${Math.round((votes/total)*100)}%)`,
                        timestamp: new Date().toISOString()
                    };
                    chatHistory.push(progressMsg);
                    if (chatHistory.length > MAX_CHAT_HISTORY) chatHistory.shift();
                    io.emit('NEW_CHAT_MESSAGE', progressMsg);
                    
                    if (votes / total >= 0.6) {
                        io.emit('FORCE_SKIP_CURRENT', playingSong.id);
                        const passedMsg = {
                            id: (Date.now() + 2).toString(),
                            user: 'System',
                            text: `⏭️ โหวตสำเร็จ! กำลังข้ามเพลง...`,
                            timestamp: new Date().toISOString()
                        };
                        chatHistory.push(passedMsg);
                        io.emit('NEW_CHAT_MESSAGE', passedMsg);
                        skipVotes.clear();
                    }
                }
                return; // Do not broadcast the '/skip' command as a normal chat
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

        socket.on('disconnect', () => {
            onlineUsers.delete(socket.id);
            io.emit('ONLINE_USERS', getUniqueOnlineUsers());
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
