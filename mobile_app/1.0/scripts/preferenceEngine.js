/*
Copyright 2026 Sadra Mohtadi

Licensed under the Apache License, Version 2.0
http://www.apache.org/licenses/LICENSE-2.0
*/


// This isn't fully implemented in the code yet...
// It's very unreliable and shaky, a new version of this is on the way.
function preferences() {
  // Simple category detection
  const CATEGORY_RULES = [
    {
      category: "Electronics",
      keywords: [
        "headphone","earbud","speaker","monitor","keyboard","mouse","laptop","tablet",
        "usb","charging","cable","hub","charger","battery","camera","drone","tv","television",
        "projector","router","wifi","bluetooth","smart","airtag","tracker","console","gaming",
        "airpod","pixel","galaxy","ipad","macbook","chromebook","gpu","cpu","ram","ssd","hard drive",
      ],
    },
    {
      category: "Food & Snacks",
      keywords: [
        "chip","crisp","bar","cookie","chocolate","candy","snack","cracker","pretzel",
        "popcorn","nut","granola","protein bar","energy bar","gummy","jerky","dried fruit",
        "coffee bean","tea","instant noodle","sauce","seasoning","spice","honey","jam",
        "cereal","oat","pancake mix","baking","flour","sugar","salt","pepper",
      ],
    },
    {
      category: "Home & Kitchen",
      keywords: [
        "pot","pan","skillet","knife","cutting board","blender","mixer","toaster","oven",
        "microwave","air fryer","instant pot","pressure cooker","coffee maker","espresso",
        "nespresso","keurig","vacuum","mop","broom","storage","container","organizer",
        "pillow","sheet","blanket","towel","curtain","candle","diffuser","humidifier",
        "mattress","rug","lamp","shelf","hook","hanger","bin","basket",
      ],
    },
    {
      category: "Fitness & Sports",
      keywords: [
        "dumbbell","barbell","kettlebell","weight","resistance band","yoga","mat","foam roller",
        "treadmill","bike","rowing","jump rope","pull-up","bench","rack","protein","supplement",
        "shaker","water bottle","hydro flask","gym","workout","running","trail","hiking",
        "smartwatch","fitness tracker","garmin","fitbit","heart rate","gps","sport","athletic",
        "cycling","swimming","soccer","basketball","tennis","golf","camping","outdoor",
      ],
    },
    {
      category: "Beauty & Care",
      keywords: [
        "moisturizer","cream","serum","lotion","sunscreen","spf","cleanser","toner","mask",
        "shampoo","conditioner","hair dryer","straightener","curler","brush","comb","razor",
        "deodorant","perfume","cologne","lip","foundation","concealer","mascara","eyeshadow",
        "blush","bronzer","nail","skincare","cerave","neutrogena","olay","revlon","l'oreal",
        "bioderma","vitamin c","retinol","niacinamide","hyaluronic",
      ],
    },
    {
      category: "Books & Media",
      keywords: [
        "book","novel","paperback","hardcover","ebook","kindle","manga","comic","graphic novel",
        "game","video game","nintendo","playstation","xbox","switch","steam","board game","card game",
        "puzzle","lego","toy","action figure","dvd","blu-ray","vinyl","record","instrument",
        "guitar","piano","ukulele","subscription","streaming","course","journal","planner",
      ],
    },
  ];

  // ─── Private State ───────────────────────────────────────────────────────
  let scores = {}; // { "CategoryName": { total: number, count: number } }

  // ─── Smart Detection ─────────────────────────────────────────────────────
  /**
   * Evaluates a title against ALL categories, counts keyword overlaps,
   * and returns the strongest match.
   */
  function analyzeTitle(title) {
    const lower = title.toLowerCase();
    
    const matches = CATEGORY_RULES
      .map(rule => {
        const hits = rule.keywords.filter(kw => lower.includes(kw));
        return { category: rule.category, keywords: hits, weight: hits.length };
      })
      .filter(m => m.weight > 0)
      .sort((a, b) => b.weight - a.weight); // highest keyword overlap first

    return {
      best: matches.length > 0 ? matches[0].category : "Other",
      matches,
      confidence: matches.length > 0 ? matches[0].weight : 0
    };
  }

  // ─── Public API ──────────────────────────────────────────────────────────
  return {
    /**
     * Record a preference rating.
     * @param {string} title - Used for auto-detection if category is omitted
     * @param {number} rating - 0 (dislike) to 1 (love)
     * @param {string} [explicitCategory] - Overrides auto-detection
     */
    rate(title, rating, explicitCategory) {
      if (typeof rating !== "number" || rating < 0 || rating > 1) {
        throw new RangeError("rating must be a number in [0, 1]");
      }

      const cat = explicitCategory || analyzeTitle(title).best;
      if (!scores[cat]) scores[cat] = { total: 0, count: 0 };
      
      scores[cat].total += rating;
      scores[cat].count += 1;
    },

    /**
     * See how the engine interprets a title (useful for debugging/tuning).
     * @param {string} title
     * @returns {{ best: string, matches: Array<{category, keywords, weight}>, confidence: number }}
     */
    detect(title) {
      return analyzeTitle(title);
    },

    /**
     * Get all rated categories with normalized weights that sum to 1.
     * Sorted by raw average score descending.
     * @returns {Array<{ category, score, count, normalized }>}
     */
    getTopCategories() {
      const entries = Object.entries(scores)
        .map(([category, { total, count }]) => ({
          category,
          score: total / count,
          count
        }))
        .sort((a, b) => b.score - a.score);

      const totalScore = entries.reduce((sum, e) => sum + e.score, 0) || 1;
      return entries.map(e => ({
        ...e,
        normalized: e.score / totalScore
      }));
    },

    /** Clear all recorded data */
    reset() {
      scores = {};
    },

    /** Export to compact base64 string */
    export() {
      return btoa(JSON.stringify(scores));
    },

    /** Import from base64 string */
    import(code) {
      try {
        const parsed = JSON.parse(atob(code.trim()));
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          scores = parsed;
        } else {
          throw new Error("Invalid structure");
        }
      } catch {
        console.error("Failed to import: invalid or corrupted save code");
      }
    }
  };
}