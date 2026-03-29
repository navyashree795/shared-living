/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  // If your main file is index.js instead of App.js, add "./index.{js,jsx,ts,tsx}" here too.
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: '#F9FAFB', // Light gray background
        card: '#FFFFFF',       // Clean white cards
        primary: '#4F46E5',    // Premium Indigo for primary actions
        secondary: '#E0E7FF',  // Light indigo for subtle elements
        textMain: '#111827',   // Near black for strong readability
        textMuted: '#6B7280',  // Slate gray for secondary text
        border: '#E5E7EB',     // Soft borders
        success: '#10B981',    // Emerald green
        danger: '#EF4444',     // Red error
        warning: '#F59E0B'     // Amber
      }
    },
  },
  plugins: [],
}