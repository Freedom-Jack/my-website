export interface CountryData {
  rank: 'one' | 'two' | 'three' | 'four' | 'five' | 'six';
  description: string;
}

export interface MapData {
  [key: string]: CountryData;
}

export const mapData: MapData = {
  "United States": {
    rank: "one",
    description: "Primary work location and residence"
  },
  "Canada": {
    rank: "two",
    description: "Frequent collaboration with teams"
  },
  "United Kingdom": {
    rank: "two",
    description: "Regular client interactions"
  },
  "Germany": {
    rank: "three",
    description: "Project contributions"
  },
  "France": {
    rank: "three",
    description: "Technical consulting"
  },
  "Japan": {
    rank: "four",
    description: "Technology research"
  },
  "Australia": {
    rank: "four",
    description: "Remote collaboration"
  }
}; 