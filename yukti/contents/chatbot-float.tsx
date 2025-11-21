import type { PlasmoCSConfig } from "plasmo"
import { useState, useEffect } from "react"
import RobotIcon from "~components/RobotIcon"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false
}

interface ServerResponse {
  suggestions: string[]
  lastUpdate: number | null
  error: string | null
}

const FloatingChatbot = () => {
  const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 80 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null)
  const [serverData, setServerData] = useState<ServerResponse>({
    suggestions: [],
    lastUpdate: null,
    error: null
  })

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

  // Function to hide suggestions and clear timer
  const hideSuggestions = () => {
    setShowSuggestions(false)
    if (autoHideTimer) {
      clearTimeout(autoHideTimer)
      setAutoHideTimer(null)
    }
  }

  // Listen for server update notifications
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === "SERVER_SUGGESTIONS_UPDATED") {
        console.log("Chatbot: Server suggestions updated!")
        fetchServerSuggestions()

        // Clear any existing timer
        if (autoHideTimer) {
          clearTimeout(autoHideTimer)
        }

        // Auto-show suggestions when new data arrives
        setShowSuggestions(true)

        // Set 5-second auto-hide timer
        const timer = setTimeout(() => {
          setShowSuggestions(false)
          setAutoHideTimer(null)
        }, 5000)

        setAutoHideTimer(timer)
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [autoHideTimer])

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

  const hasSuggestion = serverData.suggestions.length > 0

  // Handle icon click - toggle suggestions
  const handleIconClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering document click

    // Prevent drag from triggering click
    if (!isDragging) {
      if (showSuggestions) {
        // Hide if already showing
        hideSuggestions()
      } else if (hasSuggestion) {
        // Show if we have suggestions
        setShowSuggestions(true)

        // Clear any existing timer
        if (autoHideTimer) {
          clearTimeout(autoHideTimer)
        }

        // Set 5-second auto-hide timer
        const timer = setTimeout(() => {
          setShowSuggestions(false)
          setAutoHideTimer(null)
        }, 5000)

        setAutoHideTimer(timer)
      }
    }
  }

  // Hide suggestions when clicking anywhere on screen
  useEffect(() => {
    if (showSuggestions) {
      const handleClickOutside = (e: MouseEvent) => {
        hideSuggestions()
      }

      // Small delay to prevent immediate close from icon click
      const timer = setTimeout(() => {
        document.addEventListener("click", handleClickOutside)
      }, 100)

      return () => {
        clearTimeout(timer)
        document.removeEventListener("click", handleClickOutside)
      }
    }
  }, [showSuggestions])

  return (
    <>
      {/* Floating Bot Icon */}
      <div
        style={{
          position: "fixed",
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: "52px",
          height: "52px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isDragging ? "grabbing" : "grab",
          filter: hasSuggestion
            ? "drop-shadow(0 4px 12px rgba(102, 126, 234, 0.6))"
            : "drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3))",
          zIndex: 999999,
          transition: isDragging ? "none" : "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          userSelect: "none"
        }}
        onMouseDown={handleMouseDown}
        onClick={handleIconClick}
        onMouseEnter={(e) => {
          if (!isDragging) {
            e.currentTarget.style.transform = "scale(1.08)"
            e.currentTarget.style.filter = hasSuggestion
              ? "drop-shadow(0 6px 16px rgba(102, 126, 234, 0.7))"
              : "drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4))"
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)"
          e.currentTarget.style.filter = hasSuggestion
            ? "drop-shadow(0 4px 12px rgba(102, 126, 234, 0.6))"
            : "drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3))"
        }}>
        <RobotIcon size={28} />
        {hasSuggestion && (
          <div
            style={{
              position: "absolute",
              top: "2px",
              right: "2px",
              width: "8px",
              height: "8px",
              backgroundColor: "#10b981",
              borderRadius: "50%",
              boxShadow: "0 0 4px #10b981",
              animation: "pulse 2s infinite"
            }}
          />
        )}
      </div>

      {/* Suggestion Tooltip */}
      {showSuggestions && hasSuggestion && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            left: position.x > window.innerWidth / 2 ? "auto" : `${position.x + 60}px`,
            right: position.x > window.innerWidth / 2 ? `${window.innerWidth - position.x + 8}px` : "auto",
            top: `${position.y + 8}px`,
            maxWidth: "200px",
            backgroundColor: "white",
            borderRadius: "10px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
            zIndex: 999998,
            padding: "10px 12px",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: "12px",
            lineHeight: "1.4",
            color: "#374151"
          }}>
          {/* Arrow pointer */}
          <div
            style={{
              position: "absolute",
              top: "12px",
              [position.x > window.innerWidth / 2 ? "right" : "left"]: "-6px",
              width: 0,
              height: 0,
              borderTop: "6px solid transparent",
              borderBottom: "6px solid transparent",
              [position.x > window.innerWidth / 2 ? "borderLeft" : "borderRight"]:
                "6px solid white"
            }}
          />
          {serverData.suggestions[0]}
        </div>
      )}
    </>
  )
}

export default FloatingChatbot
