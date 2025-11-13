# Yukti - Complete Integration Guide

## 🎯 System Overview

**Yukti** is an AI-powered browser assistant that uses a multi-agent system to analyze user behavior and provide intelligent suggestions.

### Architecture Flow
```
Browser Extension → Batch Data (30 actions) → FastAPI Server → Multi-Agent System (Groq LLMs) → Suggestions & Actions → Floating Chatbot
```

---

## ✅ What We've Built (Steps 1-24 Complete)

### **1. Server (Multi-Agent System with Groq)**

#### Core Components:
- ✅ FastAPI Server with CORS
- ✅ LangGraph Multi-Agent Workflow
- ✅ 5 Specialized AI Agents (Groq Llama 3.1)
- ✅ API Endpoints (/analyze, /health, /action)
- ✅ Logging & Error Handling

#### Agents:
1. **Analyzer Agent** (Llama 3.1 8B) - Analyzes behavior patterns
2. **Predictor Agent** (Llama 3.1 8B) - Predicts next actions
3. **Suggestion Agent** (Llama 3.1 70B) - Generates suggestions
4. **Action Agent** (Llama 3.1 70B) - Determines actions
5. **Supervisor Agent** (Llama 3.1 70B) - Makes final decisions

### **2. Extension Integration**

#### Modified Files:
- ✅ `background.ts` - Server API integration with batch sending
- ✅ `chatbot-float.tsx` - Enhanced UI with server suggestions & actions
- ✅ `popup.tsx` - Data view organized by tabs & dates
- ✅ `behavior-monitor.ts` - Interaction tracking

#### Features:
- ✅ Batch sending (every 30 interactions)
- ✅ Server suggestion retrieval
- ✅ Action button display
- ✅ User confirmation dialogs
- ✅ Real-time notification badge
- ✅ Auto-open on new suggestions
- ✅ Draggable floating chatbot
- ✅ Error handling

---

## 🚀 Getting Started

### **Step 1: Set Up Server**

```bash
# Navigate to server directory
cd server

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
```

Edit `.env` and add your Groq API key:
```env
GROQ_API_KEY=gsk_your_api_key_here
```

**Get Free Groq API Key:** https://console.groq.com

### **Step 2: Start Server**

```bash
python main.py
```

Server runs at: `http://localhost:8000`
API Docs: `http://localhost:8000/docs`

### **Step 3: Test Server**

```bash
# Health check
curl http://localhost:8000/health

# Test analyze endpoint
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "interactions": [{"type": "click", "timestamp": 1699901234567, "url": "https://example.com"}],
    "current_url": "https://example.com"
  }'
```

### **Step 4: Load Extension**

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `Yukti/yukti/build/chrome-mv3-prod` directory
5. Extension is now active!

---

## 🎨 How It Works

### **Data Collection Phase** (Extension)
1. User browses the web
2. Extension tracks interactions (clicks, scrolls, navigation)
3. Data stored locally and organized by tab & date
4. Batch counter increments with each interaction

### **Analysis Phase** (Server)
1. After 30 interactions, extension sends batch to server
2. Server triggers LangGraph multi-agent workflow:
   ```
   START → Analyzer → Predictor → Suggestion → Action → Supervisor → END
   ```
3. Each agent processes data and passes to next
4. Supervisor makes final decision

### **Response Phase** (Extension)
1. Server returns suggestions and actions
2. Extension stores response in local storage
3. Chatbot receives notification
4. Floating icon changes to green with badge
5. User clicks icon to see AI suggestions
6. User can execute actions with one click

---

## 🧪 Testing Checklist

### Server Tests:
- [ ] Server starts without errors
- [ ] `/health` endpoint responds
- [ ] `/api/analyze` processes sample data
- [ ] Agents execute in sequence
- [ ] Groq API calls succeed

### Extension Tests:
- [ ] Floating chatbot appears on web pages
- [ ] Chatbot is draggable
- [ ] After 30 actions, data sent to server
- [ ] Chatbot displays server suggestions
- [ ] Action buttons appear and work
- [ ] Error handling works when server is down

