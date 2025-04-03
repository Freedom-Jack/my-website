"use client"

import React, { useState } from "react"
import { 
  ComposableMap, 
  Geographies, 
  Geography, 
  Sphere, 
  Graticule, 
  ZoomableGroup 
} from "react-simple-maps"
import { Tooltip } from "react-tooltip"
import { useTheme } from "next-themes"

// Import types and data
import { mapData } from "./map-data"
import type { CountryData, Rank } from "./types"

interface WorldMapProps {
  className?: string
}

// Theme-aware color mapping
const getRankColor = (rank: Rank | null, isDarkTheme: boolean): string => {
  if (!rank) return isDarkTheme ? "#2D3748" : "#EDF2F7"
  
  const colors = {
    light: {
      one: "#3182CE",
      two: "#4299E1",
      three: "#63B3ED",
      four: "#90CDF4",
      five: "#BEE3F8",
      six: "#EBF8FF"
    },
    dark: {
      one: "#2C5282",
      two: "#2B6CB0",
      three: "#3182CE",
      four: "#4299E1",
      five: "#63B3ED",
      six: "#90CDF4"
    }
  }
  
  return isDarkTheme ? colors.dark[rank] : colors.light[rank]
}

export function WorldMap({ className }: WorldMapProps) {
  const [tooltipContent, setTooltipContent] = useState<string>("")
  const { resolvedTheme } = useTheme()
  const isDarkTheme = resolvedTheme === "dark"
  
  // Handle geography rendering with better typing
  const handleGeographyRender = (geo: any) => {
    const countryName = geo.properties.NAME as string
    const countryData: CountryData | undefined = mapData[countryName]
    const countryRank = countryData?.rank || null
    
    return (
      <Geography
        key={geo.rsmKey}
        geography={geo}
        fill={getRankColor(countryRank, isDarkTheme)}
        stroke={isDarkTheme ? "#4A5568" : "#CBD5E0"}
        strokeWidth={0.5}
        style={{
          default: {
            outline: "none",
          },
          hover: {
            outline: "none",
            fill: isDarkTheme ? "#4299E1" : "#3182CE",
            transition: "all 250ms",
          },
          pressed: {
            outline: "none",
          },
        }}
        onMouseEnter={() => {
          if (countryData) {
            setTooltipContent(`
              <div class="font-medium">${countryName}</div>
              <div>${countryData.description || "Visited"}</div>
            `)
          }
        }}
        onMouseLeave={() => {
          setTooltipContent("")
        }}
        data-tooltip-id="world-map-tooltip"
      />
    )
  }

  return (
    <div className={className}>
      <div className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-lg border bg-card p-2 shadow-sm">
        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{
            scale: 180,
          }}
          style={{
            width: "100%",
            height: "auto",
          }}
        >
          <ZoomableGroup center={[0, 0]} zoom={1}>
            <Sphere 
              stroke={isDarkTheme ? "#4A5568" : "#CBD5E0"} 
              strokeWidth={0.5} 
              fill="transparent"
            />
            <Graticule 
              stroke={isDarkTheme ? "#4A5568" : "#E2E8F0"} 
              strokeWidth={0.5} 
              strokeOpacity={0.2}
            />
            <Geographies geography="/countries.json">
              {({ geographies }) => 
                geographies.map(geo => handleGeographyRender(geo))
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>
      <Tooltip 
        id="world-map-tooltip"
        html={true}
        className="z-50 max-w-xs rounded-md bg-popover p-2 text-sm text-popover-foreground shadow-md"
      />
    </div>
  )
} 