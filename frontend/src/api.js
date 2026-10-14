const API_URL = import.meta.env?.PROD
    ? ''
    : `http://${window.location.hostname}:8080`;

const request = async (path, options = {}) => {
    const response = await fetch(`${API_URL}${path}`, {
        method: options.method || 'GET',
        credentials: 'include',
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    const data = response.status === 204
        ? null
        : await response.json().catch(() => null);

    if (!response.ok) {
        const error = new Error(data?.message || data?.error || `Request failed (${response.status})`);
        error.response = { status: response.status, data };
        throw error;
    }

    return { data, status: response.status };
};

const adminHeaders = (password) => ({ 'x-admin-password': password });

export const api = {
    // Session
    login: (name) => request('/api/session', { method: 'POST', body: { name } }),
    getSession: () => request('/api/session/me'),
    logout: () => request('/api/session', { method: 'DELETE' }),

    // YouTube
    searchYouTube: (query) => request(`/api/youtube/search?q=${encodeURIComponent(query)}`),

    // Queue
    getQueue: () => request('/api/queue'),
    getMyQueue: () => request('/api/queue/me'),
    addSong: (videoId, url) => request('/api/queue', { method: 'POST', body: { videoId, url } }),
    removeSong: (id) => request(`/api/queue/${id}`, { method: 'DELETE' }),

    // Admin
    adminPlayNext: (password) => request('/api/admin/queue/play-next', { method: 'POST', headers: adminHeaders(password) }),
    adminSkipSong: (id, password) => request(`/api/admin/queue/${id}/skip`, { method: 'POST', headers: adminHeaders(password) }),
    adminForcePlay: (id, password) => request(`/api/admin/queue/${id}/play`, { method: 'POST', headers: adminHeaders(password) }),
    adminPausePlayback: (id, password) => request('/api/admin/player/pause', { method: 'POST', body: { id }, headers: adminHeaders(password) }),
    adminResumePlayback: (id, password) => request('/api/admin/player/resume', { method: 'POST', body: { id }, headers: adminHeaders(password) }),
    adminRemoveSong: (id, password) => request(`/api/admin/queue/${id}`, { method: 'DELETE', headers: adminHeaders(password) }),
    adminClearQueue: (password) => request('/api/admin/queue', { method: 'DELETE', headers: adminHeaders(password) })
};
