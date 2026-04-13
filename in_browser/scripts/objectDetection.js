/*
Copyright 2026 Sadra Mohtadi

Licensed under the Apache License, Version 2.0
http://www.apache.org/licenses/LICENSE-2.0
*/

// This code contains all the code for automatic color correction and automatic object detection.

// Color correction class
class ISP {
    constructor() {
        // Smoothed state values (exponential moving averages)
        this.gamma      = 1.0;   // Current gamma exponent
        this.contrast   = 100;   // CSS contrast %
        this.saturation = 150;   // CSS saturation %

        // Targets (what the analysis wants us to reach)
        this._targetGamma = 1.0;
        this._targetContrast = 100;
        this._targetSat = 150;

        // Config
        this.GLARE_THRESHOLD  = 210;  // Pixel luminance above which we call it a glare spot
        this.GLARE_BLEND      = 0.72; // How aggressively to pull a glare pixel toward neutral (0–1)
        this.ANALYSIS_RES     = 32;   // Downsampled canvas size for the analysis pass
        this.SMOOTH           = 0.12; // EMA smoothing factor (lower = slower/smoother)
    }

    /**
     * Main entry point
     * @param {HTMLVideoElement} video  – Live camera feed
     * @param {HTMLCanvasElement} canvas – The canvas the correct frame will be drawn on to
     * @returns {string} CSS filter string for any remaining global tweaks
     */
    apply(video, canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // Analysis on a tiny downsample
        const res = this.ANALYSIS_RES;
        const aCanvas = new OffscreenCanvas(res, res);
        const aCtx = aCanvas.getContext('2d');
        aCtx.drawImage(video, 0, 0, res, res);
        const aData = aCtx.getImageData(0, 0, res, res).data;

        let totalLum = 0;
        let totalSat = 0;
        let glarePixels = 0;

        for (let i = 0; i < aData.length; i += 4) {
            const r = aData[i], g = aData[i+1], b = aData[i+2];

            // Luminance (BT.709)
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            totalLum += lum;

            // Colorfulness, how far each channel deviates from grey
            const mid   = (r + g + b) / 3;
            const dR    = Math.abs(r - mid);
            const dG    = Math.abs(g - mid);
            const dB    = Math.abs(b - mid);
            totalSat += (dR + dG + dB) / (mid + 1); // normalised 0-ish to 1+

            if (lum > this.GLARE_THRESHOLD) glarePixels++;
        }

        const pixelCount  = res * res;
        const avgLum      = totalLum  / pixelCount;    // 0–255
        const avgSat      = totalSat  / pixelCount;    // relative colorfulness
        const glareFrac   = glarePixels / pixelCount;  // 0–1

        // Derive targets from analysis

        // Gamma: expose for midtones. avgLum 128 = gamma 1.0 (neutral)
        // Dark scene -> gamma < 1 (lift shadows). Bright -> gamma > 1 (pull down)
        this._targetGamma    = Math.max(0.55, Math.min(1.65, Math.log(128) / Math.log(avgLum + 1)));

        // Contrast: boost slightly when glare is present (helps cut through it globally)
        this._targetContrast = Math.max(90, Math.min(160, 100 + glareFrac * 120));

        // Auto-saturation: dull scene -> boost. Already vibrant -> ease off
        // avgSat ~0.15 = very grey, ~0.5 = normal colour, ~0.8+ = already vivid
        this._targetSat      = Math.max(80, Math.min(220, 110 + (0.4 - avgSat) * 280));

        // Smooth all values to prevent flicker
        const s = this.SMOOTH;
        this.gamma      += (this._targetGamma    - this.gamma)      * s;
        this.contrast   += (this._targetContrast - this.contrast)   * s;
        this.saturation += (this._targetSat      - this.saturation) * s;

        // Pixel-level correction on the full-res canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;

        // Pre-build a gamma LUT (256-entry lookup table) for speed
        const gammaLUT = this._buildGammaLUT(this.gamma);

        for (let i = 0; i < d.length; i += 4) {
            let r = d[i], g = d[i+1], b = d[i+2];
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

            // Glare suppression only on actual hot pixels
            if (lum > this.GLARE_THRESHOLD) {
                // How far over the threshold? (0 at threshold, 1 at 255)
                const glareStr = (lum - this.GLARE_THRESHOLD) / (255 - this.GLARE_THRESHOLD);
                // Pull channel toward neutral grey (128) in the glare region
                const blend = this.GLARE_BLEND * glareStr;
                r = r + (128 - r) * blend;
                g = g + (128 - g) * blend;
                b = b + (128 - b) * blend;
            }

            // Gamma correction via LUT
            r = gammaLUT[Math.min(255, Math.round(r))];
            g = gammaLUT[Math.min(255, Math.round(g))];
            b = gammaLUT[Math.min(255, Math.round(b))];

            d[i] = r; d[i+1] = g; d[i+2] = b;
        }

        ctx.putImageData(imgData, 0, 0);

        // Global CSS filter, contrast + subtle hue shift only
        // Saturation and brightness are now handled in-pixel / via gamma,
        // so we keep the CSS layer minimal to avoid double-processing
        return `contrast(${this.contrast}%) saturate(${this.saturation}%) hue-rotate(-2deg)`;
    }

    /**
     * Build a 256-entry gamma LUT
     * gamma < 1 → brightens midtones (shadow lift)
     * gamma > 1 → darkens midtones (highlight pull)
     */
    _buildGammaLUT(gamma) {
        const lut = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            lut[i] = Math.round(Math.pow(i / 255, gamma) * 255);
        }
        return lut;
    }
}

