export const authMiddleware = (req, res, next) => {
    if (!req.session || !req.session.userName) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Session not found or expired' });
    }
    next();
};
