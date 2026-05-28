// FRONTEND PATCHES FOR INDEX.HTML
// Apply these changes to the <script> section

// ========================================
// PATCH 1: Replace extractQuestionOnly function
// ========================================
function extractQuestionOnly(text) {
    if (!text) return '';
    
    // AGGRESSIVE: Strip all professor context and instructions
    let cleaned = text;
    
    // Remove professor greetings and introductions
    cleaned = cleaned.replace(/^.*?(?:Hello|Hi|Good|Dear|Welcome|Hey),\s+[^.!?]*[.!?]\s+/i, '');
    cleaned = cleaned.replace(/^.*?(?:This exam|The exam|In this exam|Here is|We will|Let me|I'm|I am)[^?]*\.\s+/i, '');
    
    // CRITICAL: Remove the "Go ahead and answer" context patterns
    cleaned = cleaned.replace(/^.*?(?:Go ahead|Please go ahead|You can|Next|Now)[^?]*\b(?:and answer|to answer|the question|about)\s+/i, '');
    cleaned = cleaned.replace(/^\s*"?(?:Please )?(?:answer|respond to)[^:]*:\s*/i, '');
    cleaned = cleaned.replace(/^.*?(?:For this question|This question asks|Your task|The question|Please answer)[^?]*\s+/i, '');
    cleaned = cleaned.replace(/^.*?(?:Respond to|Consider|Address|Explain|Describe|Discuss)\s+(?:the following|this)[^:]*:\s*/i, '');
    
    // Remove leading phrases that introduce context
    cleaned = cleaned.replace(/^\s*(?:Based on|Regarding|About|Concerning)\s+[^?]*\s*[,:]\s*/i, '');
    
    cleaned = cleaned.trim();
    
    // For multiple-choice: extract question stem only (not options)
    const mcMatch = cleaned.match(/^([^A-D\n]*?\?)\s*(?:A\)|B\)|$)/i);
    if (mcMatch) {
        return mcMatch[1].trim();
    }
    
    // Find the last paragraph containing a question mark or ending question
    const paragraphs = cleaned.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0);
    for (let i = paragraphs.length - 1; i >= 0; i--) {
        if (paragraphs[i].includes('?') || /[!.?]$/.test(paragraphs[i])) {
            return paragraphs[i];
        }
    }
    
    // Fallback: return first 250 chars as last resort
    return cleaned.substring(0, 250);
}

// ========================================
// PATCH 2: Add updateRecordingUI function AFTER toggleSpeech
// ========================================
function updateRecordingUI(recording) {
    const btn = document.getElementById('speechButton');
    const textarea = document.getElementById('answerInput');
    if (recording) {
        textarea.classList.add('recording-active');
        btn.classList.add('active');
        btn.innerHTML = '⏹️';
        btn.style.background = '#e74c3c';
        btn.style.fontSize = '20px';
    } else {
        textarea.classList.remove('recording-active');
        btn.classList.remove('active');
        btn.innerHTML = '🎤 Speak';
        btn.style.background = '#764ba2';
        btn.style.fontSize = '11px';
    }
}

// ========================================
// PATCH 3: Update speechRecognizer.onstart
// ========================================
// REPLACE this:
//            speechRecognizer.onstart = () => {
//                isListening = true;
//                recognitionTranscript = '';
//                document.getElementById('answerInput').value = '';
//                document.getElementById('answerInput').classList.add('recording-active');
//                document.getElementById('speechButton').classList.add('active');
//                document.getElementById('speechButton').textContent = '⏹️ Stop';
//                document.getElementById('speechFeedback').innerHTML = '<div class="speech-feedback">🎤 RECORDING...</div>';
//            };

// WITH this:
            speechRecognizer.onstart = () => {
                isListening = true;
                recognitionTranscript = '';
                document.getElementById('answerInput').value = '';
                updateRecordingUI(true);
                document.getElementById('speechFeedback').innerHTML = '<div class="speech-feedback">🎤 RECORDING...</div>';
            };

