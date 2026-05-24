$path = "C:\Users\jluna\.docker\cagent\working_directories\docker-gordon-v7\d210e0ab-3aa7-4b99-b0a4-5f2869e9472a\default\oral-exam-simulator\public\index.html"
$content = Get-Content $path -Raw

# IMPROVEMENT #1: Mobile Speech - Extended Duration
$content = $content -replace 'const SILENCE_THRESHOLD = 8000;', 'const SILENCE_THRESHOLD = 300000;  // IMPROVEMENT #1: 5 minutes max, no auto-stop'

# IMPROVEMENT #1: Set speechRecognizer.maxAlternatives
$content = $content -replace 'speechRecognizer\.continuous = true;', 'speechRecognizer.continuous = true; speechRecognizer.maxAlternatives = 1;  // IMPROVEMENT #1: Reduce overhead'

# IMPROVEMENT #1: Remove silence timer logic - replace with comment
$content = $content -replace 'if \(recognitionSilenceTimer\) clearTimeout\(recognitionSilenceTimer\);[\s]*recognitionSilenceTimer = setTimeout\(\(\) => \{[\s]*if \(isListening\) speechRecognizer\.stop\(\);[\s]*\}, SILENCE_THRESHOLD\);', '// IMPROVEMENT #1: REMOVED recognitionSilenceTimer - no auto-stop on silence'

# IMPROVEMENT #1: Update recording feedback message
$content = $content -replace 'document\.getElementById\(''speechFeedback''\)\.innerHTML = ''<div class=\\"speech-feedback\\">🎤 RECORDING\.\.\.</div>'';', 'document.getElementById("speechFeedback").innerHTML = ''<div class="speech-feedback">🎤 RECORDING... Click Stop to submit.</div>'';'

# Update Help section for mobile speech note
$content = $content -replace '(<p style="margin: 3px 0;"><strong>🎤 Speak:</strong>.*?</p>)', '$1<p style="margin: 3px 0;"><strong>Mobile Speech:</strong> On mobile, you may need to click Speak again if your answer is long. Keep clicking until you are finished speaking, then click Speak once more to submit.</p>'

Set-Content -Path $path -Value $content
Write-Output "✓ HTML updated with IMPROVEMENT #1 (Mobile Speech)"
