/*
Copyright 2026 Sadra Mohtadi

Licensed under the Apache License, Version 2.0
http://www.apache.org/licenses/LICENSE-2.0
*/

// All the functions required for a search to happen
const search = {
    // Search progress system
    progress: function(){
         return {
            // Show it
            begin: function (type){
                document.querySelector(`.content .searchResults .resultList.${type}`).innerHTML = `
                <div class="result" id="hide"><div class="line"></div></div>
                <br>
                <i id="searchAnim" class="fa-solid fa-magnifying-glass"></i>
                <br>
                <p id="searchProgress" style="transition: 0.4s ease all;">Searching...</p>
                `;
                implementEventListener.searchResultBar(`${type}`);
                search.showResults(type);
            },
            hide: function(type){
                return new Promise((resolve) => {
                    document.querySelector(`.content .searchResults .resultList.${type} #searchAnim`).style.animation = `fade-out 0.4s ease-out`;
                    document.querySelector(`.content .searchResults .resultList.${type} #searchProgress`).style.animation = `fade-out 0.4s ease-out`;
                    
                    setTimeout(() => {
                        document.querySelector(`.content .searchResults .resultList.${type} #searchAnim`).remove();
                        document.querySelector(`.content .searchResults .resultList.${type} #searchProgress`).remove();
                        document.querySelector(`.content .searchResults .resultList.${type}`).innerHTML = 
                            '<div class="result" id="hide"><div class="line"></div></div>';
                        resolve();
                    }, 450);
                });
            },
            // Update it in different stages
            update: function (status){
                var currentStatus = null;
                const searchPhrases = {
                    1: ['Uploading...'],
                    2: ['Searching...'],
                    3: ['Sorting results...'],
                    4: ['Creating dynamic summary...'],
                    5: ['Double checking prices...'],
                    6: ['Analyzing image...']
                };
            
                const el = document.querySelector('.content .searchResults .resultList #searchProgress');
            
                if (!searchPhrases[status] || status === currentStatus) return;
            
                currentStatus = status;

                // Each phrase gets picked randomly
                // And yes there's one phrase per stage at the moment   
            
                const phrases = searchPhrases[status];
                const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
            
                el.style.opacity = '0';
            
                setTimeout(() => {
                    el.textContent = randomPhrase;
                    el.style.opacity = '1';
                }, 400); 
            }
        }
    },
    // This function analyzes all the results depending on their type
    sortResults: function (){
        return{
            // Sort results by values like price, ratings, source etc...
            normal: function(results, extraKeywords = [], limit = 8, type = sourceMap.DEFAULT){
            
                if (!Array.isArray(results) || !results.length) return [];
            
                let keywordArray;
                            
                if (Array.isArray(extraKeywords)) {
                    keywordArray = extraKeywords;
                } else if (typeof extraKeywords === "string") {
                    keywordArray = extraKeywords.split(/\s+/); // turn "nike hoodie" → ["nike","hoodie"]
                } else {
                    keywordArray = [];
                }
                
                const allKeywords = keywordArray
                    .filter(k => typeof k === "string")
                    .map(k => k.toLowerCase());            
                // Default metrics
                const priceValues = results
                    .filter(r => r.price?.value)
                    .map(r => parseFloat(r.price.value.replace(/[^0-9.]/g, '')))
                    .filter(v => !isNaN(v));
            
                const minPrice = priceValues.length ? Math.min(...priceValues) : 0;
                const maxPrice = priceValues.length ? Math.max(...priceValues) : 1;
            
                function computeKeywordScore(item) {
                    if (!allKeywords.length) return 0.5;
                
                    const title = (item.title || '').toLowerCase();
                    const description = (item.description || '').toLowerCase();
                    const category = (item.category || '').toLowerCase();
                
                    let score = 0;
                
                    allKeywords.forEach(keyword => {
                        if (title.includes(keyword)) score += 2;        // 🔥 title priority
                        else if (description.includes(keyword)) score += 1;
                        else if (category.includes(keyword)) score += 1;
                    });
                
                    return score / (allKeywords.length * 2); // normalize 0–1
                }
            
                function computeScore(item) {
                    const hasPrice = item.price?.value ? 1 : 0;
                
                    const Rn = (item.rating || 0) / 5;
                    const Sn = type[item.source] ?? 0.3;
                
                    let Pn = 0;
                    if (hasPrice) {
                        const P = parseFloat(item.price.value.replace(/[^0-9.]/g, ''));
                        if (!isNaN(P)) {
                            const normalized = (P - minPrice) / (maxPrice - minPrice || 1);
                            Pn = Math.pow(1 - normalized, 2);
                        }
                    }
                
                    const Kn = computeKeywordScore(item);
                
                    const preferedResults = JSON.parse(localStorage.getItem("searchSettings"));
                
                    const baseScore =
                        (preferedResults.weights.source * Sn) +
                        (preferedResults.weights.price * Pn) +
                        (preferedResults.weights.ratings * Rn) +
                        (preferedResults.weights.keywords * Kn);
                
                    const pricePenalty = hasPrice ? 1 : 0.85;
                
                    return baseScore * pricePenalty;
                }
            
                // Score everything
                results.forEach(r => r._score = computeScore(r));
            
                // Sort entire dataset
                const sorted = [...results].sort((a, b) => b._score - a._score);
            
                // Apply price ratio rule
                const priced = sorted.filter(r => r.price?.value);
                const nonPriced = sorted.filter(r => !r.price?.value);
            
                const pricedToShow = Math.min(
                    Math.round((priced.length / sorted.length) * limit),
                    priced.length
                );
            
                return [
                    ...priced.slice(0, pricedToShow),
                    ...nonPriced.slice(0, limit - pricedToShow)
                ];
            },
            // This is a little more complicated, we still check prices, ratings and sources but we also extract and use keywords.
            thrift: function (results, extraKeywords = [], limit = 8, type = sourceMap.MARKETPLACE){
                if (!Array.isArray(results) || !results.length) return [];
            
                if (!Array.isArray(extraKeywords)) {
                    extraKeywords = typeof extraKeywords === 'string' && extraKeywords.trim()
                        ? extraKeywords.split(';').map(k => k.trim()).filter(Boolean)
                        : [];
                }

                function extractKeywords(text) {
                    return (text || "")
                        .toLowerCase()
                        .replace(/[^a-z0-9\s]/g, "")
                        .split(/\s+/)
                        .filter(word => word.length > 2);
                }
            
                // 🔹 Build keyword frequency map (from results)
                const keywordCounts = {};
            
                results.forEach(item => {
                    const text = `${item.title || ""} ${item.description || ""}`;
                    const words = extractKeywords(text);
                
                    words.forEach(word => {
                        keywordCounts[word] = (keywordCounts[word] || 0) + 1;
                    });
                });
            
                // 🔹 Top auto-detected keywords (market signal)
                const sortedKeywords = Object.entries(keywordCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([word]) => word);
            
                const topKeywords = sortedKeywords.slice(0, 3);
            
                // 🔹 Merge with analyzed keywords (your main signal now)
                const allKeywords = [
                    ...topKeywords,
                    ...extraKeywords.map(k => k.toLowerCase()),
                ].map(k => k.toLowerCase());
            
                // 🔹 Only keep priced results
                const pricedResults = results.filter(r => r.price?.value);
            
                function computeKeywordScore(item) {
                    if (!allKeywords.length) return 0.5;
                
                    const title = (item.title || "").toLowerCase();
                    const description = (item.description || "").toLowerCase();
                
                    let score = 0;
                
                    allKeywords.forEach(keyword => {
                        if (title.includes(keyword)) score += 2;        // 🔥 title boost
                        else if (description.includes(keyword)) score += 1;
                    });
                
                    return score / (allKeywords.length * 2); // normalize to 0–1
                }
            
                function computeScore(item) {
                    const Sn = type[item.source] ?? 0.3;
                    const Kn = computeKeywordScore(item);
                
                    const preferedResults = JSON.parse(localStorage.getItem("searchSettings"));
                
                    return (
                        (preferedResults.weights.source * Sn) +
                        (preferedResults.weights.keywords * Kn)
                    );
                }
            
                pricedResults.forEach(r => {
                    r._score = computeScore(r);
                });
            
                const sorted = [...pricedResults].sort((a, b) => b._score - a._score);
            
                return sorted.slice(0, limit);
            }
        }
    },
    // Show results
    showResults: function (type){
        const searchResults = document.querySelector('.searchResults');
        const resultList = document.querySelector(`.resultList.${type}`);

        // Make parent visible
        searchResults.style.display = 'flex';
        resultList.style.display = 'flex';
        searchResults.style.pointerEvents = 'auto';
    
        // Instantly reset to bottom without animation
        resultList.style.transition = 'none';
        resultList.style.transform = 'translateY(100%)';
    
        // Force layout so browser commits it
        void resultList.offsetHeight;
    
        // Animate up
        resultList.style.transition = 'transform 0.3s ease';
        resultList.style.transform = 'translateY(0)';
    
        searchResults.style.backdropFilter = 'blur(4px)';
        searchResults.style.webkitBackdropFilter = 'blur(4px)';
    },
    renderAIResults: function (data){
        const dynamicInfo = document.querySelector(".dynamicInfo");
        const prosConsContainer = document.querySelector(".prosAndCons .value");

        dynamicInfo.innerHTML = "";
        prosConsContainer.innerHTML = "";

        // CATEGORY (default icon)
        if (data.category) {
            createInfoBox(
                "Category",
                data.category,
                "fa-solid fa-layer-group"
            );
        }

        // USED_FOR -> Use case
        if (data.used_for) {
            createInfoBox(
                "Used for",
                data.used_for,
                "fa-solid fa-wrench"
            );
        }

        function checkIcon(iconName){
            if (String(iconName).slice(0, 3).includes('fa')){
                return iconName;
            }else{
                return `fa-${iconName}`
            }
        }

        // Render dynamic icon fields
        Object.keys(data).forEach(key => {
            if (
                key === "summary" ||
                key === "category" ||
                key === "used_for" ||
                key === "pros" ||
                key === "cons"
            ) return;

            const field = data[key];
            if (!field?.value || !field?.icon) return;

            // Override icon for brand
            const iconClass = key === "brand" ? "fa-solid fa-shopping-cart" : `${checkIcon(field.icon)}`;

            createInfoBox(
                capitalize(key),
                field.value,
                iconClass
            );
        });

        // Pros
        if (Array.isArray(data.pros)) {
            data.pros.forEach(item => {
                prosConsContainer.innerHTML += `
                    <p><i class="fa-regular fa-face-smile"></i> ${capitalize(item)}</p>
                `;
            });
        }

        // Cons
        if (Array.isArray(data.cons)) {
            data.cons.forEach(item => {
                prosConsContainer.innerHTML += `
                    <p><i class="fa-regular fa-face-frown"></i> ${capitalize(item)}</p>
                `;
            });
        }

        function createInfoBox(title, value, iconClass) {
            const box = document.createElement("div");
            box.className = "infoBox";

            box.innerHTML = `
                <div class="title">
                    <p>
                        <i style="font-size: calc(11 * var(--vhUnit)); color: #04243d;"
                           class="fa-solid ${iconClass}" aria-hidden="true"></i> ${title}
                    </p>
                </div>
                <div class="value">
                    <p>${capitalize(value)}</p>
                </div>
            `;

            dynamicInfo.appendChild(box);
        }
    },
    // Render the bar chart using chart.js for the Thrift comparisons
    renderBarChart: function(containerId, data){
        const container = document.getElementById(containerId);
         
        const canvasId = containerId + "_canvas";
        container.innerHTML = `<canvas style="width: 100% height: 100%;" id="${canvasId}"></canvas>`;
        
        const canvas = document.getElementById(canvasId);
        const chart = new Chart(canvas, {
          type: "bar",
          data: {
            labels: data.map(d => d.source),
            datasets: [{
              label: "Price ($)",
              data: data.map(d => d.price.extracted_value),            
              backgroundColor: "steelblue",
              barPercentage: 0.6
            }]
          },
          options: {
            scales: {
              y: {
                ticks:{
                  callback: (value) => "$" + value
                }
              }
            }
          }
        });
        
        canvas.addEventListener("touchstart", (e) => {
          const touch = e.touches[0];
          const rect = canvas.getBoundingClientRect();
          const x = touch.clientX - rect.left;
          const y = touch.clientY - rect.top;
        
          const points = chart.getElementsAtEventForMode(
            { offsetX: x, offsetY: y, native: e },
            "nearest", { intersect: true }, false
          );
          if (!points.length) return;
        
          chart.tooltip.setActiveElements(
            points.map(p => ({ datasetIndex: p.datasetIndex, index: p.index })),
            { x, y }
          );
          chart.update();
        }, { passive: true });
    },
    // Temporary code, the complete verion won't need this
    checkAIServerConnection: async function (ip){
        const server = "http://" + ip + ":8000";

        try{
            const res = await fetch(server + "/prompt",{
                method:"POST",
                headers:{
                    "Content-Type":"application/json"
                },
                body: JSON.stringify({input:"This is a test!"})
            });
        
            if(res.ok){
                return 200;
            }
        
        }catch(e){
            if (String(e) === 'TypeError: Failed to fetch'){
                return `${e} (Python server possibly not running)`
            }else{
                return e;
            }
        }
    },
    // Run a quick algorithm to find the best result title to use for AI summary
    findBestAITitle: function(searchData){
        const matches = searchData.visual_matches;
        const topResult = matches[0];
      
        const allTokens = matches.flatMap(m =>
          m.title.toLowerCase().match(/\b[a-z0-9][a-z0-9]+\b/g) || []
        );
      
        const tokenFrequency = allTokens.reduce((acc, token) => {
          acc[token] = (acc[token] || 0) + 1;
          return acc;
        }, {});
      
        const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'buy', 'in', 'of', 'x', 'ca', 'a', 'by', 'near', 'me', 'online', 'order', 'delivery', 'pack', 'cans', 'can', 'bottles', 'bottle']);
      
        function getMostCommonVariant(tokens, category) {
          const categoryTokens = tokens.filter(t => category.test(t));
          if (!categoryTokens.length) return null;
          return categoryTokens.sort((a, b) => (tokenFrequency[b] || 0) - (tokenFrequency[a] || 0))[0];
        }
      
        const mostCommonSize = getMostCommonVariant(allTokens, /^\d+(ml|l|fl|oz|g|kg)$/i);
        const mostCommonCount = getMostCommonVariant(allTokens, /^\d+$/);
      
        function levenshtein(a, b) {
          const dp = Array.from({ length: a.length + 1 }, (_, i) =>
            Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
          );
          for (let i = 1; i <= a.length; i++)
            for (let j = 1; j <= b.length; j++)
              dp[i][j] = a[i-1] === b[j-1]
                ? dp[i-1][j-1]
                : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
          return dp[a.length][b.length];
        }
      
        function fuzzyFrequency(token) {
          if (tokenFrequency[token]) return tokenFrequency[token];
          let bestFreq = 0;
          let bestDist = Infinity;
          for (const known of Object.keys(tokenFrequency)) {
            if (Math.abs(known.length - token.length) > 2) continue;
            const dist = levenshtein(token, known);
            if (dist <= 2 && dist < bestDist) {
              bestDist = dist;
              bestFreq = tokenFrequency[known];
            }
          }
          return bestFreq * (bestDist === 0 ? 1 : bestDist === 1 ? 0.75 : 0.5);
        }
      
        function scoreTitle(title) {
          const tokens = title.toLowerCase().match(/\b[a-z0-9][a-z0-9]+\b/g) || [];
          const meaningfulTokens = tokens.filter(t => !stopWords.has(t));
      
          const correlationScore = meaningfulTokens.reduce((sum, token) =>
            sum + Math.sqrt(fuzzyFrequency(token)), 0);
      
          const uniquenessBonus = meaningfulTokens.reduce((sum, token) =>
            sum + (tokenFrequency[token] === 1 ? 2 : 0), 0);
      
          const sizeBonus = mostCommonSize && tokens.includes(mostCommonSize) ? 5 : 0;
          const countBonus = mostCommonCount && tokens.includes(mostCommonCount) ? 3 : 0;
      
          const freqValues = Object.values(tokenFrequency).sort((a, b) => b - a);
          const top20Threshold = freqValues[Math.floor(freqValues.length * 0.2)] || 1;
          const keyTermBonus = meaningfulTokens.reduce((sum, token) =>
            sum + (fuzzyFrequency(token) >= top20Threshold ? 3 : 0), 0);
      
          const lengthScore = Math.log(title.length + 1) * 2;
      
          return correlationScore + uniquenessBonus + sizeBonus + countBonus + keyTermBonus + lengthScore;
        }
      
        // Score and pick the best candidate
        const scored = matches
          .map(m => ({ title: m.title, score: scoreTitle(m.title) }))
          .sort((a, b) => b.score - a.score);
      
        const candidateTitle = scored[0].title;
      
        // Verify candidate tokens against the top result, strip anything unverifiable
        const topTokens = topResult.title.toLowerCase().match(/\b[a-z0-9][a-z0-9]+\b/g) || [];
        const sourceTokens = topResult.source.toLowerCase().match(/\b[a-z0-9][a-z0-9]+\b/g) || [];
        const candidateWords = candidateTitle.match(/\S+/g) || [];
      
        const verifiedTitle = candidateWords
          .filter(word => {
            const clean = word.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (clean.length <= 1) return false;
            const matchesTop = topTokens.some(t => levenshtein(clean, t) <= 2);
            const matchesSource = sourceTokens.some(t => levenshtein(clean, t) <= 2);
            return matchesTop && !matchesSource;
          })
          .join(' ');
      
        return verifiedTitle || candidateTitle;
    },
    // This function gets the AI sumamry of a product from the server.
    // The IP will be removed in the final version, it's only here for the AI server to be ran locally.
    fetchDynamicInfo: async function(title, ip){
        const server = "http://" + ip + ":8000";

        const res = await fetch(server + "/prompt",{
            method: "POST",
            headers: { 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({
              input: title
            })
        });
    
        const data = await res.json();
        let finalJson = data.response;
        finalJson = finalJson.replace(/^```json\s*/, "").replace(/```$/, "");

        return JSON.parse(finalJson.replace(/```json\n?|```/g, "").trim());
    },
    // Analyze image to get keywords
    analyzeImage: async function (base64Image, ip){
        const image = base64Image.split(',')[1];
        
          const data = await (await fetch(`http://${ip}:8001/prompt`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ image })
          })).json();
        
          return data.response;
    },
    // Parse and display the data for regular searches
    parseData: async function(givenData){
        this.progress().update(3);
        const visualMatches = Array.isArray(givenData?.visual_matches)
            ? givenData.visual_matches
            : [];

        const resultList = document.querySelector('.content .searchResults .resultList.normal');

        if (!visualMatches.length) {
            // THROW AN ERROR
            this.showResults();
            alert('no results!')
            return;
        }

        const finalResults = this.sortResults().normal(visualMatches, 8);

        const fragment = document.createDocumentFragment();

        finalResults.forEach((data, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'result';
            wrapper.style.height = index === 0 ? 'auto' : 'calc(60 * var(--vhUnit))';
            wrapper.style.opacity = '0';

            const bestBadge = index === 0
                ? `<span id="bestResult">
                       <i class="fa-solid fa-ranking-star"></i> Best result
                   </span>`
                : '';
               
            wrapper.innerHTML = `
                <div class="shortInfo" style="height: ${index === 0 ? 'calc(60 * var(--vhUnit))' : '100%'};">
                    <img src="${data.image}" alt="item-preview" id="preview">
                    <div class="moreInfo">
                        <p class="${index === 0 ? 'productSummary' : ''}" style='${bestBadge ? `font-size:16px;` : `font-size:12px;`}'>
                            ${data.title ? `${bestBadge}${data.title}` : ''}
                            <span id="source">From ${data.source || 'Unknown'}</span>
                        </p>
                    </div>
                    <button>
                        ${data.price?.value ? `${data.price.value}<br>` : ''}
                        <span>BUY</span>
                    </button>
                </div>
                ${index === 0 && currentAIServerStatus === AIServerStatus.CONNECTED? `
                <div class="longInfo">
                    <div class="dynamicInfo">
                        <div class="infoBox">
                            <div class="title">
                                <p><i style="font-size: calc(11 * var(--vhUnit)); color: #04243d;" class="fa-solid fa fa-layer-group" aria-hidden="true"></i> Category</p>
                            </div>
                            <div class="value"><p>Kitchen Tools</p></div>
                        </div>
                        <!-- ...rest of your infoBox divs... -->
                    </div>
                    <div class="prosAndCons">
                        <div class="title">
                            <p><i style="font-size: calc(9 * var(--vhUnit)); color: #04243d;" class="fa-solid fa fa-plus-minus" aria-hidden="true"></i> Pros & cons</p>
                        </div>
                        <div class="value">
                            <p><i class="fa-regular fa-face-frown"></i> Negative</p>
                            <p><i class="fa-regular fa-face-smile"></i> Positive</p>
                            <p><i class="fa-regular fa-face-meh"></i> Neutral</p>
                        </div>
                    </div>
                    <p id="ai_warning">Dynamic Results may not be 100% accurate.</p>
                </div>
                <button id="viewMore"><i class="fa fa-angle-double-up" aria-hidden="true"></i> View less</button>
                ` : ''}
            `;
            
            wrapper.querySelector("button:not(#viewMore)").addEventListener("click", () => {
                if (data.link) window.open(data.link);
            });
        
            fragment.appendChild(wrapper);
        });
        
        // This code is also temporary, the goal is to always provide the user with AI summaries unless something goes wrong.
        if (localStorage.getItem('AIServerAddress') && currentAIServerStatus === AIServerStatus.CONNECTED){
            this.progress().update(4)
            const jsonToRender = await search.fetchDynamicInfo(this.findBestAITitle(givenData), localStorage.getItem('AIServerAddress'));
            if (jsonToRender){
                document.querySelector('.content .searchResults .resultList.normal #searchAnim').style.animation = 'fade-out 0.4s ease-out';
                document.querySelector('.content .searchResults .resultList.normal #searchProgress').style.animation = 'fade-out 0.4s ease-out';
                
                await this.progress().hide('normal');
                resultList.appendChild(fragment);
            
                implementEventListener.searchResultBar('normal');
                document.querySelectorAll('.content .searchResults .resultList.normal .result:not(#hide)')
                .forEach((e) => {
                    e.style.opacity = '';
                    e.style.animation = 'fade-in 0.4s ease-in forwards';
                });                
                this.renderAIResults(jsonToRender);
                document.querySelector('.productSummary').innerHTML=(`<span id="bestResult">
                   <i class="fa-solid fa-ranking-star"></i> Best result
                    </span>${jsonToRender.summary}`)
                implementEventListener.showMoreBtn();
            }
        }else{
            this.progress().hide('normal');

            document.querySelector('.content .searchResults .resultList.normal').innerHTML = '<div class="result" id="hide"><div class="line"></div></div>';
            resultList.appendChild(fragment);
        
            implementEventListener.searchResultBar('normal');
            document.querySelectorAll('.content .searchResults .resultList.normal .result:not(#hide)')
            .forEach((e) => {
                e.style.opacity = '';
                e.style.animation = 'fade-in 0.4s ease-in forwards';
            });        
        }
    },
    // Parse the data for a Thrift search
    parseThriftData: async function(givenData){
        this.progress().update(3);
        const visualMatches = Array.isArray(givenData?.visual_matches)
            ? givenData.visual_matches
            : [];
        
        const resultList = document.querySelector('.content .searchResults .resultList.thrift');

        if (!visualMatches.length){
            // THROW AN ERROR
            alert('no results!')
            return;
        }

        const finalResults = this.sortResults().thrift(visualMatches, 8);
            
        const fragment = document.createDocumentFragment();
            
        if (!finalResults.length) {
            alert('no results!');
            return;
        }
        
        const wrapper = document.createElement('div');
        
        wrapper.className = 'result';
        wrapper.style.opacity = '0';
        wrapper.innerHTML =
        `
            <div class="shortInfo">
                <img src="${finalResults[0].image || ''}">
                <p><span id="thriftBadge"><i class="fa-solid fa-chart-simple"></i> Thrift</span><br>${finalResults[0].title}</p>
            </div> 
            <div id="chartTarget"></div>
        `;

        const allSources = document.createElement('div');
        allSources.className = 'sources';
        
        finalResults.forEach((data, index) => {
            allSources.innerHTML += 
            `
            <div class="source">
                <img src="${data.image}">
                <p>
                    ${data.title}
                    <br>
                    <span id="from">From ${data.source}</span>
                </p>
                <button onclick="window.open('${data.link}')">
                    ${data.price.value}<br>BUY
                </button>
            </div>
            `
        });

        wrapper.appendChild(allSources);

        fragment.appendChild(wrapper);

        await this.progress().hide('thrift');

        resultList.innerHTML = '';
        resultList.innerHTML = `<div class="result" id="hide"><div class="line"></div></div>`;
        resultList.appendChild(fragment);
        this.renderBarChart('chartTarget', finalResults);

        // Fit all text into size

        const paragraphs = document.querySelectorAll(
          '.content .searchResults .resultList.thrift .sources .source p'
        );

        function fitText(el) {
          let size = 16; // start size in px
          el.style.fontSize = size + 'px';
          while (el.scrollHeight > el.offsetHeight && size > 1) {
            size--;
            el.style.fontSize = size -2 + 'px';
          }
        }

        paragraphs.forEach(fitText);

        const p = document.querySelector(
          '.content .searchResults .resultList.thrift .shortInfo p'
        );

        function fitText(el) {
          let size = 16; // start size in px
          el.style.fontSize = size + 'px';
          while ((el.scrollWidth > el.offsetWidth || el.scrollHeight > el.offsetHeight) && size > 1) {
            size--;
            el.style.fontSize = size + 'px';
          }
        }

        fitText(p);

        implementEventListener.searchResultBar('thrift');
        document.querySelectorAll('.content .searchResults .resultList.thrift .result:not(#hide)')
        .forEach((e) => {
            e.style.opacity = '';
            e.style.animation = 'fade-in 0.4s ease-in forwards';
        })
    }
};