export type Rank = 'one' | 'two' | 'three' | 'four' | 'five' | 'six'

export interface CountryData {
  rank: Rank
  description?: string
  visited?: boolean
  projects?: string[]
  experience?: string
  years?: number
}

export interface MapDataType {
  [countryName: string]: CountryData
} 