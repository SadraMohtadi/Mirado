# 🛍️ Mirado 0.6 - OSS 

Mirado lets users photograph any product to instantly get an AI-powered summary and discover where to buy it.

## Features


- **Sorting algorithms** — Using frontend algorithms, the app finds the best results to display
- **Preference analysis (WIP)** — The app has a dedicated ```preferenceEngine.js``` file which houses all the functions to learn what the user prefers and what they like to see
- **Object tracking** — Mirado features an object tracking system to help the app and the user know what they're looking for. It can be found in the ```objectTracking.js``` file
- **Camera color correction** — Mirado also has a built in camera color correction algorithm which helps eliminate glare and perfect saturation and gamma so the object present in the camera can be thoroughly detailed. It can also be found in the ```objectTracking.js``` file.
- **Image Recognition** — Take a picture of any product and Mirado identifies it
- **AI Summaries** — Get a concise, intelligent breakdown of the product
- **Purchase Links** — Find out where to buy it, powered by SerpAPI
- **Useful Libraries** — Mirado has a lot of libraries that are made from scratch, such ```quoteBubble.js```, ```themes.js```, or ```inAppNotifications.js```

## Prerequisites

- Python 3.x
- Ollama
- A [SerpAPI](https://serpapi.com/) account and API key

## Setup & Installation

### 1. Clone the repository

```bash
git clone https://github.com/sadramohtadi/mirado.git
cd mirado
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure your API key

Open `scripts/config.js` and replace the placeholder with your SerpAPI key:

```javascript
const SERP_API = '<YOUR_SERP_API_KEY>';
```

### 4. Start the AI servers

Navigate to the `scripts/` folder and run either or both depending on which features you need:

**Product summarization:**
```bash
py server.py
```

**Image analysis:**
```bash
py imageAnalyzer.py
```

> Both servers can run simultaneously for the full experience.

### 5. Open the app

Use a Live Server in VSCode or simply load up the HTML file to run the app.

## Roadmap
- Improving result accuracy
- Improving result speed
- Fixing issues
- Making the app more user friendly
- Custom upload & Search History

## Known Limitations
- Currently performs significantly better in North America

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | HTML, CSS, JavaScript |
| Backend | PHP, Python |

## License
This project is licensed under the Apache License 2.0.

## Author

Made by [@SadraMohtadi](https://github.com/sadramohtadi)

[![Instagram](https://img.shields.io/badge/instagram-833AB4?style=for-the-badge&logo=instagram&logoColor=white)](https://www.instagram.com/sadramohtadi)
[![X / Twitter](https://img.shields.io/badge/x/twitter-000?style=for-the-badge&logo=x&logoColor=white)](https://twitter.com/@sadramohtadi)
