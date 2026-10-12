import { api } from './api.js';
import { initSocket, sendChatMessage, getSocket } from './socket.js';

let adminPassword = null;
let currentQueue = [];
let ytPlayer = null;
let currentPlayingId = null;

// DOM Elements
const adminLoginSection = document.getElementById('adminLoginSection');
const adminDashboard = document.getElementById('adminDashboard');
const adminPasswordInput = document.getElementById('adminPasswordInput');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const playNextBtn = document.getElementById('playNextBtn');
const skipCurrentBtn = document.getElementById('skipCurrentBtn');
const clearQueueBtn = document.getElementById('clearQueueBtn');
const adminQueueList = document.getElementById('adminQueueList');
const playerStatus = document.getElementById('playerStatus');
const seekSlider = document.getElementById('seekSlider');
const currentTimeDisplay = document.getElementById('currentTimeDisplay');
const durationDisplay = document.getElementById('durationDisplay');
const volSlider = document.getElementById('volSlider');
const volDisplay = document.getElementById('volDisplay');

// Chat Elements
const chatWidget = document.getElementById('chatWidget');
const chatToggleBtn = document.getElementById('chatToggleBtn');
const chatPanel = document.getElementById('chatPanel');
const closeChatBtn = document.getElementById('closeChatBtn');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const chatContextDisplay = document.getElementById('chatContextDisplay');
const mentionDropdown = document.getElementById('mentionDropdown');

let unreadChats = 0;
let currentOnlineUsers = [];
let isDraggingSeek = false;
let seekUpdateInterval;

const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
};

const updateVolumeDisplay = () => {
    if (ytPlayer && ytPlayer.setVolume) {
        const vol = parseInt(volSlider.value, 10);
        ytPlayer.setVolume(vol);
        volDisplay.innerText = `${vol}%`;
    }
};

