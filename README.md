# 🏠 House Sync: Shared Living & Travel App

[![Expo](https://img.shields.io/badge/Expo-SDK%2054-000000.svg?style=flat-square&logo=expo&logoColor=white)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.81.5-61dafb.svg?style=flat-square&logo=react&logoColor=black)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-3178c6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-v12.11.0-ffca28.svg?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-NativeWind-38bdf8.svg?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Sentry](https://img.shields.io/badge/Sentry-Enabled-362d59.svg?style=flat-square&logo=sentry&logoColor=white)](https://sentry.io/)

A premium, modern React Native mobile application built on **Expo SDK 54** and **Firebase**. **House Sync** is designed to streamline shared household logistics for roommates, couples, and traveling groups. It handles chore rotations, split billing, grocery lists, group chats, household information (WiFi/Landlord/Garbage schedules), and generates beautiful, shareable **"Travel Wrap"** road-trip summaries.

---

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| **🏠 Unified Dashboard** | Real-time overview of active household states, quick actions (add expense/chore/grocery), upcoming trash collections (with custom count-down timers), and recent chat previews. |
| **🛒 Smart Grocery Manager** | Dynamic list sorting and categorization. Swipe to delete or perform a **Quick Buy**, which prompts for total checkout costs and automatically splits and logs the expense to the household billing registry. |
| **💸 Expense Splitter** | Manage shared bills and peer-to-peer (P2P) balances. Select splitting roommates, log payments/settlements, and review transaction history. Mathematically formats and simplifies debts between members. |
| **🧹 Chore Rotations & Alarms** | Assign daily, weekly, or monthly tasks with customized time-wheel pickers. Supports automated rotation orders, completion streak trackers, and schedules local push notifications on the device. |
| **💬 Live Roomie Chat** | Real-time group messaging built directly into the household context. Includes keyboard-avoiding inputs and visual user avatars. |
| **⚙️ Household Admin** | Manage multiple households. Join via unique **Invite Codes**, edit shared info like WiFi details, trash routine timings, and landlord contacts. |
| **🗺️ Travel Wrap** | Track trip itineraries, customize milestone achievements, and render a **3D perspective road vector map** (with custom scenery) showing your journey. Exports a beautiful graphic card to share with friends. |

---

## 🛠️ Technology Stack

* **Frontend Framework**: [Expo SDK 54](https://expo.dev/) (React Native 0.81.5)
* **Language**: [TypeScript](https://www.typescriptlang.org/) (strict type-checking)
* **Styling & Theme**: [NativeWind (Tailwind CSS v4)](https://www.nativewind.dev/) with full Dark/Light theme switching
* **Database & Auth**: [Firebase v12 Client SDK](https://firebase.google.com/) (Authentication, Cloud Firestore, Cloud Storage, Callable Functions)
* **Animations**: [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/) & [Gesture Handler](https://docs.swmansion.com/react-native-gesture-handler/)
* **Local Notifications**: `expo-notifications` for scheduled alarms
* **Graphics**: `react-native-svg` for perspective road mappings and `react-native-view-shot` for image exports
* **Diagnostics**: `@sentry/react-native` for crash reports and logs

---

## 👥 Contributors & Task Split

The development of **House Sync** was split collaboratively between the co-creators based on git history:

### 👩‍💻 Navyashree
* **Core Household & Dashboard Screens**: Implemented the base dashboard screen layout, real-time activity indicators, notification sound integration, and garbage reminder metrics.
* **Chore & Task Management**: Created the initial chore board system with assignee selections, streaks, daily/weekly task categories, custom slide sheet modals, and the time-wheel selection picker.
* **P2P Billing & Expense Registry**: Built the base layout for debt management (`ExpenseScreen`) with Firebase integration to create, fetch, and settle roommate balances.
* **Group Chat Engine**: Built the real-time messages room with read-receipt markers, scroll containers, and emoji configurations.
* **Utility Scripts**: Configured maps credentials and synced package dependency versions.

### 👨‍💻 Jeevan R
* **Travel Wrap Feature**: Designed and engineered the 3D perspective road-trip canvas, milestone selection checkboxes, date calculations, and sharing triggers using `react-native-view-shot` image capture.
* **Premium Dashboard & UI Redesign**: Redesigned the primary interface using vibrant HSL-tailored colors, dynamic gradient overlays, dark mode compatibility, and high-fidelity typography.
* **Keyboard Usability & Mobile Layout Fixes**: Optimized input screen layouts across Android/iOS devices using automated keyboard avoidance scrolling and validation alerts.
* **EAS Native Build & CI Setup**: Set up EAS profiles, fixed config plugin overrides for date-pickers, resolved package conflicts, and managed native app requirements.
* **Security & Automation Logic**: Established strict household boundaries in `firestore.rules`, and implemented background geofencing location triggers to automate roommate check-in status.

---

## 📂 Directory Layout

```yaml
.
├── App.tsx                     # App entry point, wraps global context provider tree (Theme, User, Toast, Household)
├── app.json                    # Expo project configuration, plugins, splash screen definitions
├── babel.config.js             # Babel compilation configuration supporting NativeWind CSS
├── index.js                    # Core entry point registering App component with Native Native engine
├── metro.config.js             # Metro bundler customization mapping Tailwind styles
├── tailwind.config.js          # Tailwind CSS style utilities, design system extension tokens
├── firestore.rules             # Database permissions restricting data access to members of the same household
├── src/
│   ├── firebaseConfig.ts       # Firebase SDK initialization (Auth, DB, Storage, Functions)
│   ├── types.ts                # App-wide shared TypeScript types and schemas
│   ├── components/             # Reusable UI components
│   │   ├── Avatar.tsx          # Dynamic colored letter initials representing members
│   │   ├── BottomTabBar.tsx    # Styled animated navigation bar with tab transition presets
│   │   ├── Card.tsx            # Styled glassmorphic container layout cards
│   │   ├── ScreenHeader.tsx    # Universal top app bar featuring household switchers and notifications shortcut
│   │   ├── SwipeableRow.tsx    # Gestures wrapper allowing quick swipe actions on lists
│   │   ├── dashboard/          # Home screen sub-widgets (HeroGreeting, InfoCardsDeck, QuickActions)
│   │   └── modals/             # Modal overlay forms (QuickChore, QuickExpense, QuickBuy, TravelWrapModal)
│   ├── context/                # React State Contexts (ThemeContext, UserContext, HouseholdContext, ToastContext)
│   ├── hooks/                  # Custom react hook business-logic abstraction layers
│   │   └── useDashboardData.ts # Performs real-time db listeners, debt divisions, and trash schedules
│   ├── screens/                # Core screen pages (Login, Dashboard, Expense, Grocery, Chores, Chat, Profile)
│   └── utils/                  # Helper utilities (activity logs, notifications timers, relative time math)
```

---

## 🚀 Getting Started

Follow these steps to run the application locally on your computer or test device.

### 📋 Prerequisites

Make sure you have the following installed:
* [Node.js](https://nodejs.org/) (v18+ recommended)
* [npm](https://www.npmjs.com/) (Node package manager)
* [Expo Go](https://expo.dev/client) app installed on your physical mobile device, OR an Android/iOS emulator configured.

### 🔌 Setup Steps

1. **Clone the Repository & Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root directory. Add your Firebase web configuration details:
   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY="your-firebase-api-key"
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN="your-firebase-auth-domain.firebaseapp.com"
   EXPO_PUBLIC_FIREBASE_PROJECT_ID="your-firebase-project-id"
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET="your-firebase-storage-bucket.firebasestorage.app"
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-messaging-sender-id"
   EXPO_PUBLIC_FIREBASE_APP_ID="your-firebase-app-id"
   ```

3. **Install Firebase Tools (Optional for CLI deployment)**:
   If you need to deploy security rules or cloud functions:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add
   ```

4. **Deploy Firestore Rules**:
   Enforce the application security boundaries by deploying [firestore.rules](file:///home/jeevan/Desktop/my%20projects/shared%20living/firestore.rules):
   ```bash
   firebase deploy --only firestore:rules
   ```

---

## 📱 Running the Application

Start the Metro Dev Server to launch the app:
```bash
npm run start
```

This will launch the Expo CLI in your terminal. 
* Press **`a`** to open in an Android Emulator/Device.
* Press **`i`** to open in an iOS Simulator.
* Scan the displayed **QR Code** using your phone's camera (iOS) or the **Expo Go** app (Android) to test on a physical device connected to the same local network.

---

## 🔒 Security & Firestore Rules

To protect member details, the database enforces rules matching user authentication states:
* **User Authentication**: Only logged-in users can write or query profiles.
* **Household Segregation**: A user can only read/edit collections (groceries, messages, chores, activities, expenses) belonging to the specific `householdId` assigned in their user profile document.
* **Invite Codes**: Code matching queries can scan across the collection to locate valid household IDs, but cannot list entire households.

---

## 🚀 Build for Production

This project is configured with Expo Application Services (EAS). To create signed, release-ready app builds:

1. **Configure EAS CLI**:
   ```bash
   npm install -g eas-cli
   eas login
   eas project:init
   ```

2. **Run iOS / Android Build Profile**:
   Builds are run on Expo's remote servers using configurations in `eas.json`:
   ```bash
   # Build for Android
   eas build --platform android --profile production

   # Build for iOS
   eas build --platform ios --profile production
   ```
