const svg = (content) => `<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true">${content}</svg>`;

export const ICONS = Object.freeze({
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'),
    link: svg('<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    trash: svg('<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>'),
    play: svg('<path d="m9 6 9 6-9 6V6Z"/>'),
    pause: svg('<path d="M9 6v12M15 6v12"/>'),
    next: svg('<path d="m6 6 8 6-8 6V6ZM17 6v12"/>'),
    skip: svg('<path d="m5 6 8 6-8 6V6ZM16 7v10"/>'),
    logout: svg('<path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9"/>'),
    login: svg('<path d="M14 8l4 4-4 4M18 12H7"/><path d="M10 5H5v14h5"/>'),
    moon: svg('<path d="M20 15.2A8 8 0 1 1 8.8 4 6.5 6.5 0 0 0 20 15.2Z"/>'),
    sun: svg('<circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    vote: svg('<path d="M7 4h10l2 6-7 10-7-10 2-6Z"/><path d="M8 10h8"/>'),
    lock: svg('<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>')
});
