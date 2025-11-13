# Yukti Multi-Agent Server

AI-powered browser behavior analysis server using **LangGraph** multi-agent system with **Groq** (open-source LLMs).

## 🏗️ Architecture

```
Extension → Server → Multi-Agent System → Response
```

### Multi-Agent System

- **Analyzer Agent** (Llama 3.1 8B) - Analyzes user behavior patterns
- **Predictor Agent** (Llama 3.1 8B) - Predicts next likely actions
- **Suggestion Agent** (Llama 3.1 70B) - Generates helpful suggestions
- **Action Agent** (Llama 3.1 70B) - Determines specific actions
- **Supervisor Agent** (Llama 3.1 70B) - Makes final decisions

## 🚀 Quick Start

### 1. Prerequisites

- Python 3.9+
- Groq API Key ([Get one free](https://console.groq.com))

### 2. Installation

```bash
# Navigate to server directory
cd server

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configuration

Create `.env` file from example:

```bash
cp .env.example .env
```

Edit `.env` and add your Groq API key:

```env
GROQ_API_KEY=gsk_your_api_key_here
```

### 4. Run Server

```bash
# Development mode (with auto-reload)
python main.py

# Or use uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Server will start at: `http://localhost:8000`

API Documentation: `http://localhost:8000/docs`

## 📡 API Endpoints

### Health Check
```http
GET /health
```

### Analyze Behavior
```http
POST /api/analyze
Content-Type: application/json

{
  "interactions": [
    {
      "type": "click",
      "timestamp": 1699901234567,
      "url": "https://example.com",
      "elementType": "button"
    }
  ],
  "current_url": "https://example.com",
  "tab_id": 123
}
```

**Response:**
```json
{
  "success": true,
  "suggestions": [
    "You frequently visit this site. Consider bookmarking it."
  ],
  "actions": [
    {
      "type": "bookmark",
      "confidence": 0.85
    }
  ],
  "confidence": 0.85,
  "timestamp": 1699901234567
}
```

### Log Action
```http
POST /api/action
Content-Type: application/json

{
  "action_type": "click",
  "success": true
}
```

## 🧪 Testing

### Test Health Endpoint

```bash
curl http://localhost:8000/health
```

### Test Analyze Endpoint

```bash
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "interactions": [{
      "type": "click",
      "timestamp": 1699901234567,
      "url": "https://example.com"
    }],
    "current_url": "https://example.com"
  }'
```

## 📁 Project Structure

```
server/
├── main.py                 # FastAPI app entry point
├── requirements.txt        # Python dependencies
├── .env                   # Environment variables (create from .env.example)
├── .env.example           # Example environment variables
├── config/
│   ├── __init__.py
│   └── settings.py        # Configuration management
├── agents/
│   ├── __init__.py
│   ├── analyzer.py        # Analyzer agent
│   ├── predictor.py       # Predictor agent
│   ├── suggestion.py      # Suggestion agent
│   ├── action.py          # Action agent
│   └── supervisor.py      # Supervisor agent
├── graph/
│   ├── __init__.py
│   ├── state.py           # LangGraph state definition
│   └── workflow.py        # LangGraph workflow
├── api/
│   ├── __init__.py
│   └── routes.py          # API endpoints
├── models/
│   ├── __init__.py
│   └── schemas.py         # Pydantic models
└── utils/
    ├── __init__.py
    └── helpers.py         # Utility functions
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GROQ_API_KEY` | Groq API key (required) | - |
| `ANALYZER_MODEL` | Model for analyzer agent | `llama-3.1-8b-instant` |
| `PREDICTOR_MODEL` | Model for predictor agent | `llama-3.1-8b-instant` |
| `SUGGESTION_MODEL` | Model for suggestion agent | `llama-3.1-70b-versatile` |
| `ACTION_MODEL` | Model for action agent | `llama-3.1-70b-versatile` |
| `SUPERVISOR_MODEL` | Model for supervisor agent | `llama-3.1-70b-versatile` |
| `TEMPERATURE` | Model temperature | `0.7` |
| `MAX_TOKENS` | Max tokens per response | `1024` |
| `HOST` | Server host | `0.0.0.0` |
| `PORT` | Server port | `8000` |
| `DEBUG` | Debug mode | `True` |

### Available Groq Models

- `llama-3.1-8b-instant` - Fast, good for simple tasks
- `llama-3.1-70b-versatile` - Best for complex reasoning
- `mixtral-8x7b-32768` - Good balance of speed and quality
- `gemma-7b-it` - Google's open model

## 🌐 Deployment

### Docker (Coming Soon)

### Railway

1. Push code to GitHub
2. Create new project on [Railway](https://railway.app)
3. Add environment variables
4. Deploy!

### Render

1. Create new Web Service on [Render](https://render.com)
2. Connect your repository
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables
6. Deploy!

## 📊 Workflow Visualization

```
┌─────────┐
│  START  │
└────┬────┘
     │
     ▼
┌─────────────┐
│  ANALYZER   │ ← Analyzes behavior patterns
│  (Llama 8B) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  PREDICTOR  │ ← Predicts next actions
│  (Llama 8B) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ SUGGESTION  │ ← Generates suggestions
│ (Llama 70B) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   ACTION    │ ← Determines actions
│ (Llama 70B) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ SUPERVISOR  │ ← Makes final decision
│ (Llama 70B) │
└──────┬──────┘
       │
       ▼
┌─────────┐
│   END   │
└─────────┘
```

## 🐛 Troubleshooting

### "Invalid GROQ_API_KEY"

Make sure your API key:
- Starts with `gsk_`
- Is set in `.env` file
- Has no extra spaces or quotes

### "Module not found"

Make sure virtual environment is activated and dependencies are installed:
```bash
source venv/bin/activate
pip install -r requirements.txt
```

### "Port already in use"

Change port in `.env`:
```env
PORT=8001
```

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## 📧 Support

For issues, please open a GitHub issue.
