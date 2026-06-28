# Shared Living Codebase Documentation

Welcome to the comprehensive developer documentation for the **Shared Living** application. This document details every single file in the repository, explaining its purpose, why it is present, its exact usage, its contents, and the key API/syntax keywords used.

---

## 📂 Directory Map
* [⚙️ Configuration & Project Metadata](#️-configuration--project-metadata) (Root config files)
* [🔥 Firebase & Types](#-firebase--types) (`src/firebaseConfig.ts` & `src/types.ts`)
* [🧠 React Context Providers](#-react-context-providers-state-management) (State management)
* [⚡ Custom Hooks](#-custom-hooks) (Business logic layers)
* [🛠️ Utilities & Helpers](#️-utilities--helpers) (`src/utils/*`)
* [📱 Screens](#-screens) (`src/screens/*`)
* [🧩 Shared Components](#-shared-components) (`src/components/*`)
* [🏠 Dashboard Widgets](#-dashboard-widgets) (`src/components/dashboard/*`)
* [💬 Popups & Modal Windows](#-popups--modal-windows) (`src/components/modals/*`)

---

## ⚙️ Configuration & Project Metadata

These files form the root setup of the project, defining dependencies, bundler pipelines, styling presets, build behaviors, and database rules.

### 1. [package.json](file:///home/jeevan/Desktop/my%20projects/shared%20living/package.json)
* **Description**: The manifest file for the Node.js project. It lists metadata, scripts, dependencies, development tools, and package manager overrides.
* **Why it is present**: To track required packages, lock dependency overrides to ensure compatibility with Expo SDK 54, and expose scripts for starting, running, and linting the application.
* **Use**: Read by `npm`/`npx` to install node modules and execute scripts (e.g. `npm run start`).
* **Key Contents**:
  * Dependencies: `expo`, `react`, `react-native`, `nativewind`, `firebase`, `@sentry/react-native`, `react-native-reanimated`.
  * Overrides block: Locks `react-native` and `@react-native/virtualized-lists` to version `0.81.5` to prevent dependency hoisting issues.
* **Keywords**: `dependencies`, `devDependencies`, `scripts`, `overrides`.

### 2. [app.json](file:///home/jeevan/Desktop/my%20projects/shared%20living/app.json)
* **Description**: The configuration file for Expo SDK.
* **Why it is present**: To define native configuration properties for iOS, Android, and web platforms when building or exporting with Expo.
* **Use**: Consumed by `expo-cli` and EAS Build/Export systems to generate native application binaries and bundle outputs.
* **Key Contents**:
  * Application name, slug, version, orientation, splash screen paths, icon paths, and bundle identifiers (`com.jeevan0714.sharedliving`).
  * Plugin definitions for Sentry, local notifications, and asset autolinking.
* **Keywords**: `expo`, `name`, `slug`, `scheme`, `ios`, `android`, `plugins`, `updates`, `runtimeVersion`.

### 3. [App.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/App.tsx)
* **Description**: The root React component and entryway of the application.
* **Why it is present**: To serve as the master parent wrapper that sets up global context providers (User, Theme, Toast, Household) and initializes the app navigation flow.
* **Use**: Rendered initially by the React Native entry point to construct the react node tree.
* **Key Contents**:
  * Context wrapping: `<ThemeProvider>`, `<ToastProvider>`, `<UserProvider>`, `<HouseholdProvider>`.
  * Root navigation logic: Swapping between `AuthStack` (LoginScreen) and `AppStack` (Main screens) based on the user's login state.
* **Keywords**: `NavigationContainer`, `createNativeStackNavigator`, `StatusBar`, `useContext`, `UserContext`.

### 4. [babel.config.js](file:///home/jeevan/Desktop/my%20projects/shared%20living/babel.config.js)
* **Description**: Babel JavaScript compiler configuration.
* **Why it is present**: To direct the compiler to transform modern ES6+ JS/TS and React Native TSX markup into compatible runtime JavaScript.
* **Use**: Consumed by Metro Bundler during development, bundling, and build steps.
* **Key Contents**:
  * Configures `babel-preset-expo`.
  * Configures the `nativewind/babel` plugin to support Tailwind style compilation in React Native.
* **Keywords**: `presets`, `plugins`, `nativewind/babel`.

### 5. [metro.config.js](file:///home/jeevan/Desktop/my%20projects/shared%20living/metro.config.js)
* **Description**: Metro bundler configuration file.
* **Why it is present**: Configures how React Native files, assets, and imports are resolved and compiled.
* **Use**: Used by Metro (the developer server) when bundling the app code for simulator or production deployments.
* **Key Contents**:
  * Enhances Metro configuration with NativeWind CSS integration (`withNativeWind`).
* **Keywords**: `getDefaultConfig`, `withNativeWind`, `module.exports`.

### 6. [tsconfig.json](file:///home/jeevan/Desktop/my%20projects/shared%20living/tsconfig.json)
* **Description**: The TypeScript compiler configuration.
* **Why it is present**: Instructs the IDE and build tools on how to compile and type-check the codebase.
* **Use**: Consumed by TypeScript linter/compiler (`tsc`).
* **Key Contents**:
  * Inherits rules from `expo/tsconfig.base`.
* **Keywords**: `compilerOptions`, `extends`, `strict`.

### 7. [tailwind.config.js](file:///home/jeevan/Desktop/my%20projects/shared%20living/tailwind.config.js)
* **Description**: Tailwind CSS utility setup.
* **Why it is present**: To customize the Tailwind styling framework classes, extend the color theme, and define which folders should be scanned for class names.
* **Use**: Loaded by NativeWind to compile styles for custom UI elements.
* **Key Contents**:
  * `content` array scanning paths (`./App.tsx`, `./src/**/*.{js,jsx,ts,tsx}`).
  * NativeWind preset configurations (`nativewind/preset`).
  * Theme configurations (e.g. extending colors, shadows, borders).
* **Keywords**: `module.exports`, `content`, `presets`, `theme`, `extend`.

### 8. [global.css](file:///home/jeevan/Desktop/my%20projects/shared%20living/global.css)
* **Description**: Global stylesheet.
* **Why it is present**: To load Tailwind directive layers and import any base or global styles.
* **Use**: Imported in `index.js` or `App.tsx` to apply utility styles system-wide.
* **Key Contents**:
  * `@tailwind base;`, `@tailwind components;`, `@tailwind utilities;` directives.
* **Keywords**: `@tailwind`, `@layer`.

### 9. [eas.json](file:///home/jeevan/Desktop/my%20projects/shared%20living/eas.json)
* **Description**: Configures Expo Application Services (EAS) profiles for updates and cloud builds.
* **Why it is present**: To specify configurations for different channels and build environments (like development, preview, and production).
* **Use**: Consumed by the `eas-cli` command-line tool.
* **Key Contents**:
  * Profile blocks (`development`, `preview`, `production`).
  * CLI configuration details (`channel`, `distribution`, `developmentClient`).
* **Keywords**: `cli`, `build`, `profiles`, `update`.

### 10. [eslint.config.js](file:///home/jeevan/Desktop/my%20projects/shared%20living/eslint.config.js)
* **Description**: Configuration for the ESLint code linter.
* **Why it is present**: To establish code formatting and syntax standards to prevent bugs.
* **Use**: Run by the IDE or manually in terminal during CI lint checks.
* **Key Contents**:
  * Inherits rule sets from `eslint-config-expo`.
* **Keywords**: `module.exports`, `eslint-config-expo`.

### 11. [firebase.json](file:///home/jeevan/Desktop/my%20projects/shared%20living/firebase.json)
* **Description**: The configuration manifest for the Firebase CLI tools.
* **Why it is present**: To configure Firebase functions, hosting properties, and security rule directories.
* **Use**: Used by the Firebase CLI when running local emulators or executing deploys (`firebase deploy`).
* **Key Contents**:
  * Firestore configuration referencing `firestore.rules`.
  * Cloud Functions paths and build instructions.
* **Keywords**: `firestore`, `rules`, `functions`, `predeploy`.

### 12. [firestore.rules](file:///home/jeevan/Desktop/my%20projects/shared%20living/firestore.rules)
* **Description**: The database security rules defining security parameters for Cloud Firestore.
* **Why it is present**: To secure database write/read operations directly on the database level, preventing unauthorized access.
* **Use**: Uploaded to Firebase to evaluate queries.
* **Key Contents**:
  * Evaluates permissions on collection paths (like `/households`, `/users`).
  * Ensures users can only write or read documents belonging to their assigned household (`request.auth.uid != null`).
* **Keywords**: `rules_version`, `service cloud.firestore`, `match`, `allow read, write`, `request.auth`.

### 13. [google-services.json](file:///home/jeevan/Desktop/my%20projects/shared%20living/google-services.json)
* **Description**: Firebase configuration package descriptor for Android apps.
* **Why it is present**: Necessary for connecting the Android native build to your specific Firebase services (like Auth, Firestore, and Push Notifications).
* **Use**: Loaded by Gradle during native compilations.
* **Key Contents**:
  * Android package names, client IDs, and Firebase project configuration keys.

### 14. [index.js](file:///home/jeevan/Desktop/my%20projects/shared%20living/index.js)
* **Description**: The low-level entry file of the React Native app.
* **Why it is present**: To register the root App component with the native engine and import global assets.
* **Use**: Standard file loaded by the Expo runtime loader.
* **Key Contents**:
  * Imports CSS styles (`./global.css`).
  * Registers App (`registerRootComponent(App)`).
* **Keywords**: `registerRootComponent`, `App`.

### 15. [nativewind-env.d.ts](file:///home/jeevan/Desktop/my%20projects/shared%20living/nativewind-env.d.ts)
* **Description**: TypeScript declarations for NativeWind.
* **Why it is present**: Declares types for NativeWind directives so that JSX styles do not show TypeScript compilation errors.
* **Use**: Used by the TypeScript linter.
* **Key Contents**:
  * `/// <reference types="nativewind/types" />`.

### 16. [check.js](file:///home/jeevan/Desktop/my%20projects/shared%20living/check.js) / [check_stack.js](file:///home/jeevan/Desktop/my%20projects/shared%20living/check_stack.js)
* **Description**: Temporary developer diagnostic scripts.
* **Why it is present**: Used in local terminals to print environment info or test script layers without launching full simulators.

### 17. [privacy-policy.html](file:///home/jeevan/Desktop/my%20projects/shared%20living/privacy-policy.html)
* **Description**: Privacy Policy template.
* **Why it is present**: Legally required to upload or display a privacy policy web link when publishing mobile apps to Apple App Store or Google Play Store.

---

## 🔥 Firebase & Types

These files define the interfaces, data shapes, and connections to remote backend services.

### 1. [src/firebaseConfig.ts](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/firebaseConfig.ts)
* **Description**: Initializes Firebase apps, services, and client SDKs.
* **Why it is present**: Connects the front-end React Native shell to your specific Firebase instance.
* **Use**: Imported globally to run db operations, upload images, manage sign-ins, and call functions.
* **Key Contents**:
  * `initializeApp(firebaseConfig)` setup.
  * Exports `auth` (Firebase Authentication).
  * Exports `db` (Firestore Database).
  * Exports `storage` (Firebase Cloud Storage).
  * Exports `functions` (Firebase Callable Functions).
* **Keywords**: `initializeAuth`, `getReactNativePersistence`, `AsyncStorage`, `getFirestore`, `getStorage`, `getFunctions`.

### 2. [src/types.ts](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/types.ts)
* **Description**: Declares all key interfaces and types for TypeScript type-safety.
* **Why it is present**: Ensures consistent objects (e.g. chores, expenses) throughout the codebase, resolving autocomplete and preventing typing typos.
* **Use**: Consumed by almost every screen and component.
* **Key Contents**:
  * Nav types (`RootStackParamList`).
  * Models: `UserProfile`, `Household`, `Chore`, `GroceryItem`, `Expense`, `ChatMessage`, `ActivityLog`.
* **Keywords**: `export interface`, `export type`, `Timestamp`.

---

## 🧠 React Context Providers (State Management)

Context providers act as global "radio towers" that hold and broadcast state (like dark/light theme, current user, toast notifications) across the entire component tree.

### 1. [src/context/UserContext.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/context/UserContext.tsx)
* **Description**: Manages user authentication state.
* **Why it is present**: Tracks whether a user is logged in, their profile data, and coordinates login redirect switches.
* **Use**: Broadcasts `user` profile data and exposes sign-out utilities.
* **Key Contents**:
  * `onAuthStateChanged` hook listener that fetches profile documents from `/users/{uid}` in Firestore when they log in.
  * Exposes `user`, `loading`, `setUser`, and `refreshProfile`.
* **Keywords**: `createContext`, `useContext`, `onAuthStateChanged`, `doc`, `getDoc`, `db`.

### 2. [src/context/HouseholdContext.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/context/HouseholdContext.tsx)
* **Description**: Manages details of the current household.
* **Why it is present**: Fetches dynamic household metadata (wifi, invite codes, members) and handles switching between different houses.
* **Use**: Feeds screens with current room metadata and roomie lists.
* **Key Contents**:
  * Real-time listeners (`onSnapshot`) on the `/households/{householdId}` collection.
  * Exposes `household`, `members` profiles array, `setHouseholdId`, `loading`.
* **Keywords**: `onSnapshot`, `query`, `where`, `collection`, `getDocs`, `householdId`.

### 3. [src/context/ThemeContext.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/context/ThemeContext.tsx)
* **Description**: Manages light/dark styling state.
* **Why it is present**: Gives the user a visual toggle switch for interface appearance preferences.
* **Use**: Feeds root elements to switch Tailwind configuration modes.
* **Key Contents**:
  * State tracking (`theme` set to `'light'` or `'dark'`).
  * Exposes `theme`, `isDark`, `toggleTheme`.
* **Keywords**: `theme === 'dark'`, `setTheme`.

### 4. [src/context/ToastContext.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/context/ToastContext.tsx)
* **Description**: Coordinates floating system notification popups.
* **Why it is present**: Allows any component to instantly summon customized success or warning messages (toast bubbles).
* **Use**: Call `showToast("Action saved!", "success")` from any visual screen.
* **Key Contents**:
  * Exposes `showToast(msg, type)`.
  * Integrates the visual `<Toast>` rendering component.
* **Keywords**: `useCallback`, `ToastType`, `setTimeout`.

---

## ⚡ Custom Hooks

Hooks separate complex backend logic, subscriptions, and database data processing from the visual components.

### 1. [src/hooks/useDashboardData.ts](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/hooks/useDashboardData.ts)
* **Description**: The master database synchronizer and data processor hook.
* **Why it is present**: Connects the main screen feeds to Firestore collections in real-time, executing background listeners and mathematical debt calculations.
* **Use**: Called on the Home Dashboard and various tab panels to render state cleanly.
* **Key Contents**:
  * Subscribes via `onSnapshot` to groceries, chores, recent activity events, expenses, and chats inside the active household.
  * Performs the algorithmic debt calculations (`useMemo`) to split bills, subtract settlements, and format balances.
  * Runs a `setInterval` timer (cleanup on component unmount) to calculate real-time countdown alerts for trash schedules.
* **Keywords**: `onSnapshot`, `useMemo`, `useEffect`, `peerBalances`, `debt`, `trashArrivalTime`.

---

## 🛠️ Utilities & Helpers

Utility files contain pure JavaScript helper functions for formatting dates, calculating expenses, storing log statements, and trigger local notification alerts.

### 1. [src/utils/activityUtils.ts](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/utils/activityUtils.ts)
* **Description**: Handles logger entries for household actions.
* **Why it is present**: Logs history records whenever user actions take place (e.g. *"Jeevan added a grocery item: Apples"*).
* **Use**: Imported inside screens to add entries to `/households/{id}/activities` collection.
* **Key Contents**:
  * `logActivity(db, householdId, type, title, amount, user)` helper.
* **Keywords**: `addDoc`, `collection`, `serverTimestamp`.

### 2. [src/utils/errorLogger.ts](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/utils/errorLogger.ts)
* **Description**: Diagnostic error interception and logger wrapper.
* **Why it is present**: Intercepts app runtime failures and logs them to console/Sentry services.
* **Use**: Imported globally to wrap try-catch blocks and report diagnostics.
* **Key Contents**:
  * `logError(error, context)` helper that logs details and passes parameters directly to Sentry SDK.
* **Keywords**: `Sentry.captureException`, `console.error`.

### 3. [src/utils/expenseUtils.ts](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/utils/expenseUtils.ts)
* **Description**: Calculation helpers for billing calculations.
* **Why it is present**: Provides functions to format values, determine division values, and map labels.
* **Use**: Imported inside `ExpenseScreen` and `QuickExpenseModal`.
* **Key Contents**:
  * `formatCurrency`, `calculateSplitShare` calculators.
* **Keywords**: `Math.ceil`, `currencyFormat`.

### 4. [src/utils/notificationUtils.ts](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/utils/notificationUtils.ts)
* **Description**: Controls local system reminders and alerts.
* **Why it is present**: Schedules alarms on device screens for chores schedules.
* **Use**: Triggers phone status indicators when chores deadlines are near.
* **Key Contents**:
  * `scheduleChoreReminder`, `cancelNotification` triggers utilizing `expo-notifications`.
* **Keywords**: `Notifications.scheduleNotificationAsync`, `trigger`, `seconds`.

### 5. [src/utils/retentionUtils.ts](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/utils/retentionUtils.ts)
* **Description**: Performance audit utility.
* **Why it is present**: Logs user session counts, activity metrics, and retention duration flags.
* **Use**: Tracks user return frequency and application load timings.

### 6. [src/utils/timeUtils.ts](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/utils/timeUtils.ts)
* **Description**: Formatting tools for timestamps and dates.
* **Why it is present**: Converts database Unix or Firestore Timestamps into human-readable strings (e.g. *"2 minutes ago"*).
* **Use**: Populates feed timestamps across panels.
* **Key Contents**:
  * `formatRelativeTime(timestamp)`, `getDaysOfWeek` arrays.
* **Keywords**: `Timestamp.toDate()`, `Math.floor`.

---

## 📱 Screens

Screens represent the master panels rendered inside standard application layouts, responding to navigation actions and feeding user inputs into states.

### 1. [src/screens/LoginScreen.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/screens/LoginScreen.tsx)
* **Description**: Email and Password authentication screen.
* **Why it is present**: Allows users to log into their accounts or register new ones.
* **Use**: Rendered initially if authentication checks return null.
* **Key Contents**:
  * Sign-in/Sign-up UI toggle.
  * Authenticates using `signInWithEmailAndPassword` or `createUserWithEmailAndPassword`.
* **Keywords**: `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `auth`, `AsyncStorage`.

### 2. [src/screens/HouseholdSelectionScreen.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/screens/HouseholdSelectionScreen.tsx)
* **Description**: Selection screen for joining or creating a room.
* **Why it is present**: Prompts authenticated users who are not yet in a household to join an existing one with an invite code or create a new household.
* **Use**: Displayed right after login if `user.householdId` is blank.
* **Key Contents**:
  * UI buttons linking to creation flow or inputting an invite code.
* **Keywords**: `HouseholdSetup`, `navigation.navigate`.

### 3. [src/screens/HouseholdSetupScreen.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/screens/HouseholdSetupScreen.tsx)
* **Description**: Detail page for setting up a household.
* **Why it is present**: Handles the database operations for creating a new household, setting its name, generating an invite code, or validating an entered code.
* **Use**: Submits forms to Firebase to link user accounts to a household collection.
* **Key Contents**:
  * Invocation of `addDoc` to generate `/households` documents.
  * Validation checks to find households by `inviteCode` and append users to the `members` array.
* **Keywords**: `collection`, `query`, `where`, `getDocs`, `updateDoc`, `arrayUnion`.

### 4. [src/screens/DashboardScreen.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/screens/DashboardScreen.tsx)
* **Description**: Main Home landing screen.
* **Why it is present**: Aggregates vital household info: greetings, trash collection timers, recent chats, pending chores, and financial debt warnings in one feed.
* **Use**: The initial tab presented when the user opens the application.
* **Key Contents**:
  * Fetches state from `useDashboardData` and displays quick-access dashboard widgets.
* **Keywords**: `HeroGreeting`, `InfoCardsDeck`, `QuickActions`, `ScrollView`, `RefreshControl`.

### 5. [src/screens/GroceryScreen.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/screens/GroceryScreen.tsx)
* **Description**: Grocery list manager screen.
* **Why it is present**: Tracks shopping lists, prices, and splits grocery expenses.
* **Use**: Accessible from the Grocery Tab to check off items, clear lists, or buy items.
* **Key Contents**:
  * Displays groceries subcollection.
  * Includes checking off bought items, triggering logging logic for new expenses when checking items, and categorizing groceries.
* **Keywords**: `addDoc`, `updateDoc`, `deleteDoc`, `SwipeableRow`, `QuickBuyModal`.

### 6. [src/screens/ExpenseScreen.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/screens/ExpenseScreen.tsx)
* **Description**: Expense Splitting and Settlement screen.
* **Why it is present**: Tracks bills, splits totals among selected members, monitors debts, and records peer-to-peer repayments.
* **Use**: Accessed via the Expenses tab to settle debts or add expenses.
* **Key Contents**:
  * Renders list of settlements and payments.
  * Contains tabs for "Overview", "Balance Details", and "History Log".
* **Keywords**: `QuickExpenseModal`, `QuickSettleModal`, `peerBalances`, `flatBalances`.

### 7. [src/screens/ChoresScreen.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/screens/ChoresScreen.tsx)
* **Description**: Task and Chore management screen.
* **Why it is present**: Schedules recurrent chores, lists assignees, manages rotations, and updates progress indicators.
* **Use**: Located in the Chores Tab to assign tasks, check off completed chores, or update rotations.
* **Key Contents**:
  * Triggers notifications scheduling when chores are updated.
  * Streak increment rules, frequency filters (daily/weekly/monthly).
* **Keywords**: `rotationEnabled`, `rotationOrder`, `scheduleChoreReminder`, `completedBy`.

### 8. [src/screens/ChatScreen.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/screens/ChatScreen.tsx)
* **Description**: Household group chat screen.
* **Why it is present**: Allows household members to chat in real-time.
* **Use**: Accessible via the Chat tab for internal communication.
* **Key Contents**:
  * Interactive messaging display utilizing standard input keys.
  * Real-time listeners scanning the `/messages` collection.
* **Keywords**: `FlatList`, `TextInput`, `KeyboardAvoidingView`, `onSnapshot`.

### 9. [src/screens/ProfileScreen.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/screens/ProfileScreen.tsx)
* **Description**: User profile, settings, and household administration panel.
* **Why it is present**: Lets users edit their username, toggle dark mode, view household invite details, or log out of the application.
* **Use**: Accessible via the profile icon on the top screen header.
* **Key Contents**:
  * Integrates `ThemeContext` toggles.
  * Exposes modal trigger buttons to edit user credentials or view/edit household information.
* **Keywords**: `signOut`, `updateDoc`, `HouseholdSwitcherModal`, `InfoEditModal`.

---

## 🧩 Shared Components

Reusable interface blocks that maintain visual consistency and UI clean-up.

### 1. [src/components/Avatar.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/Avatar.tsx)
* **Description**: Renders circular user initials.
* **Why it is present**: Displays consistent profile indicators next to messages, chore assignments, or paid expenses.
* **Use**: Rendered throughout the screens showing a circle with the user's name initial.
* **Key Contents**:
  * Generates background color dynamically depending on the user's name letters.
* **Keywords**: `charCodeAt`, `toUpperCase`, `View`, `Text`.

### 2. [src/components/BottomTabBar.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/BottomTabBar.tsx)
* **Description**: Custom bottom tab navigator template.
* **Why it is present**: Replaces standard grey bottom tabs with a stylish, modern bar featuring custom active markers and bubble selectors.
* **Use**: Rendered at the bottom of the main screens via `@react-navigation/bottom-tabs`.
* **Key Contents**:
  * Animated bar, map configurations mapping screens to vector icons.
* **Keywords**: `TouchableOpacity`, `Ionicons`, `LayoutAnimation`.

### 3. [src/components/Card.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/Card.tsx)
* **Description**: Styled layout container card.
* **Why it is present**: Establishes unified boundaries, padding, and corner rounding for widgets.
* **Use**: Wraps lists, charts, and texts on the Dashboard.

### 4. [src/components/EmptyState.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/EmptyState.tsx)
* **Description**: UI placeholder screen.
* **Why it is present**: Displays a clean, illustrated container if list items (like groceries or chores) are empty.
* **Use**: Displayed dynamically when `list.length === 0`.

### 5. [src/components/ScreenHeader.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/ScreenHeader.tsx)
* **Description**: App-wide header controller.
* **Why it is present**: Standardizes the top title region of screens, displaying the house switcher, logo, members indicators, and profile shortcut.
* **Use**: Configured at the top of main navigation panels.
* **Key Contents**:
  * Renders household switcher dropdowns and notifications icons.
* **Keywords**: `HouseholdSwitcherModal`, `MembersModal`, `NotificationsModal`.

### 6. [src/components/Skeleton.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/Skeleton.tsx)
* **Description**: Visual placeholder loader.
* **Why it is present**: Mimics the layout using animated gradients during initial Firebase fetches, creating a smooth loading experience.
* **Use**: Loaded on initial setup screens before data finishes downloading.
* **Keywords**: `Animated.loop`, `interpolate`, `Animated.Value`.

### 7. [src/components/SlideModal.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/SlideModal.tsx)
* **Description**: Interactive modal overlay container.
* **Why it is present**: Provides standard sliding transition sheets (modals) for adding items.
* **Use**: Wraps other custom popup modules.
* **Keywords**: `Modal`, `PanResponder`, `Animated.spring`.

### 8. [src/components/SwipeableRow.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/SwipeableRow.tsx)
* **Description**: Swipe-to-delete row container.
* **Why it is present**: Adds native list interactions (like swiping left/right to delete items).
* **Use**: Wraps individual grocery, expense, or chore rows.
* **Keywords**: `GestureHandler`, `Reanimated`, `Swipeable`.

### 9. [src/components/TimeWheelPicker.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/TimeWheelPicker.tsx)
* **Description**: Customized scroll wheel time selection.
* **Why it is present**: Bypasses ugly system datepicker overlays with custom wheel sliders.
* **Use**: Placed inside chore scheduler screens to choose alert times.
* **Keywords**: `ScrollView`, `onMomentumScrollEnd`, `getItemLayout`.

### 10. [src/components/Toast.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/Toast.tsx)
* **Description**: Dynamic float alert indicator.
* **Why it is present**: Shows a popup alert at the top of screens when actions occur.
* **Use**: Triggered by the `ToastContext` Provider.

---

## 🏠 Dashboard Widgets

Widgets designed to summarize data on the Home Screen.

### 1. [src/components/dashboard/HeroGreeting.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/dashboard/HeroGreeting.tsx)
* **Description**: Welcoming greeting card.
* **Why it is present**: Displays active room welcome statements, trash schedules, and dynamic messages.
* **Use**: Placed at the top of the Home Dashboard.
* **Key Contents**:
  * Trash truck arrival countdown display and alert calculations.

### 2. [src/components/dashboard/InfoCardsDeck.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/dashboard/InfoCardsDeck.tsx)
* **Description**: Carousel metric summarizer.
* **Why it is present**: Feeds swipeable summary cards for chores pending, groceries to buy, and debts.
* **Use**: Middle section of Dashboard Screen.

### 3. [src/components/dashboard/QuickActions.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/dashboard/QuickActions.tsx)
* **Description**: Interactive shortcuts panel.
* **Why it is present**: Lets users quickly invoke modals to create common entries without visiting individual tabs.
* **Use**: Renders round action triggers at the bottom of the dashboard.
* **Keywords**: `QuickChoreModal`, `QuickExpenseModal`, `QuickBuyModal`.

---

## 💬 Popups & Modal Windows

Popup panels launched to complete form updates.

### 1. [src/components/modals/HouseholdSwitcherModal.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/modals/HouseholdSwitcherModal.tsx)
* **Description**: Household list switcher panel.
* **Why it is present**: Lets users with multiple households quickly swap their active space context.
* **Use**: Summoned from the Screen Header.

### 2. [src/components/modals/InfoEditModal.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/modals/InfoEditModal.tsx)
* **Description**: Form editor for Household details.
* **Why it is present**: Lets room administrators modify wifi credentials, trash routines, landlord contact cards, and dynamic household detail fields.
* **Use**: Summoned from the Profile Screen admin section.

### 3. [src/components/modals/MembersModal.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/modals/MembersModal.tsx)
* **Description**: Roomie member index list.
* **Why it is present**: Displays profiles, phones, and email details of all active room members.
* **Use**: Summoned by hitting the avatars group in the Header.

### 4. [src/components/modals/NotificationsModal.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/modals/NotificationsModal.tsx)
* **Description**: System logs list popup.
* **Why it is present**: Displays active room updates and logs.
* **Use**: Summoned via the bell icon in the header.

### 5. [src/components/modals/ProfileModal.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/modals/ProfileModal.tsx)
* **Description**: Quick profile preview.
* **Why it is present**: Displays another user's contact card when clicking their avatar.

### 6. [src/components/modals/QuickBuyModal.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/modals/QuickBuyModal.tsx)
* **Description**: Grocery check out popup.
* **Why it is present**: Prompts user for total item prices when checking out grocery items to calculate cost divisions.
* **Use**: Summoned from the Grocery Screen.

### 7. [src/components/modals/QuickChoreModal.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/modals/QuickChoreModal.tsx)
* **Description**: Chore creation popup sheet.
* **Why it is present**: Fast input panel for scheduling chores, pick assignees, set time wheels, and toggle rotation.
* **Use**: Loaded from QuickActions.

### 8. [src/components/modals/QuickExpenseModal.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/modals/QuickExpenseModal.tsx)
* **Description**: Quick expense input sheet.
* **Why it is present**: Input panel for bills, categories, payers, and member split checkboxes.
* **Use**: Loaded from QuickActions.

### 9. [src/components/modals/QuickSettleModal.tsx](file:///home/jeevan/Desktop/my%20projects/shared%20living/src/components/modals/QuickSettleModal.tsx)
* **Description**: Debt payment registry panel.
* **Why it is present**: Fast input form to log settling up (e.g. paying Roommate A back ₹500 via cash or app payment).
* **Use**: Triggered from Expenses screen.
