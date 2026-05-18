# House Sync: Shared Living App

## Architecture: Automated Receipt Workflow

The app uses a layered architecture to eliminate manual data entry when logging expenses.

| Layer | Technical Tool | Description / Value Proposition |
| :--- | :--- | :--- |
| **Image Handler** | `expo-image-picker` | Roommate grabs the receipt picture with zero form typing. |
| **Text Extractor** | Google Gemini AI (OCR) | Scans the receipt layout, pulls the total cost automatically. |
| **Calculation Engine** | Firebase Cloud Functions / Client | Divides the extracted total cost by current household members. |
| **Media Host** | Firebase Storage SDK | Generates the public document link shared with other profiles. |
| **Shared State** | Antigravity Engine (Client) | Instantly renders the clickable image preview on roommates' feeds. |