### Integration Tests:
- [ ] Browse 30+ pages and see suggestions
- [ ] Suggestions are relevant
- [ ] Actions execute correctly
- [ ] Server logs actions
- [ ] Data persists correctly

---

## 📊 Data Flow Example

### Example User Journey:
```
1. User opens extension
   → Floating chatbot appears (blue icon)

2. User browses 30 pages
   → Extension tracks: clicks, scrolls, navigation
   → Batch counter: 30

3. Extension sends data to server
   → Console: "🚀 Sending batch to server (30 interactions)"

4. Server analyzes with AI agents
   → Analyzer: "User is researching products"
   → Predictor: "Likely to navigate to checkout"
   → Suggestion: "You might want to bookmark this site"
   → Action: "Navigate to comparison page"
   → Supervisor: "Show suggestions (confidence: 0.85)"

5. Extension receives response
   → Chatbot icon turns GREEN
   → Badge shows: "3" (3 items)

6. User clicks chatbot
   → Panel opens showing:
     • 2 AI suggestions
     • 1 action button ("Navigate to comparison")

7. User clicks action button
   → Confirmation dialog
   → Action executes
   → Result logged to server
```

---

## 🔧 Configuration

### Server Configuration (`server/.env`):
```env
# Groq API
GROQ_API_KEY=gsk_your_key

# Models
ANALYZER_MODEL=llama-3.1-8b-instant
SUPERVISOR_MODEL=llama-3.1-70b-versatile

# Server
HOST=0.0.0.0
PORT=8000

# Batching
BATCH_SIZE=50
```

### Extension Configuration (`background.ts`):
```typescript
const BATCH_SIZE = 30 // Send after N interactions
const SERVER_URL = "http://localhost:8000"
```

---

## 🐛 Troubleshooting

### Issue: "Server not responding"
**Solution:**
- Check server is running: `curl http://localhost:8000/health`
- Check GROQ_API_KEY is set in `.env`
- Check firewall/CORS settings

### Issue: "No suggestions appearing"
**Solution:**
- Perform 30+ actions to trigger batch send
- Check browser console for errors
- Verify server logs show request received

### Issue: "Actions not executing"
**Solution:**
- Check browser console for errors
- Ensure action executor is implemented
- Verify action format matches schema

---

## 📈 Next Steps

### Remaining Tasks (Steps 25-40):
1. **Action Executor** - Implement click/navigate/fill functions
2. **Advanced Testing** - End-to-end integration tests
3. **Prompt Optimization** - Improve agent prompts
4. **Deployment** - Deploy server to cloud
5. **Documentation** - API docs and usage examples

---

## 🎓 Learning Resources

- **LangGraph Docs:** https://python.langchain.com/docs/langgraph
- **Groq API:** https://console.groq.com/docs
- **FastAPI Docs:** https://fastapi.tiangolo.com
- **Chrome Extension API:** https://developer.chrome.com/docs/extensions

---

## 📝 Project Structure

```
Yukti/
├── server/               # Multi-agent AI server
│   ├── agents/          # 5 specialized agents
│   ├── graph/           # LangGraph workflow
│   ├── api/             # FastAPI routes
│   ├── config/          # Settings & configuration
│   ├── models/          # Pydantic schemas
│   ├── utils/           # Helper functions
│   └── main.py          # Server entry point
│
└── yukti/               # Browser extension
    ├── background.ts    # Server integration
    ├── contents/
    │   ├── behavior-monitor.ts  # Tracking
    │   └── chatbot-float.tsx    # Floating UI
    └── popup.tsx        # Extension popup
```

---

## 🤝 Contributing

To continue development:
1. Complete action executor implementation
2. Add more agent capabilities
3. Improve suggestion quality
4. Add telemetry and monitoring
5. Deploy to production

---

## 📧 Support

For issues or questions:
- Check console logs (browser & server)
- Review this integration guide
- Test each component individually
- Verify API key is valid

---

**Built with ❤️ using LangGraph, Groq, FastAPI, and React**

Version: 1.0.0 Beta
