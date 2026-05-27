# Mobile & Italian Fixes Required

## Issue 1: Italian Button Instruction
- Professor should mention "Risponda in Italiano" button in first question
- System prompt now includes: accept Italian responses
- Server sends `isItalianCourse: true` flag
- Frontend shows button only for Italian exams

## Issue 2: Mobile Speech Repetition
Fixed in speechRecognizer.onresult:
- Only use isFinal transcripts (not interim)
- Completely clear recognitionTranscript before new recording
- Don't accumulate interim results - only final ones

## Issue 3: Help Updated
Added comprehensive Help section covering:
- Pre-load Materials (home page)
- Italian Exam instructions
- All exam buttons and actions
- Tips for success

## Issue 4: Mobile Undefined Error on Text Answer
Fixed in:
- submitAnswer() now checks answer exists, alerts if empty
- getQuestion() properly handles studentAnswer parameter with fallback ''
- Response validation checks data.response exists
- Better error handling for network failures
- endExam() properly captures scoreData from DELETE response

## Files Modified:
- server.js: System prompt updated to ask students to use Italian button
- public/index.html: Multiple fixes applied
