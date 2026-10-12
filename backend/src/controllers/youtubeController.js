import * as youtubeService from '../services/youtubeService.js';

export const search = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.json([]);
        }
        const results = await youtubeService.searchYouTube(q);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'YOUTUBE_ERROR', message: error.message });
    }
};

export const getVideo = async (req, res) => {
    try {
        const { videoId } = req.params;
        const result = await youtubeService.getVideoDetails(videoId);
        if (!result) {
            return res.status(404).json({ error: 'YOUTUBE_VIDEO_NOT_FOUND' });
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'YOUTUBE_ERROR', message: error.message });
    }
};
