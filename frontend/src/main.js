import { api } from './api.js';
import { initSocket, sendChatMessage, getSocket, voteToSkip as submitSkipVote } from './socket.js';
import { getRecommendationProfile, rankRecommendations, recordSearchActivity, recordSongActivity } from './listeningHistory.js';
import { initThemeToggle } from './theme.js';
import { ICONS } from './icons.js';

let currentUser = null;
let currentQueue = [];
const CHAT_ICON_MARKUP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 18.5 3 21v-5.2A8 8 0 0 1 2 12C2 7.6 6.5 4 12 4s10 3.6 10 8-4.5 8-10 8c-1.6 0-3.1-.3-4.5-.8Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg>';

// DOM Elements
const loginSection = document.getElementById('loginSection');
const mainSection = document.getElementById('mainSection');
const loginBtn = document.getElementById('loginBtn');
const nameInput = document.getElementById('nameInput');
const loginError = document.getElementById('loginError');
const userNameDisplay = document.getElementById('userNameDisplay');
const logoutBtn = document.getElementById('logoutBtn');

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');
const urlInput = document.getElementById('urlInput');
const addUrlBtn = document.getElementById('addUrlBtn');
const addError = document.getElementById('addError');

const queueList = document.getElementById('queueList');
const nowPlayingContainer = document.getElementById('nowPlayingContainer');
const requestLimitDisplay = document.getElementById('requestLimitDisplay');

const onlineCountDisplay = document.getElementById('onlineCountDisplay');
const onlineUsersList = document.getElementById('onlineUsersList');
const themeToggleBtn = document.getElementById('themeToggleBtn');

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
let playbackTimer = null;
let votedSkipSongId = null;
const skipVoteProgress = new Map();
let recommendationRequestId = 0;

initThemeToggle(themeToggleBtn);
chatToggleBtn.setAttribute('aria-expanded', 'false');

// Init
const init = async () => {
    try {
        const res = await api.getSession();
        currentUser = res.data.userName;
        localStorage.setItem('cafeUserName', currentUser);
        showApp();
    } catch (e) {
        // Try auto re-login if we have it in localStorage
        const savedName = localStorage.getItem('cafeUserName');
        if (savedName) {
            try {
                const res = await api.login(savedName);
                currentUser = res.data.userName;
                showApp();
                return;
            } catch (loginErr) {
                // Ignore and fall through to showLogin
            }
        }
        showLogin();
    }
};

// Functions
const showLogin = () => {
    loginSection.classList.remove('hidden');
    mainSection.classList.add('hidden');
};

const showApp = () => {
    loginSection.classList.add('hidden');
    mainSection.classList.remove('hidden');
    chatWidget.classList.remove('hidden');
    userNameDisplay.innerText = currentUser;
    initSocket(updateQueueUI, updateOnlineUsersUI, renderChatHistory, appendChatMessage, currentUser, handleSkipVoteUpdate);
    
    fetchQueue();
    loadRecommendations();
    if (!playbackTimer) {
        playbackTimer = setInterval(updatePlaybackTimer, 1000);
    }
};

const parseDurationToSeconds = (duration = '') => {
    const parts = duration.split(':').map(Number);
    if (!parts.length || parts.some(part => !Number.isFinite(part))) return 0;
    return parts.reduce((total, part) => total * 60 + part, 0);
};

