
# Wingman Finance

**Precision-engineered budgeting for the modern user.**

Wingman is a privacy-focused, offline-capable Progressive Web App (PWA) designed to replace complex spreadsheets with a clean, tactical interface. Manage pay, track allowances, and execute your financial flight plan with AI-driven tactical insights.

![Wingman App Icon](https://cdn-icons-png.flaticon.com/512/781/781760.png)

## 🚀 Features

*   **Tactical Dashboard:** High-level overview of net worth, income vs. expenses, and debt reduction.
*   **AI Wingman:** Built-in AI Advisor (powered by Google Gemini) analyzes your spending to provide actionable financial tips and budget alerts.
*   **Privacy First:** All data is stored locally on your device (`localStorage`). No external servers see your financial records.
*   **Offline Capable:** Install as a PWA on iOS and Android for a native app-like experience without internet access.
*   **Profile Management:** Support for multiple distinct profiles on a single device.
*   **Data Portability:** Easy CSV import and export.

## 🛠️ Tech Stack

*   React 19
*   TypeScript
*   Vite
*   Tailwind CSS
*   Google Gemini API (for AI insights)

## 💻 Getting Started

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/wingman-finance.git
    cd wingman-finance
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Set up Environment Variables**
    Create a `.env` file in the root directory:
    ```env
    API_KEY=your_gemini_api_key_here
    ```

4.  **Run the development server**
    ```bash
    npm run dev
    ```

## 📱 Installing on Mobile

1.  Deploy the app (e.g., to Vercel).
2.  Open the website in Safari (iOS) or Chrome (Android).
3.  Tap **Share** -> **Add to Home Screen**.
4.  Wingman will install as a standalone app.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
