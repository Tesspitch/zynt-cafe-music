import { ICONS } from './icons.js';

const THEME_KEY = 'cafeMusicTheme';

const getInitialTheme = () => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

const applyTheme = (theme, button) => {
    document.documentElement.dataset.theme = theme;
    if (button) {
        const nextTheme = theme === 'dark' ? 'light' : 'dark';
        button.innerHTML = nextTheme === 'light' ? ICONS.sun : ICONS.moon;
        button.setAttribute('aria-label', `Switch to ${nextTheme} mode`);
        button.title = `Switch to ${nextTheme} mode`;
        button.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
    }
};

export const initThemeToggle = (button) => {
    let currentTheme = getInitialTheme();
    applyTheme(currentTheme, button);

    button?.addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        localStorage.setItem(THEME_KEY, currentTheme);
        applyTheme(currentTheme, button);
    });
};
