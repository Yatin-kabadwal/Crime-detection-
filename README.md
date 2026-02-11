# CrimeVision AI — Real-Time Crime Detection System

> **Design of an Analytic Deep Learning Model for Real-Time Crime Identification and Forecasting**  
> Gayatry Sharma (24338038) | Prof. (Dr.) Ashutosh Kumar Bhatt  
> Uttarakhand Open University, Haldwani, Nainital

## Project Structure

```
Crime/
├── index.html              → Landing / Login page
├── dashboard.html          → Analytics dashboard with charts & stats
├── live-monitor.html       → Real-time webcam monitoring + AI detection
├── upload-analyze.html     → Upload video files for batch analysis
├── history.html            → Searchable detection history with filters
├── settings.html           → Alert config, EmailJS, themes, data management
├── css/
│   ├── style.css           → Global styles & CSS variables
│   ├── components.css      → Reusable UI components
│   ├── dashboard.css       → Dashboard & history page styles
│   └── monitor.css         → Video monitor & upload page styles
├── js/
│   ├── utils.js            → Helper functions, formatters, constants
│   ├── app.js              → App init, auth, routing, sidebar, theme
│   ├── video.js            → Webcam/video stream handling
│   ├── detection.js        → TensorFlow.js model loading & inference
│   ├── classifier.js       → Crime classification from detection results
│   ├── annotation.js       → Canvas overlay (bounding boxes, labels)
│   ├── alerts.js           → Browser notifications + EmailJS
│   ├── history.js          → LocalStorage CRUD for detection records
│   └── dashboard.js        → Chart.js rendering & stats
├── models/
│   └── README.md           → Model documentation
├── assets/
│   ├── images/             → Logo, favicon, placeholders
│   └── sounds/
│       └── alert.mp3       → Audio alert sound
└── README.md               → This file
```

## Tech Stack

| Layer        | Technology                         |
|-------------|-------------------------------------|
| Frontend     | HTML5, CSS3, Vanilla JavaScript    |
| AI/ML        | TensorFlow.js, COCO-SSD, MoveNet  |
| Charts       | Chart.js 4.x                       |
| Icons        | Lucide Icons                       |
| Email Alerts | EmailJS (free tier: 300/month)     |
| Storage      | LocalStorage (browser)             |
| Fonts        | Inter, JetBrains Mono (Google)     |

## Pages Overview

### 1. `index.html` — Login
- Email/password authentication (stored in LocalStorage)
- Demo mode for instant access
- Register modal for new operators
- System status indicator

### 2. `dashboard.html` — Command Center
- 4 stat cards (total detections, critical alerts, active feeds, avg confidence)
- Detection timeline chart (line/area)
- Crime type distribution (doughnut)
- Confidence distribution (bar)
- Hourly heatmap
- Recent detections table with filters
- Notification panel (slide-in)
- Quick action floating button

### 3. `live-monitor.html` — Real-Time Monitoring
- Webcam & stream URL support
- AI model loading progress indicator
- Canvas overlay for bounding boxes + crime labels
- Start/stop detection controls
- Confidence threshold slider
- Screenshot & recording
- Right panel with: live status, event log, detected objects
- Session statistics
- Threat level gauge

### 4. `upload-analyze.html` — Batch Analysis
- Drag & drop video upload
- Analysis mode selection (full/fast/keyframe)
- Progress bar with ETA
- Results dashboard with charts
- Detection grid with thumbnails

### 5. `history.html` — Detection Logs
- Full-text search
- Multi-filter: type, source, status, date range, confidence
- Table & grid view toggle
- Sortable columns
- Bulk actions (review, dismiss, delete)
- Pagination with configurable page size
- Export: CSV, JSON, PDF
- Detection detail modal with notes

### 6. `settings.html` — Configuration
- Profile management
- Detection parameters (thresholds, frame skip, resolution)
- Crime type toggles
- Alert channels (browser, email, audio, screen flash)
- EmailJS configuration with template guide
- Theme (dark/light/system) + accent colors
- Data management (export/import/reset)
- System info & about section

## Setup

1. Open the `Crime` folder in VS Code
2. Use Live Server extension to serve `index.html`
3. Configure EmailJS credentials in Settings → Email tab
4. Grant camera permissions when prompted on Live Monitor

## Deployment

Deploy to **Vercel** or **Netlify** — just connect the repo. No build step required.