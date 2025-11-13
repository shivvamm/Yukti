import type { PlasmoCSConfig } from "plasmo"
import { useState, useEffect } from "react"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false
}

interface Action {
  type: string
  target?: string
  value?: string
  confidence: number
}

interface ServerResponse {
  suggestions: string[]
  actions: Action[]
  lastUpdate: number | null
  error: string | null
}

const FloatingChatbot = () => {
  const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 80 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [serverData, setServerData] = useState<ServerResponse>({
    suggestions: [],
    actions: [],
    lastUpdate: null,
    error: null
  })
  const [executing, setExecuting] = useState<string | null>(null)

  // Fetch server suggestions
  const fetchServerSuggestions = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "GET_SERVER_SUGGESTIONS"
      })

      if (response) {
        setServerData(response)
        console.log("Chatbot: Received server data", response)
      }
    } catch (error) {
      console.error("Chatbot: Failed to get server suggestions:", error)
    }
  }

  // Initial load and periodic refresh
  useEffect(() => {
    fetchServerSuggestions()
    const interval = setInterval(fetchServerSuggestions, 60000) // Every minute
    return () => clearInterval(interval)
  }, [])

  // Listen for server update notifications
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === "SERVER_SUGGESTIONS_UPDATED") {
        console.log("Chatbot: Server suggestions updated!")
        fetchServerSuggestions()
        // Auto-open suggestions when new data arrives
        setShowSuggestions(true)
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [])

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - 60))
      const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 60))
      setPosition({ x: newX, y: newY })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    } else {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, dragOffset])

  const toggleSuggestions = () => {
    setShowSuggestions(!showSuggestions)
  }

  // Execute action
  const executeAction = async (action: Action) => {
    if (!confirm(`Execute action: ${action.type}${action.target ? ` on ${action.target}` : ''}?`)) {
      return
    }

    setExecuting(action.type)

    try {
      // Send action to content script for execution
      const result = await chrome.runtime.sendMessage({
        type: "EXECUTE_ACTION_REQUEST",
        action: action
      })

      // Log to server
      await chrome.runtime.sendMessage({
        type: "EXECUTE_ACTION",
        action: action,
        success: result?.success || false
      })

      if (result?.success) {
        alert(`Action "${action.type}" executed successfully!`)
      } else {
        alert(`Action "${action.type}" failed: ${result?.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error("Failed to execute action:", error)
      alert(`Action failed: ${error.message}`)

      // Log failure to server
      await chrome.runtime.sendMessage({
        type: "EXECUTE_ACTION",
        action: action,
        success: false
      })
    } finally {
      setExecuting(null)
    }
  }

  const hasSuggestions = serverData.suggestions.length > 0 || serverData.actions.length > 0

  return (
    <>
      {/* Floating Chatbot Icon */}
      <div
        style={{
          position: "fixed",
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: "60px",
          height: "60px",
          backgroundColor: hasSuggestions ? "#10b981" : "#4f46e5",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isDragging ? "grabbing" : "grab",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          zIndex: 999999,
          transition: isDragging ? "none" : "all 0.3s",
          userSelect: "none"
        }}
        onMouseDown={handleMouseDown}
        onClick={toggleSuggestions}
        onMouseEnter={(e) => {
          if (!isDragging) {
            e.currentTarget.style.transform = "scale(1.1)"
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)"
        }}>
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 2C6.48 2 2 6.48 2 12C2 13.54 2.36 14.99 3 16.26V21C3 21.55 3.45 22 4 22H8.74C10.01 22.64 11.46 23 13 23C18.52 23 23 18.52 23 13C23 6.48 18.52 2 12 2ZM9 11.5C8.17 11.5 7.5 10.83 7.5 10C7.5 9.17 8.17 8.5 9 8.5C9.83 8.5 10.5 9.17 10.5 10C10.5 10.83 9.83 11.5 9 11.5ZM15 11.5C14.17 11.5 13.5 10.83 13.5 10C13.5 9.17 14.17 8.5 15 8.5C15.83 8.5 16.5 9.17 16.5 10C16.5 10.83 15.83 11.5 15 11.5Z"
            fill="white"
          />
        </svg>
        {hasSuggestions && (
          <div
            style={{
              position: "absolute",
              top: "-5px",
              right: "-5px",
              width: "20px",
              height: "20px",
              backgroundColor: "#ef4444",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: "bold",
              color: "white",
              border: "2px solid white"
            }}>
            {serverData.suggestions.length + serverData.actions.length}
          </div>
        )}
      </div>

      {/* Suggestions Panel */}
      {showSuggestions && (
        <div
          style={{
            position: "fixed",
            left: position.x > window.innerWidth / 2 ? `${position.x - 320}px` : `${position.x + 70}px`,
            top: `${position.y}px`,
            width: "300px",
            maxHeight: "400px",
            backgroundColor: "white",
            borderRadius: "12px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
            zIndex: 999998,
            border: "1px solid #e5e7eb",
            fontFamily: "system-ui, -apple-system, sans-serif",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column"
          }}>
          {/* Arrow pointer */}
          <div
            style={{
              position: "absolute",
              top: "20px",
              [position.x > window.innerWidth / 2 ? "right" : "left"]: "-8px",
              width: 0,
              height: 0,
              borderTop: "8px solid transparent",
              borderBottom: "8px solid transparent",
              [position.x > window.innerWidth / 2 ? "borderLeft" : "borderRight"]:
                "8px solid white"
            }}
          />

          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #e5e7eb",
              backgroundColor: "#f9fafb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
            <div style={{ fontWeight: "600", fontSize: "14px", color: "#111827" }}>
              AI Suggestions
            </div>
            <button
              onClick={() => setShowSuggestions(false)}
              style={{
                background: "none",
                border: "none",
                fontSize: "18px",
                cursor: "pointer",
                color: "#6b7280",
                padding: 0
              }}>
              ×
            </button>
          </div>

          {/* Content */}
          <div style={{ overflowY: "auto", maxHeight: "340px" }}>
            {serverData.error && (
              <div
                style={{
                  padding: "12px 16px",
                  backgroundColor: "#fef2f2",
                  color: "#991b1b",
                  fontSize: "12px",
                  border: "1px solid #fecaca",
                  margin: "8px"
                }}>
                ⚠️ {serverData.error}
              </div>
            )}

            {!hasSuggestions && !serverData.error && (
              <div
                style={{
                  padding: "32px 16px",
                  textAlign: "center",
                  color: "#6b7280",
                  fontSize: "13px"
                }}>
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>🤖</div>
                <div>I'm learning your behavior...</div>
                <div style={{ fontSize: "11px", marginTop: "4px" }}>
                  Suggestions will appear after {30 - (serverData.lastUpdate ? 0 : 30)} more actions
                </div>
              </div>
            )}

            {/* Suggestions */}
            {serverData.suggestions.length > 0 && (
              <div style={{ padding: "8px" }}>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#6b7280",
                    marginBottom: "8px",
                    paddingLeft: "8px"
                  }}>
                  SUGGESTIONS
                </div>
                {serverData.suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    style={{
                      padding: "10px 12px",
                      marginBottom: "6px",
                      backgroundColor: "#f9fafb",
                      borderRadius: "8px",
                      fontSize: "13px",
                      lineHeight: "1.5",
                      color: "#374151",
                      display: "flex",
                      gap: "8px"
                    }}>
                    <span>💡</span>
                    <span>{suggestion}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            {serverData.actions.length > 0 && (
              <div style={{ padding: "8px", borderTop: serverData.suggestions.length > 0 ? "1px solid #e5e7eb" : "none" }}>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#6b7280",
                    marginBottom: "8px",
                    paddingLeft: "8px"
                  }}>
                  QUICK ACTIONS
                </div>
                {serverData.actions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => executeAction(action)}
                    disabled={executing === action.type}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      marginBottom: "6px",
                      backgroundColor: executing === action.type ? "#e5e7eb" : "#4f46e5",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: executing === action.type ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      if (executing !== action.type) {
                        e.currentTarget.style.backgroundColor = "#4338ca"
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (executing !== action.type) {
                        e.currentTarget.style.backgroundColor = "#4f46e5"
                      }
                    }}>
                    <span>{executing === action.type ? "Executing..." : `${getActionIcon(action.type)} ${action.type}`}</span>
                    <span style={{ fontSize: "11px", opacity: 0.8 }}>
                      {Math.round(action.confidence * 100)}%
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Last Update */}
            {serverData.lastUpdate && (
              <div
                style={{
                  padding: "8px 16px",
                  fontSize: "10px",
                  color: "#9ca3af",
                  textAlign: "center",
                  borderTop: "1px solid #e5e7eb"
                }}>
                Updated {getTimeAgo(serverData.lastUpdate)}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// Helper functions
function getActionIcon(type: string): string {
  const icons: { [key: string]: string } = {
    navigate: "🔗",
    click: "👆",
    fill_form: "📝",
    scroll: "📜",
    bookmark: "⭐",
    default: "⚡"
  }
  return icons[type] || icons.default
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default FloatingChatbot
