/*
Copyright 2026 Sadra Mohtadi

Licensed under the Apache License, Version 2.0
http://www.apache.org/licenses/LICENSE-2.0
*/

// All the code for the settings section
function settings() {
    return {
        // All the code needed for the engine settings in the settings tab
        engineSettings: function(){
            const list = document.querySelector(".settings .engineSettings .resultPrioritizer #priorityList");
            return{
                show: function(){
                    const saved = localStorage.getItem("searchSettings");
                    
                    // This will be removed in the final version.
                    const aiSummaryCheckbox = document.querySelector('.settings .engineSettings input[type="checkbox"][value="aiSummary"]');
                    const aiImageAnalyzerCheckbox = document.querySelector('.settings .engineSettings input[type="checkbox"][value="aiImageAnalyzer"]');
                    if (saved){
                        this.importJson(saved);
                    }
                    // This will be removed in the final version.
                    if (localStorage.getItem("AIServerAddress")){
                        
                    }else{
                        aiSummaryCheckbox.checked = false;
                        aiSummaryCheckbox.disabled = true;
                        aiSummaryCheckbox.closest('label').addEventListener('click', () => {
                            quoteBubble().create(aiSummaryCheckbox.closest('label'), "Local AI Server isn't configured. Follow the <a href='https://github.com/SadraMohtadi/Mirado'>GitHub rep</a> to configure it.");
                        });              
                        
                        aiImageAnalyzerCheckbox.checked = false;
                        aiImageAnalyzerCheckbox.disabled = true;
                        aiImageAnalyzerCheckbox.closest('label').addEventListener('click', () =>{
                            quoteBubble().create(aiImageAnalyzerCheckbox.closest('label'), "Local AI Server isn't configured. Follow the <a href='https://github.com/SadraMohtadi/Mirado'>GitHub rep</a> to configure it.")
                        })
                    }
                    document.querySelectorAll('.settings .option').forEach((e) => {e.style.display='none'});
                    document.querySelector('.settings .engineSettings').style.display = 'block';
                    document.querySelector('.settings').style.height = '90%';
                    document.querySelector('.settings').style.marginTop = '10%';
                    document.querySelector('header').style.display = 'none';
                    this.enableDragLogic();
                },
                hide: function(){
                    localStorage.setItem("searchSettings", this.exportJson());
                    document.querySelectorAll('.settings .option').forEach((e) => {e.style.display='flex'});
                    document.querySelector('.settings .engineSettings').style.display = 'none';
                    document.querySelector('.settings').style.height = '80%';
                    document.querySelector('.settings').style.marginTop = '20%' ;
                    document.querySelector('header').style.display = 'flex';
                },
                enableDragLogic: function () {
                    let dragged = null;
                    const items = list.querySelectorAll(".priority-item");
                    // DESKTOP DRAG SUPPORT
                    items.forEach(item => {
                        item.setAttribute("draggable", true);
                    
                        item.addEventListener("dragstart", () => {
                            dragged = item;
                            item.classList.add("dragging");
                        });
                    
                        item.addEventListener("dragend", () => {
                            item.classList.remove("dragging");
                        });
                    });
                    list.addEventListener("dragover", e => {
                        e.preventDefault();
                        const after = getDragAfterElement(list, e.clientY);
                        if (!dragged) return;
                        if (after == null) list.appendChild(dragged);
                        else list.insertBefore(dragged, after);
                    });
                    // MOBILE TOUCH SUPPORT
                    items.forEach(item => {
                    
                        item.addEventListener("touchstart", e => {
                            dragged = item;
                            item.classList.add("dragging");
                        }, { passive: true });
                        item.addEventListener("touchmove", e => {
                            if (!dragged) return;
                        
                            e.preventDefault(); // prevent scrolling
                        
                            const touch = e.touches[0];
                            const after = getDragAfterElement(list, touch.clientY);
                        
                            if (after == null) list.appendChild(dragged);
                            else list.insertBefore(dragged, after);
                        
                        }, { passive: false });
                    
                        item.addEventListener("touchend", () => {
                            if (dragged) {
                                dragged.classList.remove("dragging");
                                dragged = null;
                            }
                        });
                    });
                    // SHARED POSITION LOGIC
                    function getDragAfterElement(container, y) {
                        const elements = [...container.querySelectorAll(".priority-item:not(.dragging)")];
                    
                        return elements.reduce((closest, child) => {
                            const box = child.getBoundingClientRect();
                            const offset = y - box.top - box.height / 2;
                        
                            if (offset < 0 && offset > closest.offset) {
                                return { offset: offset, element: child };
                            } else {
                                return closest;
                            }
                        }, { offset: Number.NEGATIVE_INFINITY }).element;
                    }
                },
                // Export all the user's search settings as JSON to upload to the server.
                exportJson: function () {
                    function normalizeKey(str){
                        return str
                            .trim()
                            .toLowerCase()
                            .replace(/\s+/g, "_")     // spaces -> _
                            .replace(/[^\w_]/g, "");  // remove non-alphanumeric characters
                    }
                
                    const features = [...document.querySelectorAll(".settings .engineSettings .features input[type='checkbox']:not(#advancedToggle)")]
                        .filter(cb => cb.checked)
                        .map(cb => cb.value);
                
                    const selectedRadio = document.querySelector(".settings .engineSettings .searchMode input[name='mode']:checked");
                    const mode = selectedRadio ? selectedRadio.value : null;
                    
                    const priority = [...list.children]
                        .map(item => normalizeKey(item.innerText));
                
                    // Generate weights based on ranking position
                    const total = priority.length;
                    const weightStep = 1 / ((total * (total + 1)) / 2); // normalize triangular sum
                
                    const weights = {};
                    priority.forEach((item, index) => {
                        const rankWeight = (total - index) * weightStep;
                        weights[item] = parseFloat(rankWeight.toFixed(4));
                    });
                
                    const data = {
                        priority,
                        weights,
                        features,
                        mode
                    };
                
                    return JSON.stringify(data);
                },
                // Import all of the user's search settings back from the server.
                importJson: function (inputData){
                    try{
                        const data = JSON.parse(inputData);
                
                        // Restore priority order
                        if (data.priority){
                            const items = [...list.querySelectorAll(".priority-item")];
                
                            data.priority.forEach(name=>{
                                const match = items.find(i => i.innerText.trim() === name);
                                if (match) list.appendChild(match);
                            });
                        }
                
                        // Restore features
                        document.querySelectorAll(".settings .engineSettings .features input[type='checkbox']:not(#advancedToggle)")
                            .forEach(cb=>{
                                cb.checked = data.features && data.features.includes(cb.value);
                            });
                
                        // Restore mode
                        document.querySelectorAll(".settings .engineSettings .searchMode input[name='mode']")
                            .forEach(r=>{
                                r.checked = (r.value === data.mode);
                            });
                
                    } catch(e){
                        console.error(e);
                        alert("Invalid JSON!");
                    }
                }
            }
        },
        appearance: function(){
            return{
                show: function(){
                    document.querySelectorAll('.settings .option').forEach((e) => {e.style.display='none'});
                    document.querySelector('.settings .appearance').style.display = 'block';
                    document.querySelector('.settings').style.height = '90%';
                    document.querySelector('.settings').style.marginTop = '10%';
                    document.querySelector('header').style.display = 'none';
                    // Try and load previously saved configurations
                    const savedAppearanceTheme = localStorage.getItem('appearanceSettings-theme');
                    if (savedAppearanceTheme){
                        document.querySelector(`.settings .appearance .section.themeSelection #${savedAppearanceTheme}`).checked = 'checked';
                    }
    
                    document.querySelectorAll('input[name="themeSelect"]').forEach(radio => {
                        radio.addEventListener('change', function() {
                            if (this.id !== 'default'){
                                theme().apply(themes[this.id]);
                            }else{
                                theme().reset();
                            }
                        });
                    });
                },
                hide: function(){
                    document.querySelectorAll('.settings .option').forEach((e) => {e.style.display='flex'});
                    document.querySelector('.settings .appearance').style.display = 'none';
                    document.querySelector('.settings').style.height = '80%';
                    document.querySelector('.settings').style.marginTop = '20%' ;
                    document.querySelector('header').style.display = 'flex';
                    localStorage.setItem('appearanceSettings-theme', document.querySelector('.settings .appearance .section.themeSelection input[name="themeSelect"]:checked').id);
                }
            }
        },
        about: function(){
            return{
                show: function(){
                    document.querySelectorAll('.settings .option').forEach((e) => {e.style.display='none'});
                    document.querySelector('.settings .about').style.display = 'block';
                    document.querySelector('.settings').style.height = '90%';
                    document.querySelector('.settings').style.marginTop = '10%';
                    document.querySelector('header').style.display = 'none';
                },
                hide: function(){
                    document.querySelectorAll('.settings .option').forEach((e) => {e.style.display='flex'});
                    document.querySelector('.settings .about').style.display = 'none';
                    document.querySelector('.settings').style.height = '80%';
                    document.querySelector('.settings').style.marginTop = '20%' ;
                    document.querySelector('header').style.display = 'flex';
                }
            }
        }
    }
}