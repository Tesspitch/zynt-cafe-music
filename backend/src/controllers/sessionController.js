export const createSession = (req, res) => {
    const { name } = req.body;
    
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'NAME_REQUIRED' });
    }
    
    const userName = name.trim();
    req.session.userName = userName;
    
    res.json({ success: true, userName });
};

export const getSession = (req, res) => {
    if (req.session && req.session.userName) {
        return res.json({ userName: req.session.userName });
    }
    res.status(401).json({ error: 'SESSION_NOT_FOUND' });
};

export const deleteSession = (req, res) => {
    req.session.destroy();
    res.json({ success: true });
};
