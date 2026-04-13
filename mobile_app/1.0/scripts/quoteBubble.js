/*
Copyright 2026 Sadra Mohtadi

Licensed under the Apache License, Version 2.0
http://www.apache.org/licenses/LICENSE-2.0
*/

// This is a pretty simple function to show quote bubbles on different elements for info
function quoteBubble() {
    return {
        create: function (element, text, extraW = 0, extraH = 0, offestX = 0, offestY = 0, side = 'top', color = '#fff') {

            if (document.getElementById("quoteBubble")) {
                document.getElementById("quoteBubble").remove();
            }

            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;

            if (!document.getElementById("quoteBubbleStyles")) {
                const style = document.createElement("style");
                style.id = "quoteBubbleStyles";
                style.textContent = `
                    @keyframes bubbleUp {
                        from { opacity: 0; transform: translateX(-50%) translateY(10px); }
                        to   { opacity: 1; transform: translateX(-50%) translateY(0px); }
                    }
                    @keyframes bubbleDown {
                        from { opacity: 1; transform: translateX(-50%) translateY(0px); }
                        to   { opacity: 0; transform: translateX(-50%) translateY(10px); }
                    }
                `;
                document.head.appendChild(style);
            }

            const div = document.createElement('div');
            div.id = "quoteBubble";

            Object.assign(div.style, {
                position: 'fixed',
                left: `${centerX + offestX}px`,
                top: '-9999px',
                transform: 'translateX(-50%)',
                backgroundColor: '#333',
                color: `${color}`,
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: 'sans-serif',
                whiteSpace: 'normal',
                width: `${rect.width + extraW}px`,
                maxWidth: `${rect.width + extraW}px`,
                minHeight: extraH > 0 ? `${extraH}px` : '',
                boxSizing: 'border-box',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                zIndex: '9999999999',
                animation: 'bubbleUp 0.2s ease-out forwards',
            });

            const arrowTop = `
                <span style="
                    position: absolute;
                    bottom: -10px;
                    left: calc(50% - ${offestX}px);
                    transform: translateX(-50%);
                    display: block;
                    width: 0; height: 0;
                    border-left: 10px solid transparent;
                    border-right: 10px solid transparent;
                    border-top: 10px solid #333;
                "></span>`;

            const arrowBottom = `
                <span style="
                    position: absolute;
                    top: -10px;
                    left: calc(50% - ${offestX}px);
                    transform: translateX(-50%);
                    display: block;
                    width: 0; height: 0;
                    border-left: 10px solid transparent;
                    border-right: 10px solid transparent;
                    border-bottom: 10px solid #333;
                "></span>`;

            div.innerHTML = `${text} ${side === 'bottom' ? arrowBottom : arrowTop}`;

            document.body.appendChild(div);

            const bubbleHeight = div.getBoundingClientRect().height;

            if (side === 'bottom') {
                div.style.top = `${rect.bottom + 12 + offestY}px`;
            } else {
                div.style.top = `${rect.top - bubbleHeight - 12 + offestY}px`;
            }

            const outsideClickHandler = (event) => {
                if (!div.contains(event.target)) {
                    div.style.animation = 'bubbleDown 0.15s ease-in forwards';
                    setTimeout(() => {
                        div.remove();
                        document.removeEventListener('mousedown', outsideClickHandler);
                    }, 151);
                }
            };

            setTimeout(() => {
                document.addEventListener('mousedown', outsideClickHandler);
            }, 0);
        }
    }
}