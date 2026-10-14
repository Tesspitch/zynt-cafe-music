const STORAGE_KEY = 'cafeMusicListeningHistoryV1';
const MAX_HISTORY_ITEMS = 100;

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

    if (rankedHistory.length === 0) {
        return { query: null, rankedHistory: [] };
    }

    const topSong = rankedHistory[0];
    const query = topSong.channelName
        ? `${topSong.channelName} เพลง`
        : topSong.title;

    return { query, rankedHistory };
};

export const rankRecommendations = (results, rankedHistory) => {
    if (!rankedHistory.length) return results;

    const historyByVideoId = new Map(rankedHistory.map(item => [item.videoId, item]));
    const preferredChannels = new Map();
    rankedHistory.forEach(item => {
        const channel = item.channelName?.trim().toLowerCase();
        if (channel) preferredChannels.set(channel, (preferredChannels.get(channel) || 0) + item.score);
    });

    return [...results].sort((a, b) => {
        const getScore = (song) => {
            const historyScore = historyByVideoId.get(song.videoId)?.score || 0;
            const channelScore = preferredChannels.get(song.channelName?.trim().toLowerCase()) || 0;
            return historyScore * 2 + channelScore;
        };
        return getScore(b) - getScore(a);
    });
};