// Init YouTube API dynamically to avoid race conditions with ES Modules
window.onYouTubeIframeAPIReady = () => {
    ytPlayer = new YT.Player('youtubePlayer', {
        height: '360',
        width: '640',
        videoId: '',
        playerVars: {
            'autoplay': 1,
            'controls': 1,
            'origin': window.location.origin
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });
};

const onPlayerError = (event) => {
    console.error('YouTube Player Error:', event.data);
    playerStatus.innerText = '⚠️ Error playing video! Skipping to next...';
    setTimeout(() => {
        if (currentPlayingId) {
            handlePlayNext();
        }
    }, 2000);
};

const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

const onPlayerReady = (event) => {
    playerStatus.innerText = 'Player is ready.';
    // If a song is already set as playing but wasn't loaded because player wasn't ready
    if (currentPlayingId && currentQueue) {
        const playingSong = currentQueue.find(q => q.id === currentPlayingId);
        if (playingSong && ytPlayer.loadVideoById) {
            ytPlayer.unMute();
            ytPlayer.loadVideoById(playingSong.youtubeVideoId);
            playerStatus.innerText = `Playing: ${playingSong.title}`;
            updateVolumeDisplay();
        }
    }
};

const onPlayerStateChange = (event) => {
    if (event.data === 1) { // PLAYING
        startSeekInterval();
        updateVolumeDisplay(); // Ensure volume from slider is applied
        const duration = ytPlayer.getDuration();
        if (duration > 0) durationDisplay.innerText = formatTime(duration);
    } else {
        stopSeekInterval();
    }
    
    if (event.data === 0) { // ENDED
        playerStatus.innerText = 'Song ended. Playing next...';
        if (currentPlayingId) {
            handlePlayNext();
        }
    }
};

const adminOnlineCountDisplay = document.getElementById('adminOnlineCountDisplay');

const handleLogin = () => {
    adminPassword = adminPasswordInput.value;
    if (adminPassword) {
        localStorage.setItem('cafeAdminPassword', adminPassword);
    }
    adminLoginSection.classList.add('hidden');
    adminDashboard.classList.remove('hidden');
    chatWidget.classList.remove('hidden');
    initSocket(updateAdminQueueUI, updateAdminOnlineUsersUI, renderChatHistory, appendChatMessage, 'Admin');
    
    getSocket().on('FORCE_SKIP_CURRENT', (songId) => {
        if (currentPlayingId === songId) {
            playerStatus.innerText = '⏭️ Voted to skip! Skipping...';
            handleSkipCurrent();
        }
    });

    fetchQueue();
};

const updateAdminOnlineUsersUI = (users) => {
    currentOnlineUsers = users;
    if (adminOnlineCountDisplay) {
        adminOnlineCountDisplay.innerText = `${users.length} (${users.join(', ')})`;
    }
};

const renderChatHistory = (history) => {
    chatMessages.innerHTML = '';
    history.forEach(msg => appendChatMessage(msg, false));
    scrollToBottom();
};

const appendChatMessage = (msg, animate = true) => {
    const isMe = msg.user === 'Admin';
    const isMentioned = msg.text.includes(`@Admin`);
    
    // Highlight mention
    let displayText = msg.text.replace(new RegExp(`@Admin\\b`, 'gi'), `<span style="background: var(--primary); color: #121212; padding: 0 4px; border-radius: 4px; font-weight: bold;">$&</span>`);
    
    let nowPlayingHtml = msg.nowPlaying ? `<div style="font-size: 0.7rem; opacity: 0.7; margin-bottom: 2px;">🎵 ${msg.nowPlaying}</div>` : '';

    const div = document.createElement('div');
    div.style.alignSelf = isMe ? 'flex-end' : 'flex-start';
    div.style.maxWidth = '85%';
    div.style.background = isMe ? '#2a2a2a' : (isMentioned ? 'rgba(29, 185, 84, 0.2)' : 'var(--bg-color)');
    div.style.padding = '8px 12px';
    div.style.borderRadius = '12px';
    if (isMentioned && !isMe) div.style.border = '1px solid var(--primary)';
    
    div.innerHTML = `
        <div style="font-size: 0.75rem; font-weight: bold; color: ${isMe ? 'var(--primary)' : 'var(--text-secondary)'}; margin-bottom: 2px;">
            ${isMe ? 'You' : msg.user}
        </div>
        ${nowPlayingHtml}
        <div style="word-break: break-word;">${displayText}</div>
    `;
    
    chatMessages.appendChild(div);
    scrollToBottom();

    if (isMentioned && !isMe) {
        // Play TTS sound for mention
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(`แอดมิน ตอบหน่อย`);
            utterance.lang = 'th-TH';
            window.speechSynthesis.speak(utterance);
        }
    }

    if (!isMe && chatPanel.classList.contains('hidden')) {
        unreadChats++;
        chatToggleBtn.innerHTML = `💬 <span class="unread-badge">${unreadChats}</span>`;
    }
};

const scrollToBottom = () => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
};

const fetchQueue = async () => {
    try {
        const res = await api.getQueue();
        updateAdminQueueUI(res.data);
    } catch (e) {
        console.error('Failed to fetch queue', e);
    }
};

const updateAdminQueueUI = (queue) => {
    currentQueue = queue;
    renderAdminQueue();
    
    // Check if we need to start playing (if a song was forced to play by another admin or new session)
    const playingSong = queue.find(q => q.status === 'PLAYING');
    if (playingSong && playingSong.id !== currentPlayingId) {
        currentPlayingId = playingSong.id;
        if (ytPlayer && ytPlayer.loadVideoById) {
            ytPlayer.unMute();
            ytPlayer.loadVideoById(playingSong.youtubeVideoId);
            playerStatus.innerText = `Playing: ${playingSong.title}`;
            updateVolumeDisplay();
        }
    }
};

window.adminForcePlaySong = async (id) => {
    try {
        await api.adminForcePlay(id, adminPassword);
    } catch (e) {
        handleAuthError(e);
    }
};

