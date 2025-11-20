import { useEffect, useState } from "react"

interface RobotIconProps {
  size?: number
}

const RobotIcon = ({ size = 52 }: RobotIconProps) => {
  const [isBlinking, setIsBlinking] = useState(false)

  useEffect(() => {
    const scheduleNextBlink = () => {
      // Random interval between 1-5 seconds
      const randomDelay = Math.random() * 4000 + 1000 // 1000-5000ms

      setTimeout(() => {
        setIsBlinking(true)

        // Blink duration (200ms)
        setTimeout(() => {
          setIsBlinking(false)
          scheduleNextBlink() // Schedule next blink
        }, 200)
      }, randomDelay)
    }

    scheduleNextBlink()
  }, [])

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        filter: "drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3))"
      }}>

      {/* Outer Frame */}
      <rect x="10" y="15" width="80" height="70" rx="12" fill="#1e293b" />
      <rect x="12" y="17" width="76" height="66" rx="10" fill="#334155" />

      {/* Top Antenna */}
      <rect x="43" y="8" width="14" height="10" rx="2" fill="#10b981" />
      <rect x="45" y="5" width="10" height="5" rx="1" fill="#34d399" />

      {/* Head/Screen Area */}
      <rect x="20" y="28" width="60" height="40" rx="8" fill="#0f172a" />

      {/* Cyan accent lines */}
      <rect x="18" y="30" width="3" height="36" rx="1.5" fill="#06b6d4" />
      <rect x="79" y="30" width="3" height="36" rx="1.5" fill="#06b6d4" />
      <rect x="24" y="24" width="52" height="3" rx="1.5" fill="#06b6d4" />

      {/* Eyes - Glowing effect */}
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Left Eye */}
      <g style={{
        opacity: isBlinking ? 0 : 1,
        transition: "opacity 0.1s ease-in-out"
      }}>
        <rect
          x="32"
          y="42"
          width="14"
          height="14"
          rx="3"
          fill="#10b981"
          filter="url(#glow)"
        />
        <rect
          x="34"
          y="44"
          width="10"
          height="10"
          rx="2"
          fill="#d0f0c0"
          opacity="0.8"
        />
      </g>

      {/* Right Eye */}
      <g style={{
        opacity: isBlinking ? 0 : 1,
        transition: "opacity 0.1s ease-in-out"
      }}>
        <rect
          x="54"
          y="42"
          width="14"
          height="14"
          rx="3"
          fill="#10b981"
          filter="url(#glow)"
        />
        <rect
          x="56"
          y="44"
          width="10"
          height="10"
          rx="2"
          fill="#d0f0c0"
          opacity="0.8"
        />
      </g>

      {/* Blinking eyes (closed) */}
      {isBlinking && (
        <>
          <rect x="32" y="48" width="14" height="3" rx="1.5" fill="#10b981" />
          <rect x="54" y="48" width="14" height="3" rx="1.5" fill="#10b981" />
        </>
      )}

      {/* Bottom section details */}
      <rect x="25" y="72" width="50" height="8" rx="2" fill="#1e293b" />

      {/* Side accent bars */}
      <rect x="18" y="74" width="3" height="4" rx="1" fill="#10b981" />
      <rect x="22" y="74" width="2" height="4" rx="1" fill="#10b981" />
      <rect x="79" y="74" width="3" height="4" rx="1" fill="#10b981" />
      <rect x="76" y="74" width="2" height="4" rx="1" fill="#10b981" />

      {/* Bottom mouth/vent */}
      <rect x="38" y="75" width="24" height="4" rx="2" fill="#06b6d4" />
      <rect x="40" y="76" width="20" height="2" rx="1" fill="#67e8f9" opacity="0.6" />

      {/* Corner details */}
      <circle cx="24" cy="24" r="2" fill="#06b6d4" opacity="0.7" />
      <circle cx="76" cy="24" r="2" fill="#06b6d4" opacity="0.7" />
    </svg>
  )
}

export default RobotIcon
