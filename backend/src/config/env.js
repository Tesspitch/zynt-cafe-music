import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 8080,
  youtubeApiKeys: [
      process.env.YOUTUBE_API_KEY,
      process.env.YOUTUBE_API_KEY_2,
      process.env.YOUTUBE_API_KEY_3,
      ...(process.env.YOUTUBE_API_KEYS ? process.env.YOUTUBE_API_KEYS.split(',') : [])
  ].filter(Boolean),
  adminPassword: process.env.ADMIN_PASSWORD,
  maxActiveRequestsPerUser: parseInt(process.env.MAX_ACTIVE_REQUESTS_PER_USER || '3', 10),
  requestCooldownSeconds: parseInt(process.env.REQUEST_COOLDOWN_SECONDS || '5', 10),
  sessionSecret: process.env.SESSION_SECRET || 'cafe-music-super-secret'
};