const renderAdminQueue = () => {
    const sortedQueue = [...currentQueue].sort((a, b) => {
        const order = { 'WAITING': 1, 'PLAYED': 2, 'SKIPPED': 2, 'REMOVED': 3, 'PLAYING': 0 };
        const orderA = order[a.status] ?? 99;
        const orderB = order[b.status] ?? 99;
        return orderA - orderB;
    });

    adminQueueList.innerHTML = sortedQueue.map((q, index) => {
        let badge = `<span class="badge ${q.status.toLowerCase()}">${q.status}</span>`;
        let controls = '';
        
        if (q.status === 'WAITING') {
            controls = `
                <div class="flex gap-2">
                    <button onclick="adminForcePlaySong('${q.id}')" style="background: var(--primary); padding: 0.2rem 0.5rem; font-size: 0.8rem; border-radius: 4px; color: #121212;">Play Now</button>
                    <button onclick="adminRemoveSong('${q.id}')" class="danger" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">Remove</button>
                </div>
            `;
        }

        return `
            <div class="list-item ${q.status === 'PLAYING' ? 'playing' : ''}">
                <img src="${q.thumbnailUrl || q.thumbnail}" alt="Thumbnail">
                <div class="list-item-content">
                    <strong>${q.title}</strong>
                    <div class="text-sm mt-1 mb-2">${badge} Req: ${q.requestedBy}</div>
                    ${controls}
                </div>
            </div>
        `;
    }).join('');

    const playingSong = currentQueue.find(q => q.status === 'PLAYING');
    if (playingSong) {
        chatContextDisplay.innerText = `🎵 Now playing: ${playingSong.title}`;
        chatContextDisplay.style.display = 'block';
    } else {
        chatContextDisplay.style.display = 'none';
    }
};

const handleAuthError = (e) => {
    if (e.response?.status === 403) {
        localStorage.removeItem('cafeAdminPassword');
        adminLoginSection.classList.remove('hidden');
        adminDashboard.classList.add('hidden');
        playerStatus.innerText = '⚠️ Invalid Admin Password! Please login again.';
    } else {
        console.error('API Error:', e);
        playerStatus.innerText = `⚠️ Action failed: ${e.response?.data?.error || e.message}. Retrying...`;
        // If it's a network error during auto-play, retry after 3 seconds
        setTimeout(() => {
            if (currentPlayingId) handlePlayNext();
        }, 3000);
    }
};

const handlePlayNext = async () => {
    try {
        const res = await api.adminPlayNext(adminPassword);
        if (res.data.message === 'QUEUE_EMPTY') {
            playerStatus.innerText = 'Queue is empty.';
            currentPlayingId = null;
            if (ytPlayer && ytPlayer.stopVideo) ytPlayer.stopVideo();
        } else {
            currentPlayingId = res.data.id;
            if (ytPlayer && ytPlayer.loadVideoById) {
                ytPlayer.unMute();
                ytPlayer.loadVideoById(res.data.youtubeVideoId);
                playerStatus.innerText = `Playing: ${res.data.title}`;
                updateVolumeDisplay();
            }
        }
    } catch (e) {
        handleAuthError(e);
    }
};

const handleSkipCurrent = async () => {
    if (!currentPlayingId) return;
    try {
        await api.adminSkipSong(currentPlayingId, adminPassword);
        handlePlayNext();
    } catch (e) {
        handleAuthError(e);
    }
};

window.adminRemoveSong = async (id) => {
    try {
        await api.adminRemoveSong(id, adminPassword);
    } catch (e) {
        handleAuthError(e);
    }
};

const handleClearQueue = async () => {
    if (confirm('Are you sure you want to clear the entire queue?')) {
        try {
            await api.adminClearQueue(adminPassword);
            if (ytPlayer && ytPlayer.stopVideo) ytPlayer.stopVideo();
            currentPlayingId = null;
            playerStatus.innerText = 'Queue cleared.';
        } catch (e) {
            handleAuthError(e);
        }
    }
};

