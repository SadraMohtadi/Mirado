/*
Copyright 2026 Sadra Mohtadi

Licensed under the Apache License, Version 2.0
http://www.apache.org/licenses/LICENSE-2.0
*/

// This file houses all the required event listeners that are called repeatedly throughout the code.
const implementEventListener = {
    searchResultBar: function (type){
        const searchResults = document.querySelector('.searchResults');
        const resultList = document.querySelector(`.resultList.${type}`);
        const dragHandle = document.querySelector(`.resultList.${type} .result#hide`);
                
        let startY = 0;
        let currentY = 0;
        let dragging = false;
        let maxHeight = 0;
                
        function getSheetHeight() {
            return resultList.getBoundingClientRect().height;
        }
        
        function closeSheet() {
            // animate down
            resultList.style.transition = 'transform 0.3s ease';
            resultList.style.transform = 'translateY(100%)';
        
            searchResults.style.backdropFilter = 'blur(0px)';
            searchResults.style.webkitBackdropFilter = 'blur(0px)';
            searchResults.style.pointerEvents = 'none';
        
            // wait for animation to finish, THEN hide
            resultList.addEventListener('transitionend', function handler() {
                searchResults.style.display = 'none';
                resultList.removeEventListener('transitionend', handler);
            });

            freezeCamera();
        }
        
        
        function openSheet() {
            searchResults.style.pointerEvents = 'auto';
            resultList.style.display = 'flex';
            resultList.style.transform = 'translateY(0)';
            searchResults.style.backdropFilter = `blur(4px)`;
            searchResults.style.webkitBackdropFilter = `blur(4px)`;
        }
        
        dragHandle.addEventListener('pointerdown', (e) => {
            resultList.style.display = 'flex';
            resultList.style.transition = 'none'; // important
            dragging = true;
            startY = e.clientY;
            maxHeight = getSheetHeight();
            resultList.classList.add('dragging');
            searchResults.style.pointerEvents = 'auto';
            dragHandle.setPointerCapture(e.pointerId);
        });
        
        
        
        dragHandle.addEventListener('pointermove', (e) => {
            if (!dragging) return;
        
            currentY = e.clientY - startY;
        
            if (currentY < 0) currentY = 0;
            if (currentY > maxHeight) currentY = maxHeight;
        
            resultList.style.transform = `translateY(${currentY}px)`;
        
            const progress = currentY / maxHeight;
            const blurAmount = 4 * (1 - progress);
        
            searchResults.style.backdropFilter = `blur(${blurAmount}px)`;
            searchResults.style.webkitBackdropFilter = `blur(${blurAmount}px)`;
        });
        
        dragHandle.addEventListener('pointerup', () => {
            dragging = false;
            resultList.classList.remove('dragging');
        
            const threshold = maxHeight * 0.3;
        
            if (currentY > threshold) {
                closeSheet();
            } else {
                resultList.style.transform = `translateY(0)`;
                searchResults.style.backdropFilter = `blur(4px)`;
                searchResults.style.webkitBackdropFilter = `blur(4px)`;
            }
        
            currentY = 0;
        });
    },
    showMoreBtn: function(){
        const searchResults = document.querySelector('.searchResults');
        // Save original display state
        const originalDisplay = window.getComputedStyle(searchResults).display;
        // If hidden, temporarily show it for measurement
        if (originalDisplay === "none") {
            searchResults.style.display = "flex";
            searchResults.style.visibility = "hidden"; // invisible but measurable
        }
        // Select all result cards
        const results = document.querySelectorAll('.result');
        const viewButtons = document.querySelectorAll('.result #viewMore');
        // Freeze the heights
        results.forEach(card => {
            const shortInfo = card.querySelector('.shortInfo');
            if (!shortInfo) return;
            const exactHeight = shortInfo.getBoundingClientRect().height + "px";
            shortInfo.style.height = exactHeight;
            shortInfo.style.flex = "0 0 auto";
        });
        // Restore original hidden state
        if (originalDisplay === "none") {
            searchResults.style.display = "none";
            searchResults.style.visibility = "";
        }
        // Toggle logic
        viewButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.stopPropagation();
                const resultCard = this.closest('.result');
                resultCard.classList.toggle('expanded');
                if (resultCard.classList.contains('expanded')) {
                    this.innerHTML = '<i class="fa fa-angle-double-down" aria-hidden="true"></i> View Less';
                } else {
                    this.innerHTML = '<i class="fa fa-angle-double-up" aria-hidden="true"></i> View More';
                }
            });
        });
    }
}