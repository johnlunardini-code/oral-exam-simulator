#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read the HTML file
const htmlPath = path.join(__dirname, 'public', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf-8');

console.log('[PATCH] Starting to apply frontend patches...');

// PATCH 1: Update extractQuestionOnly function
console.log('[PATCH 1] Updating extractQuestionOnly...');
const oldExtract = `function extractQuestionOnly(text) {
            if (!text) return '';
            
            // Remove introductory text patterns (professor greetings, format explanations, instructions)
            let cleaned = text.replace(/^.*?(?:Hello|Hi|Good|Dear|Welcome),\\s+[^.!?]*[.!?]\\s+/i, '').trim();
            cleaned = cleaned.replace(/^.*?(?:This exam|The exam|In this exam|Here is|We will)[^?]*\\.\\s+/i, '').trim();
            cleaned = cleaned.replace(/^.*?(?:For this question|Please answer|Respond to)[^?]*\\s+/i, '').trim();
            
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
        }`;

const newExtract = `function extractQuestionOnly(text) {
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
        }`;

if (html.includes(oldExtract)) {
    html = html.replace(oldExtract, newExtract);
    console.log('  ✓ extractQuestionOnly updated');
} else {
    console.log('  ⚠ Could not find extractQuestionOnly to update');
}

// PATCH 2: Add updateRecordingUI function
console.log('[PATCH 2] Adding updateRecordingUI...');
const newUpdateFunction = `
        
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
        }`;

const toggleSpeechPos = html.indexOf('function toggleSpeech() {');
if (toggleSpeechPos > -1) {
    const toggleEnd = html.indexOf('}', html.indexOf('startRecording();', toggleSpeechPos)) + 1;
    if (!html.includes('function updateRecordingUI')) {
        html = html.slice(0, toggleEnd) + newUpdateFunction + html.slice(toggleEnd);
        console.log('  ✓ updateRecordingUI added');
    } else {
        console.log('  ⚠ updateRecordingUI already exists');
    }
}

// PATCH 3: Update speechRecognizer.onstart
console.log('[PATCH 3] Updating speechRecognizer.onstart...');
const oldOnstart = `speechRecognizer.onstart = () => {
                isListening = true;
                recognitionTranscript = '';
                document.getElementById('answerInput').value = '';
                document.getElementById('answerInput').classList.add('recording-active');
                document.getElementById('speechButton').classList.add('active');
                document.getElementById('speechButton').textContent = '⏹️ Stop';
                document.getElementById('speechFeedback').innerHTML = '<div class="speech-feedback">🎤 RECORDING...</div>';
            };`;

const newOnstart = `speechRecognizer.onstart = () => {
                isListening = true;
                recognitionTranscript = '';
                document.getElementById('answerInput').value = '';
                updateRecordingUI(true);
                document.getElementById('speechFeedback').innerHTML = '<div class="speech-feedback">🎤 RECORDING...</div>';
            };`;

if (html.includes(oldOnstart)) {
    html = html.replace(oldOnstart, newOnstart);
    console.log('  ✓ speechRecognizer.onstart updated');
}

// PATCH 4: Update speechRecognizer.onend
console.log('[PATCH 4] Updating speechRecognizer.onend...');
const oldOnend = `speechRecognizer.onend = () => {
                isListening = false;
                document.getElementById('answerInput').classList.remove('recording-active');
                document.getElementById('speechButton').classList.remove('active');
                document.getElementById('speechButton').textContent = '🎤 Speak';
                const wordCount = recognitionTranscript.trim().split(/\\s+/).length;
                if (wordCount > 0) {
                    document.getElementById('speechFeedback').innerHTML = \`<div class="speech-feedback">✓ \${wordCount} word\${wordCount !== 1 ? 's' : ''} captured</div>\`;
                    setTimeout(() => { document.getElementById('speechFeedback').innerHTML = ''; }, 3000);
                }
            };`;

const newOnend = `speechRecognizer.onend = () => {
                isListening = false;
                updateRecordingUI(false);
                const wordCount = recognitionTranscript.trim().split(/\\s+/).length;
                if (wordCount > 0) {
                    document.getElementById('speechFeedback').innerHTML = \`<div class="speech-feedback">✓ \${wordCount} word\${wordCount !== 1 ? 's' : ''} captured</div>\`;
                    setTimeout(() => { document.getElementById('speechFeedback').innerHTML = ''; }, 3000);
                }
            };`;

if (html.includes(oldOnend)) {
    html = html.replace(oldOnend, newOnend);
    console.log('  ✓ speechRecognizer.onend updated');
}

// PATCH 5: Update CSS
console.log('[PATCH 5] Updating CSS for recording animations...');
const oldCSS = `.recording-active { border: 3px solid #e74c3c !important; animation: pulse 0.5s infinite; }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.5); } 70% { box-shadow: 0 0 0 10px rgba(231, 76, 60, 0); } 100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0); } }`;

const newCSS = `.recording-active { 
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
        }`;

if (html.includes(oldCSS)) {
    html = html.replace(oldCSS, newCSS);
    console.log('  ✓ CSS animations updated');
}

// PATCH 6: Professor Speaking Indicator - Add to getQuestion
console.log('[PATCH 6] Adding professor speaking indicator...');
const oldLoading = `                const loading = document.createElement('div');
                loading.className = 'loading';
                loading.textContent = 'Professor thinking...';
                chatArea.appendChild(loading);
                chatArea.scrollTop = chatArea.scrollHeight;`;

const newLoading = `                const professorSpeakingIndicator = document.createElement('div');
                professorSpeakingIndicator.className = 'professor-speaking-indicator';
                professorSpeakingIndicator.innerHTML = '💬 Professor is speaking...';
                chatArea.appendChild(professorSpeakingIndicator);
                
                const loading = document.createElement('div');
                loading.className = 'loading';
                loading.textContent = '';
                chatArea.appendChild(loading);
                chatArea.scrollTop = chatArea.scrollHeight;`;

if (html.includes(oldLoading)) {
    html = html.replace(oldLoading, newLoading);
    console.log('  ✓ Professor speaking indicator added');
}

// PATCH 7: Remove professor speaking indicator
console.log('[PATCH 7] Updating indicator removal...');
if (!html.includes('professorSpeakingIndicator.remove()')) {
    const indicatorIdx = html.indexOf('loading.remove();');
    if (indicatorIdx > -1) {
        html = html.substring(0, indicatorIdx) + 'loading.remove();\n                professorSpeakingIndicator.remove();' + html.substring(indicatorIdx + 'loading.remove();'.length);
        console.log('  ✓ Indicator removal added');
    }
}

// Write back
fs.writeFileSync(htmlPath, html, 'utf-8');
console.log('\n✅ All patches applied successfully!');
