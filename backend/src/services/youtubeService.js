import axios from 'axios';
import { config } from '../config/env.js';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

let currentKeyIndex = 0;

const getApiKey = () => {
    if (config.youtubeApiKeys.length === 0) throw new Error('No YouTube API keys configured');
    return config.youtubeApiKeys[currentKeyIndex];
};

const switchApiKey = () => {
    currentKeyIndex = (currentKeyIndex + 1) % config.youtubeApiKeys.length;
    console.log(`Switched to YouTube API Key index: ${currentKeyIndex}`);
};

const makeYouTubeRequest = async (endpoint, params, retryCount = 0) => {
    const maxRetries = config.youtubeApiKeys.length;
    try {
        const response = await axios.get(`${YOUTUBE_API_BASE}${endpoint}`, {
            params: {
                ...params,
                key: getApiKey()
            }
        });
        return response;
    } catch (error) {
        const status = error?.response?.status;
        if ((status === 403 || status === 401 || status === 429) && retryCount < maxRetries) {
            console.warn(`YouTube API Key failed (Status: ${status}). Switching key...`);
            switchApiKey();
            return makeYouTubeRequest(endpoint, params, retryCount + 1);
        }
        throw error;
    }
};

// Helper to convert ISO 8601 duration (e.g., PT4M13S) to seconds or format
const parseDuration = (duration) => {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return duration;
    
    const hours = (parseInt(match[1]) || 0);
    const minutes = (parseInt(match[2]) || 0);
    const seconds = (parseInt(match[3]) || 0);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const searchYouTube = async (query) => {
    try {
        const response = await makeYouTubeRequest('/search', {
            part: 'snippet',
            q: query,
            type: 'video',
            maxResults: 10
        });

        const videoIds = response.data.items.map(item => item.id.videoId).join(',');
        
        // Fetch details to get duration
        const detailsResponse = await makeYouTubeRequest('/videos', {
            part: 'contentDetails,snippet',
            id: videoIds
        });

        return detailsResponse.data.items.map(item => ({
            videoId: item.id,
            title: item.snippet.title,
            thumbnailUrl: item.snippet.thumbnails.high.url,
            channelName: item.snippet.channelTitle,
            duration: parseDuration(item.contentDetails.duration)
        }));
    } catch (error) {
        console.error('YouTube Search Error:', error?.response?.data || error.message);
        throw new Error('Failed to search YouTube');
    }
};

export const getVideoDetails = async (videoId) => {
    try {
        const response = await makeYouTubeRequest('/videos', {
            part: 'snippet,contentDetails',
            id: videoId
        });

        if (response.data.items.length === 0) {
            return null;
        }

        const item = response.data.items[0];
        return {
            videoId: item.id,
            title: item.snippet.title,
            thumbnailUrl: item.snippet.thumbnails.high.url,
            channelName: item.snippet.channelTitle,
            duration: parseDuration(item.contentDetails.duration)
        };
    } catch (error) {
        console.error('YouTube Video Error:', error?.response?.data || error.message);
        throw new Error('Failed to get video details');
    }
};

export const extractVideoIdFromUrl = (url) => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : false;
};
