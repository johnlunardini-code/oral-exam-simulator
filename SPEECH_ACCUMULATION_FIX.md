# Speech Accumulation Fix - Technical Documentation

## Problem Statement
**Issue:** When students used Speak → Pause → Speak again, the first sentence disappeared and only the second sentence was sent.

**Root Cause:** The speech recognition `onresult` handler was **replacing** the transcript instead of **appending** to it.

## Critical Code Change

### Location
- **File:** `public/index.html`
- **Handlers:** `speechRecognizer.onstart` and `speechRecognizer.onresult`
- **Function:** `startRecording()`

### The Bug (WRONG)
```javascript
speechRecognizer.onresult = (event) => {
    let finalTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
        }
    }
    if (finalTranscript.trim()) {
        recognitionTranscript = finalTranscript.trim();  // ❌ REPLACES
    }
    document.getElementById('answerInput').value = recognitionTranscript.trim();
};

speechRecognizer.onstart = () => {
    isListening = true;
    recognitionTranscript = '';
    document.getElementById('answerInput').value = '';  // ❌ CLEARS
    updateRecordingUI(true);
    // ...
};
```

### The Fix (CORRECT)
```javascript
speechRecognizer.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';  // Final speech
        } else {
            interimTranscript += transcript;  // Live preview while speaking
        }
    }
    
    // ✅ APPEND to existing, don't replace
    if (finalTranscript.trim()) {
        recognitionTranscript += finalTranscript;
    }
    
    // Show accumulated draft + interim text
    const textarea = document.getElementById('answerInput');
    const accumulated = recognitionTranscript.trim();
    const displayText = accumulated + (interimTranscript ? ' ' + interimTranscript : '');
    textarea.value = displayText;
    
    // Update draft status badge with word count
    const wordCount = displayText.split(/\s+/).filter(w => w.length > 0).length;
    const draftBadge = document.getElementById('draftStatus');
    if (wordCount > 0) {
        draftBadge.textContent = `Draft: ${wordCount} word${wordCount !== 1 ? 's' : ''}`;
        draftBadge.style.display = 'inline-block';
    }
};

speechRecognizer.onstart = () => {
    isListening = true;
    // ✅ Preserve existing text - don't clear it
    const existingText = document.getElementById('answerInput').value.trim();
    recognitionTranscript = existingText;  // Start with what's already there
    updateRecordingUI(true);
    // ...
};

function startRecording() {
    if (isProfessorSpeaking) {
        alert('Professor is still speaking. Wait or click Mute to stop.');
        return;
    }
    // ✅ Preserve existing text in textarea
    const existingText = document.getElementById('answerInput').value.trim();
    recognitionTranscript = existingText;  // Start with existing content
    speechRecognizer.lang = currentSessionIsItalian ? 'it-IT' : 'en-US';
    speechRecognizer.start();
}
```

## Key Changes Summary

| Issue | Before | After |
|-------|--------|-------|
| Transcript handling | `recognitionTranscript = finalTranscript` | `recognitionTranscript += finalTranscript` |
| Onstart behavior | Clears textarea | Preserves existing text |
| Interim text | Not shown | Displayed while speaking |
| Draft badge | Not updated | Shows accumulated word count |
| Reset timing | On pause (losing text) | Only after Send |

## How It Works Now

### Student Flow
1. **First Speak:** "The human body has multiple systems..."
   - Click Speak → Recording starts
   - Say first sentence
   - Click Pause → Text appears in textarea
   - Draft badge shows: "Draft: 7 words"

2. **Second Speak:** "...including skeletal and muscular systems."
   - Click Speak again → Recording starts (textarea preserved)
   - Say second sentence
   - Click Pause → BOTH sentences now in textarea
   - Draft badge shows: "Draft: 15 words"

3. **Send:** Click Send with complete, reviewed answer
   - Draft resets after successful submission

## Testing Checklist

- [x] Desktop: Speak → Pause → Speak → Text accumulates ✅
- [ ] Mobile: Same behavior on touch devices
- [ ] Italian courses: Speech lang switches to it-IT correctly
- [ ] Long answers: 500+ words accumulate without issues
- [ ] Multiple pause/resume cycles: Text doesn't truncate
- [ ] Interim text: Shows while speaking for live feedback
- [ ] Draft badge: Updates with correct word count
- [ ] Send button: Clears draft only after submission

## If Issue Recurs

**Search for:**
```
recognitionTranscript = finalTranscript.trim();
```

**Should be:**
```
recognitionTranscript += finalTranscript;
```

If the `=` operator is present instead of `+=`, the bug has returned.

## Git Reference

- **Commit:** `371ea31`
- **Message:** "fix: Speech accumulation - preserve previous text when Speak→Pause→Speak again"
- **Changed files:** `public/index.html`
- **Changes:** Lines ~740, ~754, ~700

## Mobile Considerations

The fix applies to both desktop and mobile because:
1. Same WebKit speech recognition API used on both platforms
2. Same HTML textarea element manages state
3. Touch events trigger same JavaScript handlers
4. Responsive CSS ensures proper layout on small screens

Mobile-specific testing needed:
- Verify textarea scrolling with accumulated text
- Test Speak button responsiveness on touch
- Check draft badge visibility on small screens
- Ensure keyboard doesn't cover answer field