// Object detection class
class ObjectDetection {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });
        this.template = null;
        this.keyColor = null;
        
        this.pos = { x: 0, y: 0 };
        this.visual = { x: 0, y: 0 };
        this.velocity = { x: 0, y: 0 };
        
        this.confidence = 0;
        this.failCounter = 0; 
        this.maxFails = 5;    // Frames of grace before a hard kill
        this.margin = 0.05;   // 5% Screen edge safety buffer
    }

    // Sync the filtered camera feed
    sync(video, filter) {
        this.ctx.filter = filter;
        this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
        this.ctx.filter = 'none';
    }

    // Start lock
    lock(x, y) {
        // IMPORTANT!!! This number can be adjusted to improve the object detection,
        // the higher the number, the more proccesing power required, 50 - 90 is generaly
        // a pretty good spot to keep the number at for the best performance.
        const size = 84;
        const pCanvas = document.getElementById('preview-canvas');
        pCanvas.width = pCanvas.height = size;
        const pCtx = pCanvas.getContext('2d');
        
        pCtx.drawImage(this.canvas, x - size/2, y - size/2, size, size, 0, 0, size, size);
        this.template = pCtx.getImageData(0, 0, size, size);
        
        const d = this.template.data;
        const m = (Math.floor(size/2) * size + Math.floor(size/2)) * 4;
        this.keyColor = { r: d[m], g: d[m+1], b: d[m+2] };

        this.pos = { x, y };
        this.visual = { x, y };
        this.velocity = { x: 0, y: 0 };
        this.failCounter = 0; 
        document.getElementById('preview-container').style.display = 'block';
    }

    // Hard Reset
    cancel() {
        this.template = null;
        this.keyColor = null;
        this.velocity = { x: 0, y: 0 };
        document.getElementById('preview-container').style.display = 'none';
    }

    // Search & Track Logic
    detect() {
        if (!this.template) return;

        // Prediction
        const predictedX = this.pos.x + this.velocity.x;
        const predictedY = this.pos.y + this.velocity.y;

        // Hard kill on total screen exit
        if (predictedX < 0 || predictedY < 0 || predictedX > this.canvas.width || predictedY > this.canvas.height) {
            return this.cancel();
        }

        // Search window logic
        const range = this.failCounter > 0 ? 120 : 85; 
        const sx = Math.max(0, predictedX - range);
        const sy = Math.max(0, predictedY - range);
        const sw = Math.min(this.canvas.width - sx, range * 2);
        const sh = Math.min(this.canvas.height - sy, range * 2);

        const frame = this.ctx.getImageData(sx, sy, sw, sh).data;
        const tD = this.template.data;
        const tw = this.template.width;
        const th = this.template.height;

        let bestErr = Infinity;
        let bx = predictedX, by = predictedY;
        let foundColor = { r: 0, g: 0, b: 0 };

        // Sliding Window
        for (let y = 0; y < sh - th; y += 8) {
            for (let x = 0; x < sw - tw; x += 8) {
                let err = 0, count = 0, rS = 0, gS = 0, bS = 0;
                for (let ty = 0; ty < th; ty += 10) { 
                    for (let tx = 0; tx < tw; tx += 10) {
                        const ti = (ty * tw + tx) * 4;
                        const fi = ((y+ty) * sw + (x+tx)) * 4;
                        err += Math.abs(frame[fi] - tD[ti]) + Math.abs(frame[fi+1] - tD[ti+1]) + Math.abs(frame[fi+2] - tD[ti+2]);
                        rS += frame[fi]; gS += frame[fi+1]; bS += frame[fi+2];
                        count++;
                    }
                }
                const score = err / (count || 1);
                if (score < bestErr) { 
                    bestErr = score; bx = sx + x + tw/2; by = sy + y + th/2; 
                    foundColor = { r: rS/count, g: gS/count, b: bS/count };
                }
            }
        }

        const colorDist = Math.sqrt((foundColor.r-this.keyColor.r)**2+(foundColor.g-this.keyColor.g)**2+(foundColor.b-this.keyColor.b)**2);
        this.confidence = Math.max(0, 100 - (bestErr / 1.5));

        // Resilience Check
        if (this.confidence < 35 || colorDist > 90) {
            this.failCounter++;
            if (this.failCounter > this.maxFails) return this.cancel();
            // Continue movement with "ghost" velocity
            this.pos.x += this.velocity.x;
            this.pos.y += this.velocity.y;
        } else {
            this.failCounter = 0;
            // Update motion
            this.velocity.x = (bx - this.pos.x) * 0.45;
            this.velocity.y = (by - this.pos.y) * 0.45;
            this.pos = { x: bx, y: by };
        }

        // Smoothing for the UI
        this.visual.x += (this.pos.x - this.visual.x) * 0.4;
        this.visual.y += (this.pos.y - this.visual.y) * 0.4;
    }

    // Circular Marker
    render() {
        if (!this.template) return;
        
        this.ctx.save();
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = "white";
        this.ctx.fillStyle = "white";
        // If we're guessing position, dim the dot slightly
        this.ctx.globalAlpha = this.failCounter > 0 ? 0.5 : 1.0;
        
        this.ctx.beginPath();
        this.ctx.arc(this.visual.x, this.visual.y, 6, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }
}