const startSeekInterval = () => {
    if (seekUpdateInterval) clearInterval(seekUpdateInterval);
    seekUpdateInterval = setInterval(() => {
        if (!isDraggingSeek && ytPlayer && ytPlayer.getCurrentTime && ytPlayer.getDuration) {
            const time = ytPlayer.getCurrentTime();
            const duration = ytPlayer.getDuration();
            if (duration > 0) {
                seekSlider.max = duration;
                seekSlider.value = time;
                currentTimeDisplay.innerText = formatTime(time);
                durationDisplay.innerText = formatTime(duration);
            }
        }
    }, 500);
};

const stopSeekInterval = () => {
    if (seekUpdateInterval) clearInterval(seekUpdateInterval);
};

seekSlider.addEventListener('mousedown', () => { isDraggingSeek = true; });
seekSlider.addEventListener('touchstart', () => { isDraggingSeek = true; }, { passive: true });

seekSlider.addEventListener('input', (e) => {
    currentTimeDisplay.innerText = formatTime(e.target.value);
});

const handleSeekChange = (e) => {
    if (ytPlayer && ytPlayer.seekTo) {
        ytPlayer.seekTo(e.target.value, true);
    }
    isDraggingSeek = false;
};

seekSlider.addEventListener('change', handleSeekChange);
seekSlider.addEventListener('mouseup', handleSeekChange);
seekSlider.addEventListener('touchend', handleSeekChange);

volSlider.addEventListener('input', (e) => {
    const vol = parseInt(e.target.value, 10);
    if (ytPlayer && ytPlayer.setVolume) {
        ytPlayer.setVolume(vol);
        if (vol > 0) ytPlayer.unMute();
        volDisplay.innerText = `${vol}%`;
    }
});

adminLoginBtn.addEventListener('click', handleLogin);
playNextBtn.addEventListener('click', handlePlayNext);
skipCurrentBtn.addEventListener('click', handleSkipCurrent);
clearQueueBtn.addEventListener('click', handleClearQueue);

const handleSendChat = () => {
    const text = chatInput.value.trim();
    if (!text) return;
    
    // Get now playing context
    const playingSong = currentQueue.find(q => q.status === 'PLAYING');
    const nowPlaying = playingSong ? playingSong.title : null;
    
    sendChatMessage(text, nowPlaying);
    chatInput.value = '';
    mentionDropdown.classList.add('hidden');
};

chatInput.addEventListener('input', (e) => {
    const val = e.target.value;
    const lastAtPos = val.lastIndexOf('@');
    if (lastAtPos !== -1) {
        const query = val.slice(lastAtPos + 1).toLowerCase();
        if (query.includes(' ')) {
            mentionDropdown.classList.add('hidden');
            return;
        }
        const matches = currentOnlineUsers.filter(u => u.toLowerCase().startsWith(query) && u !== 'Admin');
        if (matches.length > 0) {
            mentionDropdown.innerHTML = matches.map(u => `<div class="mention-item" data-name="${u}">${u}</div>`).join('');
            mentionDropdown.classList.remove('hidden');
            
            mentionDropdown.querySelectorAll('.mention-item').forEach(item => {
                item.addEventListener('click', () => {
                    chatInput.value = val.slice(0, lastAtPos) + `@${item.dataset.name} `;
                    mentionDropdown.classList.add('hidden');
                    chatInput.focus();
                });
            });
        } else {
            mentionDropdown.classList.add('hidden');
        }
    } else {
        mentionDropdown.classList.add('hidden');
    }
});

chatToggleBtn.addEventListener('click', () => {
    chatPanel.classList.remove('hidden');
    unreadChats = 0;
    chatToggleBtn.innerHTML = '💬';
    chatInput.focus();
    scrollToBottom();
});

closeChatBtn.addEventListener('click', () => {
    chatPanel.classList.add('hidden');
});

sendChatBtn.addEventListener('click', handleSendChat);

// Enter key support
adminPasswordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
});
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSendChat();
});

// Auto-login on load
const savedPassword = localStorage.getItem('cafeAdminPassword');
if (savedPassword) {
    adminPasswordInput.value = savedPassword;
    handleLogin();
}
