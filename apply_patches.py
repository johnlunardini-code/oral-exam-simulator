#!/usr/bin/env python3
import re

# Read the HTML file
with open('./public/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# PATCH 1: Update extractQuestionOnly function
old_extract = r'''function extractQuestionOnly\(text\) \{
            if \(!text\) return '';
            
            // Remove introductory text patterns.*?return cleaned\.substring\(0, 250\);
        \}'''

new_extract = '''function extractQuestionOnly(text) {
            if (!text) return '';
            
            // AGGRESSIVE: Strip all professor context and instructions
            let cleaned = text;
            
            // Remove professor greetings and introductions
            cleaned = cleaned.replace(/^.*?(?:Hello|Hi|Good|Dear|Welcome|Hey),\\s+[^.!?]*[.!?]\\s+/i, '');
            cleaned = cleaned.replace(/^.*?(?:This exam|The exam|In this exam|Here is|We will|Let me|I'm|I am)[^?]*\\.\\s+/i, '');
            
            // CRITICAL: Remove the "Go ahead and answer" context patterns
            cleaned = cleaned.replace(/^.*?(?:Go ahead|Please go ahead|You can|Next|Now)[^?]*\\b(?:and answer|to answer|the question|about)\\s+/i, '');
            cleaned = cleaned.replace(/^\\s*"?(?:Please )?(?:answer|respond to)[^:]*:\\s*/i, '');
            cleaned = cleaned.replace(/^.*?(?:For this question|This question asks|Your task|The question|Please answer)[^?]*\\s+/i, '');
            cleaned = cleaned.replace(/^.*?(?:Respond to|Consider|Address|Explain|Describe|Discuss)\\s+(?:the following|this)[^:]*:\\s*/i, '');
            
            // Remove leading phrases that introduce context
            cleaned = cleaned.replace(/^\\s*(?:Based on|Regarding|About|Concerning)\\s+[^?]*\\s*[,:]\\s*/i, '');
            
            cleaned = cleaned.trim();
            
            // For multiple-choice: extract question stem only (not options)
            const mcMatch = cleaned.match(/^([^A-D\\n]*?\\?)\\s*(?:A\\)|B\\)|$)/i);
            if (mcMatch) {
                return mcMatch[1].trim();
            }
            
            // Find the last paragraph containing a question mark or ending question
            const paragraphs = cleaned.split(/\\n\\n+/).map(p => p.trim()).filter(p => p.length > 0);
            for (let i = paragraphs.length - 1; i >= 0; i--) {
                if (paragraphs[i].includes('?') || /[!.?]$/.test(paragraphs[i])) {
                    return paragraphs[i];
                }
            }
            
            // Fallback: return first 250 chars as last resort
            return cleaned.substring(0, 250);
        }'''

html = re.sub(old_extract, new_extract, html, flags=re.DOTALL)

# PATCH 2: Add updateRecordingUI function after toggleSpeech
insert_after = "function toggleSpeech() {\n            if (!speechRecognizer) { alert('Speech not supported'); return; }\n            if (isListening) {\n                stopRecording();\n            } else {\n                startRecording();\n            }\n        }"

new_function = '''function toggleSpeech() {
            if (!speechRecognizer) { alert('Speech not supported'); return; }
            if (isListening) {
                stopRecording();
            } else {
                startRecording();
            }
        }
        
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
        }'''

html = html.replace(insert_after, new_function)

# PATCH 3: Update speechRecognizer.onstart
old_onstart = '''speechRecognizer.onstart = () => {
                isListening = true;
                recognitionTranscript = '';
                document.getElementById('answerInput').value = '';
                document.getElementById('answerInput').classList.add('recording-active');
                document.getElementById('speechButton').classList.add('active');
                document.getElementById('speechButton').textContent = '⏹️ Stop';
                document.getElementById('speechFeedback').innerHTML = '<div class="speech-feedback">🎤 RECORDING...</div>';
            };'''

new_onstart = '''speechRecognizer.onstart = () => {
                isListening = true;
                recognitionTranscript = '';
                document.getElementById('answerInput').value = '';
                updateRecordingUI(true);
                document.getElementById('speechFeedback').innerHTML = '<div class="speech-feedback">🎤 RECORDING...</div>';
            };'''

html = html.replace(old_onstart, new_onstart)

# PATCH 4: Update speechRecognizer.onend
old_onend = '''speechRecognizer.onend = () => {
                isListening = false;
                document.getElementById('answerInput').classList.remove('recording-active');
                document.getElementById('speechButton').classList.remove('active');
                document.getElementById('speechButton').textContent = '🎤 Speak';
                const wordCount = recognitionTranscript.trim().split(/\\s+/).length;
                if (wordCount > 0) {
                    document.getElementById('speechFeedback').innerHTML = `<div class="speech-feedback">✓ ${wordCount} word${wordCount !== 1 ? 's' : ''} captured</div>`;
                    setTimeout(() => { document.getElementById('speechFeedback').innerHTML = ''; }, 3000);
                }
            };'''

new_onend = '''speechRecognizer.onend = () => {
                isListening = false;
                updateRecordingUI(false);
                const wordCount = recognitionTranscript.trim().split(/\\s+/).length;
                if (wordCount > 0) {
                    document.getElementById('speechFeedback').innerHTML = `<div class="speech-feedback">✓ ${wordCount} word${wordCount !== 1 ? 's' : ''} captured</div>`;
                    setTimeout(() => { document.getElementById('speechFeedback').innerHTML = ''; }, 3000);
                }
            };'''

html = html.replace(old_onend, new_onend)

# PATCH 5: Update CSS for recording animations
old_recording_css = '''.recording-active { border: 3px solid #e74c3c !important; animation: pulse 0.5s infinite; }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.5); } 70% { box-shadow: 0 0 0 10px rgba(231, 76, 60, 0); } 100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0); } }'''

new_recording_css = '''.recording-active { 
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
        }'''

html = html.replace(old_recording_css, new_recording_css)

# PATCH 6: Replace British flag with USA flag
html = html.replace('🇬🇧', '🇺🇸')

# PATCH 7: Add flag replacement logic in course loading
old_course_loading = '''                    const color = colorPalette[colorIndex % colorPalette.length];
                    colorIndex++;

                    const courseInfo = {
                        id: course.id,
                        name: course.name,
                        emoji: course.emoji,
                        semester: course.semester,
                        color: color
                    };'''

new_course_loading = '''                    const color = colorPalette[colorIndex % colorPalette.length];
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
                    };'''

html = html.replace(old_course_loading, new_course_loading)

# PATCH 8: Add Professor Speaking Indicator
old_loading_indicator = '''                const loading = document.createElement('div');
                loading.className = 'loading';
                loading.textContent = 'Professor thinking...';
                chatArea.appendChild(loading);
                chatArea.scrollTop = chatArea.scrollHeight;'''

new_loading_indicator = '''                const professorSpeakingIndicator = document.createElement('div');
                professorSpeakingIndicator.className = 'professor-speaking-indicator';
                professorSpeakingIndicator.innerHTML = '💬 Professor is speaking...';
                chatArea.appendChild(professorSpeakingIndicator);
                
                const loading = document.createElement('div');
                loading.className = 'loading';
                loading.textContent = '';
                chatArea.appendChild(loading);
                chatArea.scrollTop = chatArea.scrollHeight;'''

html = html.replace(old_loading_indicator, new_loading_indicator)

# PATCH 9: Remove professor speaking indicator after loading
old_remove = '''                loading.remove();'''
new_remove = '''                loading.remove();
                professorSpeakingIndicator.remove();'''

html = html.replace(old_remove, new_remove, 1)  # Only replace the first occurrence in getQuestion

# Write the updated HTML
with open('./public/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("✅ All patches applied successfully!")
