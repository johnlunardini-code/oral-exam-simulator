# TTS System - Quick Reference Card

## What Was Fixed
✅ **"Last Sentence Only" Bug** → Full utterance now spoken without resetting

## Core Features

| Feature | Implementation |
|---------|-----------------|
| **Full Text Playback** | Single SpeechSynthesisUtterance with complete text |
| **Word Highlighting** | Yellow background on spoken sentence, auto-scrolls |
| **Play/Pause** | Preserve exact position, resume from pause point |
| **Speed Control** | 0.5x to 2.0x in 0.25 increments |
| **Stop Button** | Hard stop, clears UI state |
| **Rewind 10s** | Simplified restart (v1) |
| **Forward 10s** | Manual pause (v1) |
| **Progress Bar** | Visual playback position, updates every 100ms |
| **Voice Persistence** | Uses localStorage preference from home page |
| **Mute/Unmute** | Cancel + auto-replay on unmute |
| **Session Cleanup** | Full TTS state reset on exam end |

## Function Reference

### Main API
```javascript
speakText(text, messageId, isRetry)        // Primary TTS entry point
togglePlayerPlayPause()                     // Pause/Resume
stopPlayerPlayback()                        // Hard stop
setPlayerSpeed(speed)                       // Change playback rate
```

### UI Controls
```javascript
showTTSPlayer()                             // Display floating player
hideTTSPlayer()                             // Hide floating player
removeHighlighting()                        // Clear sentence highlighting
updatePlayerUI()                            // Update progress bar (runs every 100ms)
```

### State Management
```javascript
toggleMute()                                // Mute/unmute with auto-replay
```

### Lifecycle
```javascript
initTTSUpdateInterval()                     // Start progress bar timer
clearTTSUpdateInterval()                    // Stop timer
```

## Scope

### ✅ TTS Active For:
- Professor questions in main chat
- Professor feedback messages
- Student's own submitted answers
- Main conversation flow

### ❌ TTS NOT Active For:
- Hint sidebar
- History sidebar
- Feedback sidebar
- Help sidebar
- Settings
- Score reports

## State Variables

```javascript
currentUtterance              // Active SpeechSynthesisUtterance object
isTTSPaused                   // true if paused, false if playing/stopped
currentTTSText                // Full text currently/last being spoken
currentPlayerSpeed            // Playback rate (0.5 to 2.0)
ttsStartTime                  // Timestamp when speak() called
ttsPausedTime                 // Elapsed seconds when paused
ttsUpdateInterval             // Progress bar timer ID (setInterval)
```

## Styling

### Floating Player
```css
.floating-player              /* Bottom-right fixed position, white box */
.floating-player-btn          /* Blue action buttons */
.floating-player-btn.secondary /* Light gray control buttons */
.floating-player-speed-btn    /* Speed selector buttons */
.floating-player-speed-btn.active /* Active speed highlighted blue */
.floating-player-progress     /* Gray progress bar background */
.floating-player-progress-bar /* Blue progress fill (dynamic width) */
```

### Highlighting
```css
.sentence-highlighted         /* Yellow background, bold text */
```

## HTML Structure

```html
<!-- Floating Player (fixed bottom-right) -->
<div class="floating-player" id="floatingPlayer">
    <div class="floating-player-header">🔊 Playing...</div>
    <div class="floating-player-progress">
        <div class="floating-player-progress-bar"></div>
    </div>
    <div class="floating-player-controls">
        <!-- Pause/Stop/Rewind/Forward buttons -->
    </div>
    <div class="floating-player-speed">
        <!-- Speed selector buttons (0.5x to 2.0x) -->
    </div>
    <div class="floating-player-text">Initializing...</div>
</div>

<!-- Speak buttons in each professor message -->
<button onclick="speakText(this.parentElement.previousElementSibling.textContent, null)">
    🔊 Speak
</button>
```

## Event Flow

### Exam Start
```
User selects course 
  → startExam() 
  → getQuestion() 
  → speakText(question) 
  → Player appears + highlighting + auto-scroll
```

### During Playback
```
Speaking → User clicks Speed button → setPlayerSpeed() → Re-speak at new rate
         → User clicks Pause → togglePlayerPlayPause() → paused state
         → User clicks Resume → togglePlayerPlayPause() → resume from position
         → User clicks Stop → stopPlayerPlayback() → cleanup + hide player
```

### Mute/Unmute
```
Speaking → User clicks Mute 
  → toggleMute() cancels playback + clears UI 
  → speechSynthesis.cancel() 
  → hideTTSPlayer() + removeHighlighting()

Later → User clicks Unmute 
  → toggleMute() auto-replays 
  → speakText(currentQuestionText)
```

### Exam End
```
User clicks End Exam 
  → endExam() 
  → speechSynthesis.cancel() 
  → stopPlayerPlayback() 
  → clearTTSUpdateInterval() 
  → removeHighlighting() 
  → Reset all state variables
```

## Local Testing

```bash
# Install
npm install

# Start dev server
npm start

# Server runs on http://localhost:3000

# Stop server
Ctrl+C
```

## Build & Deploy

```bash
# Build Docker image
docker build -t oral-exam-simulator:latest .

# Run locally
docker run -p 3000:3000 oral-exam-simulator:latest

# Deploy to Railway (via GitHub)
git add -A
git commit -m "message"
git push origin main
# Railway auto-builds and deploys
```

## Browser Support
- ✅ Chrome / Edge (full support)
- ✅ Safari (full support)
- ✅ Firefox (full support)
- ✅ Mobile browsers (touch-compatible)

## Known Limitations
- Rewind/Forward currently restart or pause (no seeking in v1)
- Web Speech API doesn't expose actual duration (progress bar approximate)
- Voice availability varies by browser and OS
- No server-side TTS caching (all client-side synthesis)

---

**Status**: ✅ Production Ready | **Version**: 1.0 | **Last Updated**: May 28, 2026