const formatPlaybackTime = (seconds) => {
    const safeSeconds = Math.max(0, Math.floor(seconds || 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const secs = safeSeconds % 60;
    return hours > 0
        ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        : `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const getPlaybackElapsedSeconds = (song) => {
    const startedAtMs = new Date(song.startedAt).getTime();
    if (!Number.isFinite(startedAtMs)) return 0;
    const endPointMs = song.isPaused && song.pausedAt
        ? new Date(song.pausedAt).getTime()
        : Date.now();
    const elapsedMs = Math.max(0, endPointMs - startedAtMs - (song.totalPausedMs || 0));
    const durationSeconds = parseDurationToSeconds(song.duration);
    return durationSeconds > 0 ? Math.min(elapsedMs / 1000, durationSeconds) : elapsedMs / 1000;
};

const updatePlaybackTimer = () => {
    const playingSong = currentQueue.find(item => item.status === 'PLAYING');
    if (!playingSong) return;

    const elapsedSeconds = getPlaybackElapsedSeconds(playingSong);
    const durationSeconds = parseDurationToSeconds(playingSong.duration);
    const elapsedElement = document.querySelector(`[data-playback-time="${playingSong.id}"]`);
    const progressElement = document.querySelector(`[data-playback-progress="${playingSong.id}"]`);

    if (elapsedElement) {
        elapsedElement.innerText = `${playingSong.isPaused ? 'Paused · ' : ''}${formatPlaybackTime(elapsedSeconds)} / ${playingSong.duration || '--:--'}`;
    }
    if (progressElement) {
        const progress = durationSeconds > 0 ? Math.min(100, (elapsedSeconds / durationSeconds) * 100) : 0;
        progressElement.style.width = `${progress}%`;
    }
};

const loadRecommendations = async ({ force = false } = {}) => {
    if (!force && searchResults.innerHTML.trim() !== '') return;
    const requestId = ++recommendationRequestId;
    searchResults.innerHTML = '<p class="text-sm text-center">Refreshing recommendations...</p>';
    try {
        const profile = getRecommendationProfile();
        const fallbackQueries = ['เพลงชิล คาเฟ่', 'เพลงฮิต tpop', 'เพลงสากล ชิลๆ', 'เพลงอินดี้ คาเฟ่'];
        const queries = profile.queries.length
            ? profile.queries.slice(0, 2)
            : [fallbackQueries[Math.floor(Math.random() * fallbackQueries.length)]];
        const responses = await Promise.allSettled(queries.map(query => api.searchYouTube(query)));
        if (requestId !== recommendationRequestId) return;

        const uniqueResults = new Map();
        responses.forEach(response => {
            if (response.status !== 'fulfilled') return;
            response.value.data.forEach(song => uniqueResults.set(song.videoId, song));
        });
        if (!uniqueResults.size) throw new Error('No recommendation results');

        const activeVideoIds = currentQueue
            .filter(song => song.status === 'WAITING' || song.status === 'PLAYING')
            .map(song => song.youtubeVideoId);
        const recommendations = rankRecommendations(
            [...uniqueResults.values()],
            profile.rankedHistory,
            [...profile.excludedVideoIds, ...activeVideoIds]
        ).slice(0, 10);
        renderSearchResults(recommendations, true, profile.hasPersonalization);
    } catch (e) {
        if (requestId === recommendationRequestId) searchResults.innerHTML = '';
        console.error('Failed to load recommendations', e);
    }
};

const updateOnlineUsersUI = (users) => {
    currentOnlineUsers = users;
    if (onlineCountDisplay) {
        onlineCountDisplay.innerText = users.length;
        onlineCountDisplay.title = users.length ? users.join(', ') : 'No listeners online';
    }
    if (onlineUsersList) {
        onlineUsersList.replaceChildren();
        if (!users.length) {
            const emptyState = document.createElement('span');
            emptyState.className = 'online-user-empty';
            emptyState.textContent = 'No one online yet';
            onlineUsersList.append(emptyState);
            return;
        }

        users.forEach(userName => {
            const chip = document.createElement('span');
            chip.className = `online-user-chip${userName === currentUser ? ' is-current-user' : ''}`;
            chip.textContent = userName === currentUser ? `${userName} (you)` : userName;
            onlineUsersList.append(chip);
        });
    }
};

const handleSkipVoteUpdate = (progress) => {
    if (!progress?.songId) return;
    skipVoteProgress.set(progress.songId, progress);
    renderQueue();
};

const renderChatHistory = (history) => {
    chatMessages.innerHTML = '';
    history.forEach(msg => appendChatMessage(msg, false));
    scrollToBottom();
};

const appendChatMessage = (msg, animate = true) => {
    const isMe = msg.user === currentUser;
    const isMentioned = msg.text.includes(`@${currentUser}`);
    
    // Highlight mention
    let displayText = msg.text.replace(new RegExp(`@${currentUser}\\b`, 'gi'), `<span style="background: var(--primary); color: #121212; padding: 0 4px; border-radius: 4px; font-weight: bold;">$&</span>`);
    
    let nowPlayingHtml = msg.nowPlaying ? `<div style="font-size: 0.7rem; opacity: 0.7; margin-bottom: 2px;">Now playing: ${msg.nowPlaying}</div>` : '';

    const div = document.createElement('div');
    div.className = `chat-message${isMe ? ' chat-message-me' : ''}${isMentioned && !isMe ? ' chat-message-mentioned' : ''}`;
    div.style.alignSelf = isMe ? 'flex-end' : 'flex-start';
    div.style.maxWidth = '85%';
    
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
            const utterance = new SpeechSynthesisUtterance(`${currentUser} ตอบหน่อย`);
            utterance.lang = 'th-TH';
            window.speechSynthesis.speak(utterance);
        }
    }

    if (!isMe && chatPanel.classList.contains('hidden')) {
        unreadChats++;
        chatToggleBtn.innerHTML = `${CHAT_ICON_MARKUP}<span class="unread-badge">${unreadChats}</span>`;
    }
};

const scrollToBottom = () => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
};

const fetchQueue = async () => {
    try {
        const res = await api.getQueue();
        updateQueueUI(res.data);
    } catch (e) {
        console.error('Failed to fetch queue', e);
    }
};

const updateQueueUI = (queue) => {
    currentQueue = queue;
    renderQueue();
    updateLimit();
};

const updateLimit = () => {
    if (!currentUser) return;
    const active = currentQueue.filter(q => q.requestedBy === currentUser && (q.status === 'WAITING' || q.status === 'PLAYING')).length;
    requestLimitDisplay.innerText = `${active} / 10`;
};

const renderQueue = () => {
    nowPlayingContainer.innerHTML = '<p class="text-sm">Nothing is playing right now.</p>';
    const playingSong = currentQueue.find(item => item.status === 'PLAYING');
    const waitingSongs = currentQueue
        .filter(item => item.status === 'WAITING')
        .sort((a, b) => new Date(a.requestedAt || 0) - new Date(b.requestedAt || 0));
    const historySongs = currentQueue
        .filter(item => item.status === 'PLAYED' || item.status === 'SKIPPED')
        .sort((a, b) => new Date(b.finishedAt || b.requestedAt || 0) - new Date(a.finishedAt || a.requestedAt || 0));

    queueList.innerHTML = `
        <section class="queue-status-group waiting-group">
            <div class="queue-group-heading"><div><span class="queue-group-kicker">UP NEXT</span><h3>Waiting</h3></div><span class="queue-count">${waitingSongs.length}</span></div>
            <div class="queue-group-list">${waitingSongs.length ? waitingSongs.map(item => renderQueueItem(item, false)).join('') : '<p class="queue-empty">No songs are waiting.</p>'}</div>
        </section>
        <section class="queue-status-group history-group">
            <div class="queue-group-heading"><div><span class="queue-group-kicker">PLAYED / SKIPPED</span><h3>History</h3></div><span class="queue-count">${historySongs.length}</span></div>
            <div class="queue-group-list">${historySongs.length ? historySongs.map(item => renderQueueItem(item, false)).join('') : '<p class="queue-empty">No listening history yet.</p>'}</div>
        </section>
    `;

    if (playingSong) {
        nowPlayingContainer.innerHTML = renderQueueItem(playingSong, true);
        chatContextDisplay.innerText = `Now playing: ${playingSong.title}`;
        chatContextDisplay.style.display = 'block';
    } else {
        chatContextDisplay.style.display = 'none';
    }
    updatePlaybackTimer();
};

const renderQueueItem = (item, isPlaying) => {
    const isMySong = item.requestedBy === currentUser;
    const canRemove = isMySong && item.status === 'WAITING';
    const voteProgress = skipVoteProgress.get(item.id);
    const hasVoted = votedSkipSongId === item.id;
    
    return `
        <div class="list-item ${isPlaying ? 'playing' : ''}">
            <img src="${item.thumbnailUrl}" alt="thumbnail" loading="${isPlaying ? 'eager' : 'lazy'}" decoding="async">
            <div class="list-item-content">
                <strong>${item.title}</strong>
                <div class="text-sm">${item.channelName} • ${item.duration}</div>
                ${isPlaying ? `
                    <div class="playback-time" data-playback-time="${item.id}">0:00 / ${item.duration || '--:--'}</div>
                    <div class="playback-progress-track"><span data-playback-progress="${item.id}"></span></div>
                    <div class="skip-vote-row">
                        <button class="skip-vote-button button-with-icon" onclick="window.voteToSkipSong('${item.id}')" ${hasVoted ? 'disabled' : ''}>${ICONS.vote}<span>${hasVoted ? 'Vote submitted' : 'Vote to skip'}</span></button>
                        <span>${voteProgress ? `${voteProgress.votes}/${voteProgress.total} votes (${voteProgress.percentage}%)` : 'Skip requires 60% of listeners'}</span>
                    </div>
                ` : ''}
                <div class="text-sm mt-2">
                    <span class="badge ${item.status.toLowerCase()}">${item.status}</span>
                    Requested by: <strong>${item.requestedBy}</strong>
                </div>
            </div>
            ${canRemove ? `<button class="danger icon-button compact" onclick="window.removeSong('${item.id}')" aria-label="Remove song" title="Remove song">${ICONS.trash}</button>` : ''}
        </div>
    `;
};

const handleLogin = async () => {
    const name = nameInput.value.trim();
    if (!name) {
        loginError.innerText = 'Name is required';
        return;
    }
    try {
        const res = await api.login(name);
        currentUser = res.data.userName;
        localStorage.setItem('cafeUserName', currentUser);
        loginError.innerText = '';
        showApp();
    } catch (e) {
        loginError.innerText = e.response?.data?.error || 'Login failed';
    }
};

const handleLogout = async () => {
    await api.logout();
    currentUser = null;
    localStorage.removeItem('cafeUserName');
    showLogin();
};

const handleSearch = async () => {
    const query = searchInput.value.trim();
    if (!query) return;
    recommendationRequestId++;
    searchBtn.disabled = true;
    searchResults.innerHTML = '<p class="text-sm text-center">Searching...</p>';
    try {
        const res = await api.searchYouTube(query);
        recordSearchActivity(query);
        renderSearchResults(res.data, false);
    } catch (e) {
        addError.innerText = 'Search failed';
        searchResults.innerHTML = '';
    } finally {
        searchBtn.disabled = false;
    }
};

const renderSearchResults = (results, isRecommendation = false, isPersonalized = false) => {
    const title = isRecommendation 
        ? `<h3>${isPersonalized ? 'แนะนำจากประวัติของคุณ' : 'แนะนำสำหรับคุณ'}</h3>`
        : '<h3>ผลการค้นหา</h3>';
        
    searchResults.innerHTML = title + results.map(item => `
        <div class="list-item">
            <img src="${item.thumbnailUrl}" alt="thumbnail" loading="lazy" decoding="async">
            <div class="list-item-content">
                <strong>${item.title}</strong>
                <div class="text-sm">${item.channelName} • ${item.duration}</div>
            </div>
            <button class="icon-button compact" onclick="window.addSongToQueue('${item.videoId}')" aria-label="Add song to queue" title="Add to queue">${ICONS.plus}</button>
        </div>
    `).join('');
};

const handleAddUrl = () => {
    const url = urlInput.value.trim();
    if (url) window.addSongToQueue(null, url);
};

// Global handlers
window.addSongToQueue = async (videoId, url = null) => {
    addError.innerText = '';
    try {
        const res = await api.addSong(videoId, url);
        recordSongActivity(res.data, 'requested');
        searchResults.innerHTML = '';
        searchInput.value = '';
        urlInput.value = '';
        await loadRecommendations({ force: true });
    } catch (e) {
        addError.innerText = e.response?.data?.error || 'Failed to add song';
    }
};

window.removeSong = async (id) => {
    try {
        await api.removeSong(id);
    } catch (e) {
        alert(e.response?.data?.error || 'Failed to remove song');
    }
};

window.voteToSkipSong = (songId) => {
    const button = document.querySelector(`.skip-vote-button[onclick*="${songId}"]`);
    if (button) {
        button.disabled = true;
        button.innerHTML = `${ICONS.vote}<span>Submitting vote...</span>`;
    }

    submitSkipVote(songId, (result) => {
        if (!result?.ok) {
            if (button) {
                button.disabled = false;
                button.innerHTML = `${ICONS.vote}<span>Vote to skip</span>`;
            }
            addError.innerText = result?.error === 'SONG_NOT_PLAYING'
                ? 'This song is no longer playing.'
                : 'Could not submit your vote.';
            return;
        }

        votedSkipSongId = songId;
        skipVoteProgress.set(songId, result);
        renderQueue();
    });
};

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
        const matches = currentOnlineUsers.filter(u => u.toLowerCase().startsWith(query) && u !== currentUser);
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

// Event Listeners
loginBtn.addEventListener('click', handleLogin);
logoutBtn.addEventListener('click', handleLogout);
searchBtn.addEventListener('click', handleSearch);
addUrlBtn.addEventListener('click', handleAddUrl);

chatToggleBtn.addEventListener('click', () => {
    const shouldOpen = chatPanel.classList.contains('hidden');
    chatPanel.classList.toggle('hidden', !shouldOpen);
    chatToggleBtn.setAttribute('aria-expanded', String(shouldOpen));
    chatToggleBtn.setAttribute('aria-label', shouldOpen ? 'Close live chat' : 'Open live chat');
    if (shouldOpen) {
        unreadChats = 0;
        chatToggleBtn.innerHTML = CHAT_ICON_MARKUP;
        chatInput.focus();
        scrollToBottom();
    }
});

closeChatBtn.addEventListener('click', () => {
    chatPanel.classList.add('hidden');
    chatToggleBtn.setAttribute('aria-expanded', 'false');
    chatToggleBtn.setAttribute('aria-label', 'Open live chat');
});

sendChatBtn.addEventListener('click', handleSendChat);

// Enter key support
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSearch(); });
searchInput.addEventListener('input', (e) => {
    if (e.target.value.trim() === '') {
        searchResults.innerHTML = '';
        loadRecommendations();
    }
});
urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAddUrl(); });
chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSendChat(); });

init();
