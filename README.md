# 🥗 Meal-AI: Smart Meal Planner & Price Optimizer

Meal-AI is a next-generation meal planning application that leverages cutting-edge AI models (Llama 3.3, DeepSeek R1) to generate personalized meal plans and optimize your grocery shopping through automated price comparison and cart management.

![Project Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Node%20%7C%20MySQL-blue)
![AI Models](https://img.shields.io/badge/AI-Groq%20%7C%20OpenAI%20%7C%20HuggingFace-orange)

## 🚀 Features

-   **🧠 AI-Powered Meal Generation:** Personalized weekly meal plans based on diet type (Veg, Non-Veg, Vegan, Eggetarian), budget, cooking time, and dietary restrictions.
-   **💰 Dynamic Price Comparison:** Automated web scraping of grocery platforms to find the best prices for your meal plan ingredients.
-   **🛒 Smart Shopping Cart:** Integrated cart system that translates meal plans into actionable shopping lists.
-   **🤖 Multi-Model Intelligence:** 
    -   **Llama 3.3 70B:** Primary engine for complex recipe reasoning.
    -   **DeepSeek R1:** Used for high-level logic and constraint solving.
    -   **Llama 3.1 8B:** Optimized for fast price matching and data processing.
-   **👤 Household Profiles:** Manage dietary preferences, allergies, likes, and dislikes for the entire household.
-   **🔒 Secure Auth:** JWT-based authentication for user data protection.

## 🛠️ Tech Stack

### Frontend
-   **Framework:** React 18 (Vite)
-   **Styling:** Tailwind CSS
-   **Routing:** React Router DOM
-   **State Management:** Context API
-   **HTTP Client:** Axios

### Backend
-   **Runtime:** Node.js (ES Modules)
-   **Framework:** Express.js
-   **Database:** MySQL
-   **Automation:** Puppeteer / Playwright (for price scraping)
-   **AI SDKs:** Groq Cloud, OpenAI, Hugging Face Inference

## 📋 Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or higher)
-   [MySQL](https://www.mysql.com/) (Local or Cloud instance)
-   API Keys for:
    -   [Groq Cloud](https://console.groq.com/) (Required for primary AI features)
    -   [OpenAI](https://platform.openai.com/) (Optional)
    -   [Hugging Face](https://huggingface.co/) (Optional)

## ⚙️ Installation & Setup

### 1. Clone the repository
```bash
git clone https://github.com/[your-username]/Meal-AI.git
cd Meal-AI
```

### 2. Backend Setup
```bash
cd backend
npm install
```
Create a `.env` file in the `backend` directory (refer to `.env.example`):
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=meal_planner_db
JWT_SECRET=your_jwt_secret
GROQ_API_KEY=your_groq_key
# Optional
OPENAI_API_KEY=your_openai_key
HUGGINGFACE_API_KEY=your_hf_key
```

### 3. Database Initialization
```bash
npm run setup-db
```

### 4. Frontend Setup
```bash
cd ../frontend
npm install
```
Create a `.env` file in the `frontend` directory:
```env
VITE_API_URL=http://localhost:5000/api
```

## 🏃 Running the Application

### Start Backend
```bash
cd backend
npm run dev
```

### Start Frontend
```bash
cd frontend
npm run dev
```

The application will be available at `http://localhost:5173` and the API at `http://localhost:5000`.

## 📂 Project Structure

```text
Meal-AI/
├── backend/            # Express API & AI Services
│   ├── src/
│   │   ├── config/     # DB & Schema settings
│   │   ├── controllers/# Route logic
│   │   ├── routes/     # API Endpoints
│   │   └── services/   # AI & Scraping logic
├── frontend/           # React Application
│   ├── src/
│   │   ├── components/ # Reusable UI
│   │   ├── context/    # Global state
│   │   ├── pages/      # View components
│   │   └── services/   # API integration
└── ...
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