// ========================================
// PATCH 4: Update speechRecognizer.onend
// ========================================
// REPLACE this:
//            speechRecognizer.onend = () => {
//                isListening = false;
//                document.getElementById('answerInput').classList.remove('recording-active');
//                document.getElementById('speechButton').classList.remove('active');
//                document.getElementById('speechButton').textContent = '🎤 Speak';
//                const wordCount = recognitionTranscript.trim().split(/\s+/).length;
//                if (wordCount > 0) {
//                    document.getElementById('speechFeedback').innerHTML = `<div class="speech-feedback">✓ ${wordCount} word${wordCount !== 1 ? 's' : ''} captured</div>`;
//                    setTimeout(() => { document.getElementById('speechFeedback').innerHTML = ''; }, 3000);
//                }
//            };

// WITH this:
            speechRecognizer.onend = () => {
                isListening = false;
                updateRecordingUI(false);
                const wordCount = recognitionTranscript.trim().split(/\s+/).length;
                if (wordCount > 0) {
                    document.getElementById('speechFeedback').innerHTML = `<div class="speech-feedback">✓ ${wordCount} word${wordCount !== 1 ? 's' : ''} captured</div>`;
                    setTimeout(() => { document.getElementById('speechFeedback').innerHTML = ''; }, 3000);
                }
            };

// ========================================
// PATCH 5: Add CSS for recording state (in <style>)
// ========================================
// ADD these after the existing .recording-active rule:

/*
.recording-active { 
    border: 3px solid #e74c3c !important; 
    animation: pulse 0.5s infinite; 
    background: rgba(231, 76, 60, 0.1) !important;
}
@keyframes pulse { 
    0% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.5); } 
    70% { box-shadow: 0 0 0 10px rgba(231, 76, 60, 0); } 
    100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0); } 
}
.icon-btn.active { 
    border: 2px solid #e74c3c;
    animation: pulse-btn 0.5s infinite;
}
@keyframes pulse-btn {
    0% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.7); }
    70% { box-shadow: 0 0 0 10px rgba(231, 76, 60, 0); }
    100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0); }
}
*/

// ========================================
// PATCH 6: Update course loading for USA flag
// ========================================
// FIND this section in loadCoursesFromJSON():
//                    const color = colorPalette[colorIndex % colorPalette.length];
//                    colorIndex++;
//
//                    const courseInfo = {
//                        id: course.id,
//                        name: course.name,
//                        emoji: course.emoji,
//                        semester: course.semester,
//                        color: color
//                    };

// REPLACE WITH this:
                    const color = colorPalette[colorIndex % colorPalette.length];
                    colorIndex++;
                    
                    let emoji = course.emoji || '📖';
                    // Replace British flag with USA flag for English courses
                    if (emoji === '🇬🇧' || (course.name && course.name.includes('English'))) {
                        emoji = '🇺🇸';
                    }

                    const courseInfo = {
                        id: course.id,
                        name: course.name,
                        emoji: emoji,
                        semester: course.semester,
                        color: color
                    };

// ========================================
// PATCH 7: Add Professor Speaking Indicator
// ========================================
// FIND this in getQuestion() function:
//                const loading = document.createElement('div');
//                loading.className = 'loading';
//                loading.textContent = 'Professor thinking...';
//                chatArea.appendChild(loading);
//                chatArea.scrollTop = chatArea.scrollHeight;

// REPLACE WITH this:
                const professorSpeakingIndicator = document.createElement('div');
                professorSpeakingIndicator.className = 'professor-speaking-indicator';
                professorSpeakingIndicator.innerHTML = '💬 Professor is speaking...';
                chatArea.appendChild(professorSpeakingIndicator);
                
                const loading = document.createElement('div');
                loading.className = 'loading';
                loading.textContent = '';
                chatArea.appendChild(loading);
                chatArea.scrollTop = chatArea.scrollHeight;

// AND FIND this right after the loading.remove() line:
//                loading.remove();

// REPLACE WITH:
                loading.remove();
                professorSpeakingIndicator.remove();
