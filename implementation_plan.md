# Shareable Travel Cards Implementation Plan (Final Refined & Interactive)

Introduce a premium, shareable "Travel Wrap" card featuring a scenic road-trip trail showing up to 10 user-selected milestone activities, a customizable distance indicator, a dynamic trip duration metric, and custom tagline sub-branding.

## Final Visual Design Mockup

Here is the final design mockup edited directly from the preferred design, featuring a trip with 15 crew members, a trip duration of 8 days, 14 approved stops (showing milestones + remaining), and 1,250 km of distance traveled:

![Final Refined Travel Wrap Mockup](/home/jeevan/.gemini/antigravity-ide/brain/43cd4623-e273-4373-b1ef-1d0ca24f5812/travel_wrap_edited_mockup_1782894885140.png)

---

## User Review Required

> [!NOTE]
> **Interactive Milestone Selection (Up to 10 Spots)**
> To give the user full creative control over their card, the Travel Wrap preview screen will display a list of all approved itinerary items with checkboxes:
> 1. The user can **select up to 10 milestones** to plot on the winding road-trip trail map.
> 2. By default, the app automatically checks the first 10 chronological stops.
> 3. If they select more than 10, the app will show a friendly alert asking them to choose their top 10 milestones.
> 4. If the trip has more than 10 total approved activities, any unselected/remaining spots are automatically summed and displayed at the end of the trail as: **`...and N more stops explored!`** (e.g. `...and 14 more stops explored!`).

> [!IMPORTANT]
> **Trip Duration & Distance Input**
> - **Trip Duration:** Calculated dynamically as `endDate - startDate + 1 day` from `tripDetails`. If blank, it defaults to counting the days between the first and last itinerary events.
> - **Distance Traveled:** We will add a **"Distance Traveled (km)"** input field in the *Trip Details* edit modal, allowing users to enter their exact odometer reading. If blank, it defaults to a rough calculation of **45 km per approved activity**.

## Proposed Changes

### UI Components

#### [NEW] [TravelWrapModal.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/modals/TravelWrapModal.tsx)
Create the shareable wrap card:
- **Header:** House Sync logo, app branding, and the tagline *"Shared living made simpler"*.
- **Title:** Active Household Name dynamically loaded.
- **Top Row (Metrics & Profiles):**
  - **Left - Trip Crew:** Stack of up to 3 crew members' avatars + `+N` badge if `members.length > 3`.
  - **Center - Profile:** Large user profile photo.
  - **Right - Trip Duration:** Circular progress gauge displaying computed trip duration (e.g., *"8 Days"*).
- **Scenic Timeline Trail:**
  - Alternating layout displaying up to 10 user-selected itinerary stops connected by a vertical dashed road trail.
  - If `itineraryItems.length > 10`, render a custom footer badge at the end of the road saying: `"...and ${itineraryItems.length - 10} more stops explored!"`.
- **Footer:** Displays trip dates (from `tripDetails`) and distance traveled (user-inputted or computed fallback).
- **Interactive Checkbox Selector:** A list overlay on the modal allowing users to toggle checkboxes for each approved itinerary item to select their 10 highlighted milestones.
- **Sharing Trigger:** Captures the container view via `ViewShot` and opens the native share overlay using `expo-sharing`.

#### [MODIFY] [TripDetailsEditModal.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/modals/TripDetailsEditModal.tsx)
- Add a new input field: **"Estimated Distance (km)"** (allows numerical input).

### Integration & Dashboard

#### [MODIFY] [DashboardScreen.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/screens/DashboardScreen.tsx)
- Add trigger button `🎁 View Trip Wrap & Share`.
- Calculate trip stats to pass to `TravelWrapModal`.

---

## Verification Plan

### Automated Tests
- Run typecheck: `npx tsc --noEmit`.

### Manual Verification
- Verify that adding up to 10 itinerary activities results in a winding 10-node road trail.
- Test checking and unchecking different itinerary items, verifying the road map preview updates dynamically.
- Verify that setting the estimated distance in the Trip Details Modal correctly updates the distance indicator in the sharing card's footer.
