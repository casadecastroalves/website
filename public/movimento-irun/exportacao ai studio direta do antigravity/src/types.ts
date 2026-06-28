export interface Territory {
  id: string;
  name: string;
  category: string;
  coordinates: [number, number]; // [longitude, latitude]
  city: string;
  state: string;
  description: string;
  history: string;
  heritageStatus: string;
  leader?: string;
  founded?: string;
  activities: string[];
  imageUrl: string;
  contact?: string;
  rawFicha?: any;
}

export type FilterCategory = string;
