# Obscura Browser Integration Guide

> Obscura is a headless browser engine for AI agents. It provides real browser automation with multi-viewport support.

## Installation

```bash
npm install -g obscura-cli
```

## Quick Start

```bash
# Start Obscura server
obscura start --port 9222

# Open a page
obscura open https://example.com

# Take screenshot
obscura screenshot --output screenshot.png
```

## Configuration

Add to `.harness/config.yaml`:

```yaml
e2e:
  engine: obscura
  server: http://localhost:9222
  viewport:
    desktop: [1920, 1080]
    tablet: [768, 1024]
    mobile: [375, 667]
```

## Auto-Fix Feature

Obscura can automatically fix certain bugs:

```bash
obscura test --auto-fix --reporter html
```

## Viewports

| Viewport | Resolution | Use Case |
|----------|------------|----------|
| Desktop | 1920x1080 | Primary testing |
| Tablet | 768x1024 | Responsive design |
| Mobile | 375x667 | Mobile-first testing |

## Troubleshooting

### Server Not Starting

```bash
# Check if port is in use
lsof -i :9222

# Kill existing process
kill $(lsof -t -i :9222)

# Restart
obscura start --port 9222
```

### Browser Not Launching

Ensure you have Chrome or Chromium installed:

```bash
# Install Chromium
brew install chromium

# Or use system Chrome
obscura config --browser /Applications/Google\ Chrome.app
```
