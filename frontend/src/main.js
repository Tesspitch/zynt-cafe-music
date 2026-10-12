import { api } from './api.js';
import { initSocket, sendChatMessage, getSocket } from './socket.js';

let currentUser = null;
let currentQueue = [];

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
    initSocket(updateQueueUI, updateOnlineUsersUI, renderChatHistory, appendChatMessage, currentUser);
    
    fetchQueue();
    loadRecommendations();
};

const loadRecommendations = async () => {
    if (searchResults.innerHTML.trim() !== '') return; // Don't overwrite if already searched
    try {
        // Randomize the search query slightly to keep it fresh
        const queries = ['เพลงชิล คาเฟ่', 'เพลงฮิต tpop', 'เพลงสากล ชิลๆ', 'เพลงอินดี้ คาเฟ่'];
        const randomQuery = queries[Math.floor(Math.random() * queries.length)];
        const res = await api.searchYouTube(randomQuery);
        renderSearchResults(res.data, true);
    } catch (e) {
        console.error('Failed to load recommendations', e);
    }
};

const updateOnlineUsersUI = (users) => {
    currentOnlineUsers = users;
    if (onlineCountDisplay) {
        onlineCountDisplay.innerText = `${users.length} (${users.join(', ')})`;
    }
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
            const utterance = new SpeechSynthesisUtterance(`${currentUser} ตอบหน่อย`);
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
    queueList.innerHTML = '';
    nowPlayingContainer.innerHTML = '<p class="text-sm">Nothing is playing right now.</p>';

    const activeItems = currentQueue.filter(q => q.status !== 'REMOVED');
    
    // Sort so WAITING is above PLAYED/SKIPPED
    activeItems.sort((a, b) => {
        const order = { 'WAITING': 1, 'PLAYED': 2, 'SKIPPED': 2, 'PLAYING': 0 };
        const orderA = order[a.status] ?? 99;
        const orderB = order[b.status] ?? 99;
        return orderA - orderB;
    });

    activeItems.forEach(item => {
        if (item.status === 'PLAYING') {
            nowPlayingContainer.innerHTML = renderQueueItem(item, true);
            chatContextDisplay.innerText = `🎵 Now playing: ${item.title}`;
            chatContextDisplay.style.display = 'block';
        } else {
            queueList.innerHTML += renderQueueItem(item, false);
        }
    });
    
    if (!activeItems.find(q => q.status === 'PLAYING')) {
        chatContextDisplay.style.display = 'none';
    }
};

const renderQueueItem = (item, isPlaying) => {
    const isMySong = item.requestedBy === currentUser;
    const canRemove = isMySong && item.status === 'WAITING';
    
    return `
        <div class="list-item ${isPlaying ? 'playing' : ''}">
            <img src="${item.thumbnailUrl}" alt="thumbnail">
            <div class="list-item-content">
                <strong>${item.title}</strong>
                <div class="text-sm">${item.channelName} • ${item.duration}</div>
                <div class="text-sm mt-2">
                    <span class="badge ${item.status.toLowerCase()}">${item.status}</span>
                    Requested by: <strong>${item.requestedBy}</strong>
                </div>
            </div>
            ${canRemove ? `<button class="danger" onclick="window.removeSong('${item.id}')">Remove</button>` : ''}
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
    searchBtn.disabled = true;
    searchResults.innerHTML = '<p class="text-sm text-center">Searching...</p>';
    try {
        const res = await api.searchYouTube(query);
        renderSearchResults(res.data, false);
    } catch (e) {
        addError.innerText = 'Search failed';
        searchResults.innerHTML = '';
    } finally {
        searchBtn.disabled = false;
    }
};

const renderSearchResults = (results, isRecommendation = false) => {
    const title = isRecommendation 
        ? '<h3 style="margin-top: 0; margin-bottom: 1rem; font-size: 1.1rem; color: var(--primary);">🎵 แนะนำสำหรับคุณ</h3>' 
        : '<h3 style="margin-top: 0; margin-bottom: 1rem; font-size: 1.1rem;">🔍 ผลการค้นหา</h3>';
        
    searchResults.innerHTML = title + results.map(item => `
        <div class="list-item">
            <img src="${item.thumbnailUrl}" alt="thumbnail">
            <div class="list-item-content">
                <strong>${item.title}</strong>
                <div class="text-sm">${item.channelName} • ${item.duration}</div>
            </div>
            <button onclick="window.addSongToQueue('${item.videoId}')">Add</button>
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
        await api.addSong(videoId, url);
        searchResults.innerHTML = '';
        searchInput.value = '';
        urlInput.value = '';
        loadRecommendations();
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
