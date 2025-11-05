# What Yukti Tracks - Complete Breakdown

## Overview

Yukti tracks **5 types of user interactions** to learn your browsing behavior. All data is stored locally on your device.

---

## 1. Click Tracking 🖱️

**What it captures:**
- **Element Type**: What you clicked (BUTTON, A, DIV, IMG, etc.)
- **Element ID**: The `id` attribute if present
- **Element Class**: CSS classes if present
- **Element Text**: First 50 characters of text content
- **URL**: The page where you clicked
- **Timestamp**: When the click happened

**Example Data:**
```json
{
  "type": "click",
  "timestamp": 1699123456789,
  "url": "https://github.com/shivvamm/Yukti",
  "elementType": "BUTTON",
  "elementId": "submit-button",
  "elementClass": "btn btn-primary",
  "elementText": "Submit Form"
}
```

**What this reveals:**
- Which buttons/links you click most
- Common actions you perform
- UI elements you interact with
- Your click patterns on different sites

**Privacy filters applied:**
- ❌ Password fields - NEVER tracked
- ❌ Credit card inputs - NEVER tracked
- ❌ Banking sites - Automatically blocked
- ❌ Healthcare sites - Automatically blocked

---

## 2. Scroll Tracking 📜

**What it captures:**
- **Scroll Depth**: Percentage of page scrolled (0-100%)
- **URL**: Which page you scrolled on
- **Timestamp**: When you scrolled

**Example Data:**
```json
{
  "type": "scroll",
  "timestamp": 1699123457890,
  "url": "https://medium.com/article",
  "scrollDepth": 75
}
```

**What this reveals:**
- How far you typically read articles
- Whether you engage with content fully or just skim
- Pages where you read to the bottom
- Content that doesn't interest you (low scroll depth)

**How it works:**
- Only records when scroll depth changes by 10% or more
- Debounced (waits 500ms after you stop scrolling)
- Reduces noise from rapid scrolling

---

## 3. Navigation Tracking 🧭

**What it captures:**
- **URL**: The page you navigated to
- **Timestamp**: When you arrived
- **Time Spent**: How long you stayed on the previous page

**Example Data:**
```json
{
  "type": "navigation",
  "timestamp": 1699123458901,
  "url": "https://stackoverflow.com/questions/12345"
}
```

**What this reveals:**
- Which sites you visit most frequently
- Your browsing patterns and routines
- Sites you return to regularly
- Navigation flow between pages

**Works with:**
- Regular page loads
- Single Page Applications (SPAs) that change URL without reload
- Browser back/forward navigation

---

## 4. Time Spent Tracking ⏱️

**What it captures:**
- **URL**: The page you were on
- **Time Spent**: Duration in milliseconds
- **Timestamp**: When you left the page

**Example Data:**
```json
{
  "type": "time_spent",
  "timestamp": 1699123459912,
  "url": "https://youtube.com/watch?v=xyz",
  "timeSpent": 180000
}
```

**What this reveals:**
- Pages where you spend most time
- Sites you just glance at vs. deeply engage with
- Your attention patterns
- Time of day browsing habits

**Tracked when:**
- You navigate to a new page
- You close the tab
- You switch tabs
- Page unloads

---

## 5. Form Interaction Tracking 📝

**What it captures:**
- **Element Type**: Input field type (text, email, search, etc.)
- **Element ID**: Field identifier
- **URL**: Page with the form
- **Timestamp**: When you focused on the field

**Example Data:**
```json
{
  "type": "form_interaction",
  "timestamp": 1699123460923,
  "url": "https://example.com/contact",
  "elementType": "INPUT",
  "elementId": "email-field"
}
```

**What this reveals:**
- Forms you frequently interact with
- Search behavior
- Newsletter signups
- Contact form usage

**IMPORTANT:**
- ⚠️ **Disabled by default** (more sensitive)
- Only tracks FOCUS events (when you click into a field)
- Does NOT capture what you type
- Does NOT track password fields
- Does NOT track credit card fields
- Filters out any `type="password"` inputs

---

## Privacy Filters Applied to ALL Tracking

### Automatic Sensitive Input Detection

**These input types are NEVER tracked:**
```javascript
- type="password"
- type="credit-card-number"
- type="cc-number"
- type="card-number"
- type="cardnumber"
- name containing "password"
- name containing "credit-card"
- id containing "password"
- autocomplete containing sensitive keywords
```

### Automatic Domain Blacklist

**These domains are NEVER tracked:**
```javascript
Keywords that block tracking:
- "bank"
- "paypal"
- "stripe"
- "healthcare"
- "medical"
- "health"
- "hospital"
```

**Examples of auto-blocked sites:**
- chase.com (bank)
- wellsfargo.com (bank)
- paypal.com (payment)
- stripe.com (payment)
- healthcare.gov (healthcare)
- mayoclinic.org (medical)

---

## What We DON'T Track

### Never Tracked:
- ❌ **Passwords** - Any password field is completely ignored
- ❌ **Credit card numbers** - Payment info is filtered out
- ❌ **What you type** - Only that you clicked a field, not the content
- ❌ **Banking transactions** - Banking domains are blacklisted
- ❌ **Private browsing** - Only works in regular tabs
- ❌ **File uploads** - File input fields are not tracked
- ❌ **Screenshots** - No visual capture of pages
- ❌ **Microphone/Camera** - No audio/video recording
- ❌ **Browser history** - Only pages where extension is active
- ❌ **Bookmarks** - Not accessed
- ❌ **Downloads** - Not tracked
- ❌ **Extensions** - Other extensions are not monitored

