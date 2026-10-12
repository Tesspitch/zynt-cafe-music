import axios from 'axios';

const API_URL = import.meta.env.PROD 
    ? '' 
    : `http://${window.location.hostname}:8080`;

export const apiClient = axios.create({
    baseURL: API_URL,
    withCredentials: true // Important for sending session cookies
});

export const api = {
    // Session
    login: (name) => apiClient.post('/api/session', { name }),
    getSession: () => apiClient.get('/api/session/me'),
    logout: () => apiClient.delete('/api/session'),

    // YouTube
    searchYouTube: (query) => apiClient.get(`/api/youtube/search?q=${encodeURIComponent(query)}`),

    // Queue
    getQueue: () => apiClient.get('/api/queue'),
    getMyQueue: () => apiClient.get('/api/queue/me'),
    addSong: (videoId, url) => apiClient.post('/api/queue', { videoId, url }),
    removeSong: (id) => apiClient.delete(`/api/queue/${id}`),

    // Admin
    adminPlayNext: (password) => apiClient.post('/api/admin/queue/play-next', {}, { headers: { 'x-admin-password': password } }),
    adminSkipSong: (id, password) => apiClient.post(`/api/admin/queue/${id}/skip`, {}, { headers: { 'x-admin-password': password } }),
    adminForcePlay: (id, password) => apiClient.post(`/api/admin/queue/${id}/play`, {}, { headers: { 'x-admin-password': password } }),
    adminRemoveSong: (id, password) => apiClient.delete(`/api/admin/queue/${id}`, { headers: { 'x-admin-password': password } }),
    adminClearQueue: (password) => apiClient.delete('/api/admin/queue', { headers: { 'x-admin-password': password } })
};
