import { config } from '../config/env.js';

export const adminMiddleware = (req, res, next) => {
    const password = req.headers['x-admin-password'] || req.body.adminPassword || req.query.adminPassword;
    
    if (!password || password !== config.adminPassword) {
        return res.status(403).json({ error: 'UNAUTHORIZED', message: 'Invalid admin password' });
    }
    
    next();
};