### Metadata NOT Collected:
- ❌ Your name or email
- ❌ IP address
- ❌ Geographic location
- ❌ Device fingerprint
- ❌ Operating system details
- ❌ Screen resolution
- ❌ Browser version
- ❌ Installed extensions list

---

## How Patterns Are Analyzed

Every 10 interactions, Yukti analyzes your data to find patterns:

### 1. Frequent URLs
```javascript
// Counts how often you visit each URL
{
  "url": "https://github.com",
  "count": 47,
  "lastVisit": 1699123456789
}
```

### 2. Common Actions
```javascript
// Identifies repeated behaviors
{
  "type": "BUTTON",
  "element": "search-button",
  "count": 23
}
```

### 3. Average Time Spent
```javascript
// Calculates typical time per site
{
  "https://youtube.com": 240000,  // 4 minutes average
  "https://twitter.com": 120000   // 2 minutes average
}
```

### 4. Scroll Behavior
```javascript
// Analyzes how deeply you read content
{
  "https://medium.com/article-1": [85, 90, 95, 100],  // Full reads
  "https://news.site/article-2": [10, 15, 20]         // Just skimming
}
```

---

## Storage Limits

### Maximum Data Stored:
- **10,000 interactions** maximum
- Oldest interactions are automatically deleted when limit is reached
- Typical interaction size: ~200 bytes
- Maximum storage usage: ~2 MB

### Retention:
- Data is kept until you:
  - Delete it manually (Data tab → Delete All Data)
  - Uninstall the extension
  - Clear browser data
- No automatic expiration
- No cloud sync

---

## Data Structure Example

Here's what your complete stored data looks like:

```json
{
  "trackingEnabled": true,
  "isPaused": false,
  "trackClicks": true,
  "trackScrolling": true,
  "trackNavigation": true,
  "trackFormInteractions": false,

  "interactions": [
    {
      "type": "click",
      "timestamp": 1699123456789,
      "url": "https://example.com",
      "elementType": "BUTTON",
      "elementId": "submit"
    },
    {
      "type": "scroll",
      "timestamp": 1699123457890,
      "url": "https://example.com",
      "scrollDepth": 50
    }
    // ... up to 10,000 interactions
  ],

  "patterns": {
    "frequentUrls": [
      {
        "url": "https://github.com",
        "count": 47,
        "lastVisit": 1699123456789
      }
    ],
    "commonActions": [
      {
        "type": "BUTTON",
        "element": "search",
        "count": 23
      }
    ],
    "avgTimeSpent": {
      "https://github.com": 180000,
      "https://stackoverflow.com": 120000
    },
    "scrollBehavior": {
      "https://medium.com": [85, 90, 95, 80, 75]
    }
  }
}
```

---

## Toggle Controls

You can enable/disable each tracking type in Settings:

| Feature | Default | What it controls |
|---------|---------|------------------|
| **Enable Tracking** | OFF | Master switch for all tracking |
| **Pause Tracking** | OFF | Temporarily stop without losing data |
| **Track Clicks** | ON | Click events on elements |
| **Track Scrolling** | ON | Scroll depth on pages |
| **Track Navigation** | ON | Page visits and URLs |
| **Track Form Interactions** | OFF | Focus events on form fields |

---

## Use Cases - What This Data Enables

### Current Features:
1. **Frequently visited sites suggestions**
2. **Time spent analysis** - "You typically spend 5 minutes here"
3. **Scroll behavior insights** - "You usually don't scroll much on this page"
4. **Activity level tracking** - "You've been very active, consider a break"
5. **Site visit count** - "You've visited 15 pages on this domain"

### Future AI Capabilities:
- Predict what you want to do next
- Suggest relevant bookmarks
- Identify productivity patterns
- Recommend content based on reading depth
- Optimize your workflow
- Time management suggestions
- Distraction detection

---

## Viewing Your Tracked Data

### Method 1: Extension Popup
1. Click Yukti icon
2. Go to **Data** tab
3. See total interactions and top sites

### Method 2: Export JSON
1. Data tab → **Export Data (JSON)**
2. Opens downloaded file in text editor
3. See complete raw data

### Method 3: Chrome Storage Inspector
1. Open DevTools on any page (`F12`)
2. Go to **Application** tab
3. Storage → Local Storage → Extension ID
4. Click on `interactions` to browse

### Method 4: Console Commands
Run in popup console:
```javascript
chrome.storage.local.get(['interactions'], (data) => {
  console.table(data.interactions)
})
```

---

## Summary

### What IS tracked:
✅ Click events (element type, ID, class)
✅ Scroll depth (0-100%)
✅ Page navigation (URLs visited)
✅ Time spent (duration on pages)
✅ Form field focus (optional, non-sensitive only)

### What is NOT tracked:
❌ Passwords or sensitive inputs
❌ What you type in forms
❌ Credit card or payment info
❌ Banking/healthcare site interactions
❌ Personal identifiable information
❌ Data sent to external servers

### Storage:
💾 Stored locally on your device only
💾 Maximum 10,000 interactions
💾 ~2 MB maximum storage
💾 No cloud sync or external transmission

### Control:
🎛️ Opt-in by default (disabled until you consent)
🎛️ Granular per-feature toggles
🎛️ Pause anytime
🎛️ Export your data
🎛️ Delete all data with one click
