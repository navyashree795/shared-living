# Dashboard Screen Features Overview

This document provides a detailed breakdown of the features and functionalities implemented in the [DashboardScreen.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/screens/DashboardScreen.tsx) component.

---

## 1. Dynamic Styling & Aesthetics
* **Theme Support**: Integrated with the [useTheme](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/context/ThemeContext.tsx) context, switching colors (backgrounds, surfaces, text, borders) based on dark/light mode.
* **Background Decoration**: Features modern absolute-positioned decorative gradient blobs/circles matching sleek user interface designs.
* **Linear Gradients**: Uses `LinearGradient` for smooth, high-fidelity card and background styling.

---

## 2. Dynamic Hero / Greeting Card
* **Time-of-Day Themes**: Automatically selects color gradients, decorative borders, subtext messages, and weather/time icons based on the current hour (using NTP-synced time from [getSyncedDate](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/utils/timeUtils.ts)):
  * **Morning** (5:00 AM - 11:59 AM): Warm sunset orange/amber gradients, Amber `wb-sunny` icon, and welcoming morning-themed subtext.
  * **Afternoon** (12:00 PM - 4:59 PM): Sky blue/cyan gradients, Cyan `wb-sunny` icon, and energizing afternoon-themed subtext.
  * **Evening/Night** (5:00 PM - 4:59 AM): Deep purple/indigo gradients, Violet `nights-stay` icon, and relaxing evening-themed subtext.
* **Date Badge Display**: Prominently highlights the current day of the week and date (e.g. "WEDNESDAY, JUN 24").
* **Minimalist Design**: Removed user identity (`@username`) and action summary status to present a cleaner, premium card interface.

---

## 3. Daily Briefing / Action Items Panel
Aggregates and highlights priority items requiring immediate attention. Tapping any briefing card routes the user to the corresponding screen.
1. **Chores**: Shows a summary of pending chores assigned to the user that are scheduled for today (matches either the day of the week or a specific target date).
2. **Debts / Outstanding Balances**: Calculates real-time peer-to-peer split balances based on household expenses. Renders a red card (e.g., `"You currently owe [Name] ₹[Amount]"`) if the user has an outstanding balance.
3. **Groceries**: Shows a card (e.g., `"We are out of [Item Name] and X other items."`) if there are uncompleted items in the shared shopping list.

---

## 4. Real-time Activity Feed
* Subscribes to the Firestore `households/[householdId]/activities` collection in real-time, fetching the last 30 activities.
* Displays the top 3 most recent activities directly on the dashboard.
* Uses [getActivityConfig](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/utils/activityUtils.ts) to dynamically map activity types to dedicated colors, icons, and labels (e.g., chores, expenses, chats).

---

## 5. Household Hub Info & Custom Fields
Displays essential shared information in a horizontal scrolling card deck. By default, it manages **WiFi Network**, **WiFi Password** (hidden), **Landlord Contact**, and **Trash Truck Time**.
* **Actionable Field Types**:
  * **Password Fields**: Allows toggling visibility with a visibility eye icon.
  * **Phone Fields**: Initiates a phone call using `Linking.openURL("tel:...")` or copies to clipboard if dialing is unsupported.
  * **Link Fields**: Opens links in the browser via `Linking.openURL` or copies to clipboard.
  * **General Fields**: Copies value to clipboard on tap.
* **Household Customization (Owner Only)**:
  * Edit the household name.
  * Add completely custom fields with bespoke labels, values, icons, and types.
  * Delete existing fields.
  * Time fields leverage a modal-based custom [TimeWheelPicker](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/TimeWheelPicker.tsx).

---

## 6. House Team / Members Modal
Accessible via the header's people icon:
* **Invite Code**: Displays the unique household invite code with a quick copy button for onboarding new roommates.
* **Roommates List**: Shows display avatars and names of all current members.
* **Member Removal (Owner Only)**: Owners can remove members from the household, prompted by a destructive confirmation alert.

---

## 7. Notification Bell & Notifications Modal
Accessible via the bell icon:
* **New Notification Alert**: Sounds an audio beep and plays a spring scale animation on the bell icon when a new activity occurs.
* **Unread Count Tracking**: Saves the `lastSeenActivityTime` in `AsyncStorage` so that only activities created *after* the user's last view count as unread.
* **Activities Stream**: Filters notifications to show only activities performed by other roommates that are public or explicitly targeted to the current user.
* **Integrated Agenda**: Displays the Daily Agenda inside the modal for centralized tracking.

---

## 8. Household Switcher Modal
Tapping the household name in the header triggers a dropdown switcher:
* Queries all households where the current user is listed as a member.
* Allows switching the active household context instantly.
* Includes a dashed button navigating to the `HouseholdSelection` screen to create or join a new household.

---

## 9. User Profile & Side Menu Modals
* **Profile Editing**: A slide-up modal to update the display name, syncs changes directly back to the Firestore `users` collection.
* **Sign Out**: Logs out of the current Firebase Auth session.

---

## 10. Background Engines & Automation
* **Data Retention Policy**: Runs [enforceDataRetentionPolicy](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/utils/retentionUtils.ts) on component mount based on the household's billing cycle start day to maintain clean history.
* **Recurring Expenses Check**: Subscribes to recurring bills and calls [checkAndDraftRecurringExpenses](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/utils/expenseUtils.ts) in the background to automatically draft recurring expenses.
* **Chore Reminder Engine**: Runs an interval check every 30 seconds. If a chore is due in $\le 5$ minutes, updates Firestore to mark the reminder as sent and logs a `chore_reminder` activity from the "Assistant" chatbot.
* **Trash Truck Countdown & Alerts**: Runs a 1-second interval to check if `trashArrivalTime` is within 3 hours. Shows a real-time countdown (e.g. `20m`) on the dashboard card. Plays a warning chime and logs a `Trash Bot` alert activity exactly 10 minutes before the truck arrives.
