const STORAGE_KEY = 'cafeMusicListeningHistoryV1';
const SEARCH_STORAGE_KEY = 'cafeMusicSearchHistoryV1';
const MAX_HISTORY_ITEMS = 100;
const MAX_SEARCH_ITEMS = 30;

const readHistory = () => {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Could not read listening history', error);
        return [];
    }
};

const writeHistory = (history) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY_ITEMS)));
    } catch (error) {
        console.warn('Could not save listening history', error);
    }
};

const readSearchHistory = () => {
    try {
        const parsed = JSON.parse(localStorage.getItem(SEARCH_STORAGE_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Could not read search history', error);
        return [];
    }
};

const normalize = (value = '') => value.trim().toLocaleLowerCase();

export const recordSearchActivity = (query) => {
    const trimmedQuery = query?.trim();
    if (!trimmedQuery) return;

    try {
        const history = readSearchHistory();
        const existingIndex = history.findIndex(item => normalize(item.query) === normalize(trimmedQuery));
        const previous = existingIndex >= 0 ? history.splice(existingIndex, 1)[0] : {};
        history.unshift({
            query: trimmedQuery,
            count: (previous.count || 0) + 1,
            lastSearchedAt: new Date().toISOString()
        });
        localStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify(history.slice(0, MAX_SEARCH_ITEMS)));
    } catch (error) {
        console.warn('Could not save search history', error);
    }
};

const activityScore = (item) => {
    const lastActivityTime = new Date(item.lastActivityAt || 0).getTime();
    const ageInDays = Number.isFinite(lastActivityTime)
        ? Math.max(0, (Date.now() - lastActivityTime) / 86400000)
        : 365;
    const recencyScore = Math.max(0, 10 - ageInDays / 3);
    return (item.playCount || 0) * 3 + (item.requestCount || 0) * 2 + recencyScore;
};

export const recordSongActivity = (song, activity) => {
    if (!song?.youtubeVideoId && !song?.videoId) return;

    const videoId = song.youtubeVideoId || song.videoId;
    const history = readHistory();
    const existingIndex = history.findIndex(item => item.videoId === videoId);
    const previous = existingIndex >= 0 ? history.splice(existingIndex, 1)[0] : {};
    const now = new Date().toISOString();

    history.unshift({
        videoId,
        title: song.title || previous.title || 'Unknown title',
        thumbnailUrl: song.thumbnailUrl || song.thumbnail || previous.thumbnailUrl || '',
        channelName: song.channelName || previous.channelName || '',
        duration: song.duration || previous.duration || '',
        requestCount: (previous.requestCount || 0) + (activity === 'requested' ? 1 : 0),
        playCount: (previous.playCount || 0) + (activity === 'played' ? 1 : 0),
        lastRequestedAt: activity === 'requested' ? now : previous.lastRequestedAt || null,
        lastPlayedAt: activity === 'played' ? now : previous.lastPlayedAt || null,
        lastActivityAt: now
    });

    writeHistory(history);
};

export const getRecommendationProfile = () => {
    const rankedHistory = readHistory()
        .map(item => ({ ...item, score: activityScore(item) }))
        .sort((a, b) => b.score - a.score);
    const recentHistory = [...rankedHistory]
        .sort((a, b) => new Date(b.lastActivityAt || 0) - new Date(a.lastActivityAt || 0));
    const searchHistory = readSearchHistory()
        .sort((a, b) => new Date(b.lastSearchedAt || 0) - new Date(a.lastSearchedAt || 0));
    const latestSong = recentHistory[0];
    const queryCandidates = [
        latestSong?.channelName ? `${latestSong.channelName} เพลง` : null,
        searchHistory[0]?.query,
        latestSong?.title ? `${latestSong.title} เพลงคล้ายกัน` : null,
        ...recentHistory.slice(1, 4).map(item => item.channelName ? `${item.channelName} เพลง` : item.title),
        ...rankedHistory.slice(0, 3).map(item => item.channelName ? `${item.channelName} เพลง` : item.title)
    ].filter(Boolean);
    const queries = [...new Map(queryCandidates.map(query => [normalize(query), query])).values()].slice(0, 3);

    return {
        queries,
        rankedHistory,
        hasPersonalization: rankedHistory.length > 0 || searchHistory.length > 0,
        excludedVideoIds: recentHistory.slice(0, 20).map(item => item.videoId)
    };
};

export const rankRecommendations = (results, rankedHistory, excludedVideoIds = []) => {
    const excluded = new Set(excludedVideoIds);
    const unseenResults = results.filter(song => !excluded.has(song.videoId));
    const candidates = unseenResults.length ? unseenResults : results;
    if (!rankedHistory.length) return candidates;

    const historyByVideoId = new Map(rankedHistory.map(item => [item.videoId, item]));
    const preferredChannels = new Map();
    rankedHistory.forEach(item => {
        const channel = item.channelName?.trim().toLowerCase();
        if (channel) preferredChannels.set(channel, (preferredChannels.get(channel) || 0) + item.score);
    });

    return [...candidates].sort((a, b) => {
        const getScore = (song) => {
            const historyScore = historyByVideoId.get(song.videoId)?.score || 0;
            const channelScore = preferredChannels.get(song.channelName?.trim().toLowerCase()) || 0;
            return historyScore * 2 + channelScore;
        };
        return getScore(b) - getScore(a);
    });
};
