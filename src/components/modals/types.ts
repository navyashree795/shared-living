/*
 * FILE: src/components/modals/types.ts
 * PURPOSE: Type declarations for travelers, stops, and aggregated statistics models 
 *          rendering in TravelWrapModal.
 * WHERE USED: Loaded inside TravelWrapModal.tsx.
 */

// Interface representing the main traveler details
export interface Traveler {
  // Initials to display in place of profile pictures
  initials: string;
  // Full display name of the traveler
  name: string;
  // Home city or active location destination of the traveler
  city: string;
  // Optional URL link pointing to profile picture files
  photoUrl: string | null;
}

// Interface representing a household/trip member in the crew
export interface CrewMember {
  // Two-letter initials representing the roommate/member
  initials: string;
  // Optional profile picture URL
  photoUrl: string | null;
}

// Interface representing a stop milestone along the itinerary
export interface Stop {
  // Category emoji character (e.g. ⛰️ for mountain hikes)
  emoji: string;
  // Name of the activity stop (e.g. Jog Falls)
  name: string;
  // Calendar day number when this stop occurred
  day: number;
  // Optional flag indicating if this is the final stop on the trip
  isEnd?: boolean;
}

// Interface representing the final compiled trip wrap-up dataset
export interface TripData {
  // Main title label of the trip (e.g. Hampi Weekend)
  tripName: string;
  // Main Traveler details object
  mainTraveler: Traveler;
  // Start date string
  startDate: string;
  // End date string
  endDate: string;
  // Total trip length calculated in days
  durationDays: number;
  // Formatted string showing total distance explored
  kmCovered: string;
  // Total count of scheduled activities
  activities: number;
  // List of all companion crew members
  crew: CrewMember[];
  // Limit of visible crew circles rendered before showing "+X" badges
  maxVisibleCrew: number;
  // Selected milestone stops plotted along the road path
  stops: Stop[];
  // Total stops approved in the itinerary
  totalStops: number;
}
