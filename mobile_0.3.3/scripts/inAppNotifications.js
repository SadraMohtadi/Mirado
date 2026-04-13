/*
Copyright 2026 Sadra Mohtadi

Licensed under the Apache License, Version 2.0
http://www.apache.org/licenses/LICENSE-2.0
*/

// This is a very simple in app notification system to show users different
// types of notifications
class NotificationSystem {
    constructor() {
        this.container = document.createElement('div');
        this.setupContainer();
    }

    setupContainer() {
        Object.assign(this.container.style, {
            position: 'absolute',
            bottom: '50px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: '9999',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            pointerEvents: 'none'
        });
        document.querySelector('.content').appendChild(this.container);
    }

    // Default time is 3000ms if not specified
    create(message, type, duration = 3000) {
        const config = {
            info: { bg: 'rgba(0, 150, 255, 0.2)', border: '#00d4ff', icon: 'ℹ️' },
            warn: { bg: 'rgba(255, 165, 0, 0.2)', border: '#ffae00', icon: '⚠️' },
            error: { bg: 'rgba(255, 50, 50, 0.2)', border: '#ff4d4d', icon: '🛑' }
        }[type];

        const toast = document.createElement('div');
        
        // Glossy Design
        Object.assign(toast.style, {
            minWidth: '320px',
            padding: '16px 20px',
            borderRadius: '12px',
            backgroundColor: config.bg,
            border: `1px solid ${config.border}`,
            backdropFilter: 'blur(15px)',
            webkitBackdropFilter: 'blur(15px)',
            color: '#fff',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden',
            pointerEvents: 'auto',
            animation: 'notifIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        });

        toast.innerHTML = `
            <span style="font-size: 22px; margin-right: 15px; filter: drop-shadow(0 0 5px ${config.border});">${config.icon}</span>
            <p style="margin: 0; font-size: 14px; font-weight: 500; line-height: 1.4; flex-grow: 1;">${message}</p>
            <div style="
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                width: 100%;
                background: ${config.border};
                box-shadow: 0 0 10px ${config.border};
                transform-origin: left;
                animation: seekbar ${duration}ms linear forwards;
            "></div>
        `;

        this.container.appendChild(toast);

        // Removal sequence
        setTimeout(() => {
            toast.style.transition = 'all 0.5s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px) scale(0.9)';
            setTimeout(() => toast.remove(), 500);
        }, duration);
    }

    // API Methods with duration support
    info(msg, time) { this.create(msg, 'info', time); }
    warn(msg, time) { this.create(msg, 'warn', time); }
    error(msg, time) { this.create(msg, 'error', time); }
}

// Global Animations
const style = document.createElement('style');
style.textContent = `
    @keyframes notifIn {
        from { transform: translateY(50px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    @keyframes seekbar {
        from { transform: scaleX(1); }
        to { transform: scaleX(0); }
    }
`;
document.head.appendChild(style);