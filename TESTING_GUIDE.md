# Quick Testing Guide

## How to Test Each Feature

### 1. Meta-Question Detection (Feature 1)
**Where**: During any exam, when professor asks a question

**Test Cases**:
```
Student: "What time is it?"
Expected: Professor responds with time info, Question counter stays same

Student: "Can you hear me?"
Expected: Professor confirms audio works, Question counter stays same

Student: "Can you repeat the question?"
Expected: Professor repeats previous question, Question counter stays same

Student: "Can you give me an example of that?"
Expected: Professor provides clarification, Question counter stays same

Student: "I don't understand, can you rephrase?"
Expected: Professor rephrases, Question counter stays same
```

**How to Verify**:
- Count remains same after meta-question responses
- Student can then answer original question
- Question advances only after actual answer

---

### 2. Google Search Query Refinement (Feature 2)
**Where**: Home screen → Select Course → Exam starts → Click "💡 Hint" → "🔍 Search Google"

**Test Cases**:
```
Professor asks: "Go ahead, please answer the question about photosynthesis"

Old behavior: Google searches "Go ahead please answer the question about photosynthesis"
New behavior: Google searches "photosynthesis"

Professor asks: "For this question, respond to: What is the citric acid cycle?"
Old behavior: Includes entire phrase in search
New behavior: Searches only "What is the citric acid cycle?"
```

**How to Verify**:
- Click Google Search button
- Verify search results are relevant to the question
- Search bar should show only the question, not preamble

---

### 3. Course Icons (Feature 3)
**Where**: Home screen → Course selection area

**Test Cases**:
```
Look for English courses:
- Should show 🇺🇸 (USA flag), NOT 🇬🇧 (British flag)
- Compare with mobile version - should match

Other courses:
- General Physics: ⚡
- Mathematics: 𝑥²
- Economics: 💼
- Anatomy: 🫀
- etc.
```

**How to Verify**:
- Scroll through course list
- Verify English course has USA flag
- All other icons display correctly
- Web version matches mobile version

---

### 4. Professor Speaking Indicator (Feature 4)
**Where**: During exam, when waiting for professor response

**Test Cases**:
```
1. Click Send answer
2. Should see "💬 Professor is speaking..." with blinking animation
3. Wait for response
4. Indicator disappears when response arrives
5. Test on both web and mobile
```

**How to Verify**:
- Indicator appears when clicking Send
- Animation blinks smoothly
- Disappears when response loaded
- Works on web and mobile browsers

---

### 5. Recording Button UX (Feature 6)
**Where**: During exam, bottom-right area → "🎤 Speak" button

**Test Cases**:
```
Initial state: Blue button "🎤 Speak"

Step 1: Click Speak button
- Button changes to red ⏹️ (stop square)
- Button pulses with red animation
- Textarea gets red border
- Audio recording starts

Step 2: Say something (e.g., "The mitochondria is the powerhouse of the cell")

Step 3: Click red ⏹️ button again
- Recording stops
- Button returns to blue "🎤 Speak"
- Textarea border returns to normal
- Shows "✓ X words captured" message

Verify: Word count is accurate
```

**How to Verify**:
- Watch button color change (Blue ↔ Red)
- Listen for recording start/stop
- Check word count accuracy
- Test on both web and mobile
- Recording should NOT auto-stop

---

### 6. Mobile/Web Alignment (Feature 5)
**Where**: Compare web browser with mobile phone/tablet

**Test Cases**:
```
Open exam on:
- Desktop web browser
- Mobile phone browser
- Tablet browser

Compare:
- Button sizes and positioning
- Button colors and styles
- Recording button behavior
- Text sizing
- Spacing between elements
- Layout responsiveness
- Recording animations
```

**How to Verify**:
- Open side-by-side on desktop and mobile
- Compare button layouts
- Check that all controls are accessible
- Verify recording works identically
- Test touch/click interactions

---

## Quick Test Checklist

### Feature 1: Meta-Question ✓
- [ ] Type "what time is it?" - Q doesn't advance
- [ ] Type "can you hear me?" - Q doesn't advance
- [ ] Type "repeat please" - Q doesn't advance
- [ ] Type "can you explain?" - Q doesn't advance
- [ ] Then answer with real answer - Q advances

### Feature 2: Search Refinement ✓
- [ ] Click Hint → Google Search
- [ ] Verify search removes "Go ahead..."
- [ ] Verify search removes "For this question..."
- [ ] Verify results are relevant

### Feature 3: Flags ✓
- [ ] English course shows 🇺🇸 not 🇬🇧
- [ ] Other courses show correct emojis
- [ ] Matches mobile version

### Feature 4: Speaking Indicator ✓
- [ ] Send answer
- [ ] See "💬 Professor is speaking..."
- [ ] Animation blinks
- [ ] Disappears when response arrives

### Feature 5: Recording Button ✓
- [ ] Click Speak → Blue to Red ⏹️
- [ ] Button pulses red
- [ ] Textarea has red border
- [ ] Click again → Red to Blue 🎤
- [ ] Word count shows

### Feature 6: Mobile/Web ✓
- [ ] All controls visible on mobile
- [ ] All controls visible on web
- [ ] Recording works the same
- [ ] Buttons are same size/style
- [ ] Layout responsive

---

## Troubleshooting

If features don't work:

1. **Clear browser cache**
   - Press F12 → Application → Clear Storage
   - Refresh page

2. **Check console for errors**
   - Press F12 → Console tab
   - Look for red error messages

3. **Verify Railway deployment**
   - Check Railway logs
   - Verify XAI_API_KEY is set
   - Restart container if needed

4. **Mobile device cache**
   - Clear browser app cache
   - Close and reopen browser
   - Try different browser if needed

---

## Expected Results

✅ All 6 features working together
✅ Meta-questions don't advance counter
✅ Google searches are cleaner
✅ English course has USA flag
✅ Professor speaking indicator visible
✅ Recording button is red when active
✅ Mobile and web look identical
✅ No console errors
✅ Performance is smooth

---

Ready to test! 🚀

