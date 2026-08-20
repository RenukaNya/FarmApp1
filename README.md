# Hatta Smart Farm – IoT Irrigation Dashboard & Yield Predictor

A fully static web application for the **Hatta Model Strawberry Farm, Dubai, UAE**.  
No backend or server-side code required — runs entirely in the browser.

---

## Features

- **Live Dashboard** — Daily / Weekly / Monthly / Yearly views for:
  - Strawberry Yield & Cumulative Yield
  - Temperature (Avg / Min / Max)
  - Daily Water Usage
  - Rainfall, Solar Radiation, PAR
  - Soil Moisture & EC Level
  - Wind Speed & Humidity
  - Yield by Growth Stage (doughnut)
- **Farm Selector** — Switch between Greenhouse (11,200 plants) and Open Field (7,000 plants)
- **Yield Predictor** — Enter 10 parameters → Linear Regression prediction with feature contribution chart

---

## Project Structure

```
hatta-farm-app/
├── index.html          # Main page (Dashboard + Predictor)
├── css/
│   └── style.css       # Dark theme custom CSS
├── js/
│   └── app.js          # Chart.js charts + LR prediction engine
└── data/
    ├── greenhouse.json  # 182 daily records – Greenhouse farm
    ├── openfield.json   # 182 daily records – Open Field farm
    └── lr_models.json   # Linear Regression coefficients (both farms)
```

---

## Data Sources

| Data | Source |
|------|--------|
| Yield & harvest records | Farmer-supplied Excel / DOCX files |
| Climate (Temp, Rain, Solar, Humidity, Wind, PAR) | NASA POWER API – Lat 24.81°N, Lon 56.11°E |
| Irrigation & EC | Farmer irrigation reports |
| Soil moisture | Estimated by growth stage |

**Season:** December 2025 – May 2026  
**Transplanting date assumed:** November 15, 2025

---

## Running Locally

> You must use a local HTTP server — opening `index.html` directly will block the JSON data files (CORS).

**Option 1 – Node.js:**
```bash
npx serve . -p 3000
# Open: http://localhost:3000
```

**Option 2 – Python:**
```bash
python3 -m http.server 8000
# Open: http://localhost:8000
```

**Option 3 – VS Code:**  
Install the "Live Server" extension → right-click `index.html` → Open with Live Server

---

## Deploying to Netlify (Easiest)

1. Go to [netlify.com](https://netlify.com) and sign in
2. Drag and drop the **entire `hatta-farm-app` folder** onto the Netlify deploy area
3. Your site will be live in seconds with a public URL

## Deploying to GitHub Pages

1. Push this folder to a GitHub repository
2. Go to **Settings → Pages**
3. Set source branch to `main`, folder to `/ (root)`
4. GitHub Pages will publish the site automatically

---

## ML Model Notes

- **Algorithm:** Linear Regression (NumPy OLS with StandardScaler normalization)
- **Features (10):** Days After Transplanting, Water Usage, Soil Moisture, Avg Temperature, Solar Radiation, EC Level, Rainfall, Humidity, Growth Stage, Plant Density
- **Target:** Daily Harvest Yield (kg)
- **Greenhouse:** R² = 0.1139, MAE = 7.47 kg
- **Open Field:** R² = 0.2400, MAE = 4.56 kg

> Low R² is expected — most days have zero yield (harvest events are sparse). The model still captures relative differences across growth stages.

---

## Tech Stack

- HTML5, Tailwind CSS (CDN), Vanilla JavaScript
- Chart.js 4.4.0
- Fonts: Inter (Google Fonts)
- No frameworks, no build step, no backend

---

*Developed for Hatta Model Farm, Dubai, UAE — IoT Smart Irrigation & Strawberry Yield Prediction System*
