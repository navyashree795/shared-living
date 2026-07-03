export interface Traveler {
  initials: string;
  name: string;
  city: string;
  photoUrl: string | null;
}

export interface CrewMember {
  initials: string;
  photoUrl: string | null;
}

export interface Stop {
  emoji: string;
  name: string;
  day: number;
  isEnd?: boolean;
}

export interface TripData {
  tripName: string;
  mainTraveler: Traveler;
  startDate: string;
  endDate: string;
  durationDays: number;
  kmCovered: string;
  activities: number;
  crew: CrewMember[];
  maxVisibleCrew: number;
  stops: Stop[];
  totalStops: number;
}
