# Testing & Debugging Yukti

## How to Verify Monitoring is Working

### Method 1: Check Browser Console (Recommended)

1. **Open a test webpage** (e.g., https://example.com)

2. **Open Developer Tools**:
   - Press `F12` or `Ctrl+Shift+I` (Windows/Linux)
   - Press `Cmd+Option+I` (Mac)

3. **Go to Console tab** and look for:
   ```
   Yukti: Behavior monitoring initialized
   ```

4. **Interact with the page**:
   - Click on elements
   - Scroll up and down
   - Fill out forms (non-password fields)

5. **Watch for console logs** indicating tracking is active

### Method 2: Check Chrome Storage (Best for Details)

1. **Open Developer Tools** (`F12`)

2. **Go to Application tab** → **Storage** → **Local Storage** → **Extension ID**

3. **Look for these keys**:
   - `trackingEnabled`: Should be `true`
   - `interactions`: Array of recorded interactions
   - `patterns`: Analyzed behavior patterns
   - `trackClicks`, `trackScrolling`, etc.

4. **Click on `interactions`** to see JSON array of all recorded events

### Method 3: Use Extension Popup

1. **Click the Yukti extension icon** in your toolbar

2. **Go to the "Data" tab**:
   - Check **Total Interactions** count (should increase as you browse)
   - View **Top Sites** list
   - See **Tracking Since** date

3. **Go to "Home" tab**:
   - Should show AI suggestions based on your behavior
   - Quick stats showing interaction count

### Method 4: Export and View Data

1. **Click Yukti icon** → **Data tab**

2. **Click "Export Data (JSON)"**

3. **Open the downloaded file** in a text editor

4. **You'll see**:
   ```json
   {
     "interactions": [
       {
         "type": "click",
         "timestamp": 1234567890,
         "url": "https://example.com",
         "elementType": "BUTTON",
         "elementId": "submit-btn"
       }
     ],
     "patterns": {
       "frequentUrls": [...],
       "commonActions": [...]
     }
   }
   ```

### Method 5: Check Background Service Worker Logs

1. **Go to** `chrome://extensions/`

2. **Find "Yukti" extension**

3. **Click "Inspect views: service worker"** (blue link)

4. **In the console**, you should see:
   ```
   Yukti: Background service worker initialized
   Yukti: Patterns updated
   ```

5. **Interact with websites** and watch for messages like:
   - Recording interactions
   - Updating patterns

## Quick Test Checklist

- [ ] Extension loads without errors
- [ ] Consent screen appears on first use
- [ ] Accept consent enables tracking
- [ ] Console shows "monitoring initialized" on web pages
- [ ] Clicking elements adds interactions to storage
- [ ] Scrolling adds scroll events to storage
- [ ] Interaction count increases in Data tab
- [ ] Suggestions appear in Home tab after some browsing
- [ ] Settings toggles work (enable/disable tracking types)
- [ ] Pause button stops new interactions
- [ ] Export data works and shows collected data
- [ ] Delete all data clears storage

## Testing Different Tracking Types

### Test Click Tracking
1. Enable "Clicks" in Settings
2. Visit any website
3. Click buttons, links, images
4. Check storage for `type: "click"` entries

### Test Scroll Tracking
1. Enable "Scrolling" in Settings
2. Visit a long webpage
3. Scroll up and down
4. Check storage for `type: "scroll"` entries with `scrollDepth`

### Test Navigation Tracking
1. Enable "Navigation" in Settings
2. Visit multiple pages
3. Navigate between pages
4. Check storage for `type: "navigation"` entries

### Test Form Interactions
1. Enable "Form Interactions" in Settings
2. Visit a page with forms (e.g., search box)
3. Click into input fields (not password fields!)
4. Check storage for `type: "form_interaction"` entries

### Test Privacy Features

#### Verify Password Protection
1. Visit a login page
2. Click on password field
3. Check storage - should NOT see password field tracked
4. Console should not log password interactions

#### Verify Domain Blacklist
1. Visit a banking website (e.g., chase.com, wellsfargo.com)
2. Try to interact with page
3. Console should show: "Yukti: Domain is blacklisted for privacy"
4. No interactions should be recorded

## Debugging Common Issues

### Issue: No "monitoring initialized" message

**Check:**
- Is tracking enabled in Settings?
- Is extension loaded properly?
- Reload the webpage after enabling tracking

### Issue: Interactions not being recorded

**Check:**
- Open Service Worker console (chrome://extensions/)
- Look for errors in background worker
- Verify content script is injected (check page console)
- Check if domain is blacklisted

### Issue: No suggestions appearing

**Reason:** Need more data!
- Browse at least 5-10 different pages
- Interact with pages (click, scroll)
- Wait for pattern analysis (happens every 10 interactions)
- Reload popup to refresh suggestions

### Issue: Settings not persisting

**Check:**
- Open Application tab → Storage
- Verify settings are being saved to chrome.storage.local
- Check for storage quota errors in console

## Advanced Debugging: Add More Logs

If you want more detailed logging, you can temporarily add console.logs:

### In `contents/behavior-monitor.ts`:
```typescript
// Add after line where recordInteraction is called:
console.log("Recorded interaction:", interaction)
```

### In `background.ts`:
```typescript
// Add in recordInteraction function:
console.log("Storing interaction:", interaction)
console.log("Total interactions:", interactions.length)
```

Then rebuild:
```bash
yarn build
```

And reload the extension in Chrome.

## Test Data Generation Script

To quickly generate test data, open any webpage console and run:

```javascript
// Simulate clicks
for(let i = 0; i < 10; i++) {
  document.body.click()
}

// Simulate scrolls
window.scrollTo(0, 100 * Math.random())
```

## Monitoring Performance

Check if the extension impacts performance:

1. **Open Chrome Task Manager**: `Shift+Esc`
2. **Find "Yukti" processes**
3. **Monitor**:
   - Memory usage (should be < 50MB)
   - CPU usage (should be minimal when idle)

## Storage Inspection Commands

Run in extension popup console:

```javascript
// Get all stored data
chrome.storage.local.get(null, (data) => console.log(data))

// Get interaction count
chrome.storage.local.get(['interactions'], (data) => {
  console.log('Total interactions:', data.interactions?.length || 0)
})

// Get patterns
chrome.storage.local.get(['patterns'], (data) => {
  console.log('Patterns:', data.patterns)
})

// Clear all data (careful!)
chrome.storage.local.clear()
```

## Real-time Monitoring Setup

1. **Open Service Worker DevTools** (from chrome://extensions/)
2. **Open a test webpage with DevTools** (`F12`)
3. **Arrange windows side-by-side**
4. **Watch both consoles** as you interact with the page
5. **See real-time flow**:
   - Content script logs interaction
   - Background worker receives message
   - Storage is updated
   - Patterns are analyzed

---

**Pro Tip**: Use an incognito window for testing to start with a clean slate without your existing browsing data!
