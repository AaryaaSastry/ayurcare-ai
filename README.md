# AyurCare AI 🌿🤖

**AyurCare AI** is a state-of-the-art, hybrid platform that bridges ancient Ayurvedic wisdom with modern Artificial Intelligence. It provides a comprehensive ecosystem for patients seeking holistic health advice and for practitioners to manage clinical consultations through a premium, data-driven interface.

---

## 🚀 Vision
Our mission is to democratize access to personalized Ayurvedic healthcare by leveraging Large Language Models (LLMs), Vector Databases, and real-time communication protocols to create a seamless "bridge" between traditional healing and digital convenience.

---

## ✨ Key Features

### 1. 💬 DocConnect: Real-Time Messaging & Negotiation
*   **WhatsApp-Style Interface**: A clean, glassmorphic chat UI for fluid communication between doctors and patients.
*   **Negotiation Protocol**: Built-in system for discussing appointment slots and fees, complete with interactive "counter-offer" and "accept" workflows.
*   **Attachment Support**: Securely share medical reports and Ayurvedic prescriptions directly within the chat.

### 2. 🧠 AI Ayurvedic Companion (Bot-Brain)
*   **Gemini-Powered Intelligence**: Deep integration with Google Gemini for hyper-accurate, context-aware health advice.
*   **RAG (Retrieval-Augmented Generation)**: Uses a custom Vector Database builder to source information from authentic Ayurvedic texts and clinical data.
*   **NLP Engine**: Advanced natural language processing for sentiment analysis and health metric extraction.

### 3. 👨‍⚕️ Advanced Doctor Portal
*   **Clinical Dashboard**: A premium workstation for managing patient loads, pending negotiations, and upcoming sessions.
*   **Dynamic Scheduling**: Availability-aware calendar that allows doctors to toggle between "Active" and "On Leave" statuses.
*   **Patient Analytics**: Visual representation of patient progress using Chart.js.

### 4. 📊 Automated Health Reporting
*   **PDF Export**: Generate professional clinical summaries and prescriptions using `jspdf` and `html2canvas`.
*   **Sync Engine**: Automated synchronization of clinical reports across portals to ensure data integrity.

---

## 🛠️ Tech Stack

### Frontend (User Interfaces)
*   **Framework**: [React.js](https://reactjs.org/) + [Vite](https://vitejs.dev/)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/) (Custom UI components with Glassmorphism)
*   **Animations**: [Framer Motion](https://www.framer.com/motion/)
*   **Icons**: [Lucide React](https://lucide.dev/)

### Backend & AI Engine
*   **Logic**: [Node.js](https://nodejs.org/) & [Python](https://www.python.org/)
*   **AI Models**: [Google Gemini Pro](https://deepmind.google/technologies/gemini/)
*   **Database**: [MongoDB](https://www.mongodb.com/) (Atlas)
*   **Vector Search**: Custom Vector DB for Localized Knowledge Retrieval
*   **Real-time Communication**: [Socket.io](https://socket.io/)

---

## 📁 Project Structure

```bash
aivedabot/
├── ayurveda-app/
│   ├── bot-brain/          # Python-based AI & NLP engine (Gemini + Vector DB)
│   └── frontend_chat/      # Patient-facing React chat interface
├── doctor-portal/
│   ├── server/             # Node.js backend for doctor services
│   └── src/                # Doctor workstation React frontend
└── assets/                 # Brand assets and documentation
```

---

## ⚙️ Installation

### Prerequisites
*   Node.js (v18+)
*   Python (3.10+)
*   MongoDB Instance
*   Gemini API Key

### 1. AI Engine Setup
```bash
cd ayurveda-app/bot-brain
pip install -r requirements.txt
# Configure your .env file with GEMINI_API_KEY and MONGO_URI
python api_server.py
```

### 2. Doctor Portal Setup
```bash
cd doctor-portal
npm install
npm run dev
```

### 3. Patient Chat Interface
```bash
cd ayurveda-app/frontend_chat
npm install
npm run dev
```

---

## 🤝 Contributing
We welcome contributions to help improve the Ayurvedic knowledge base and AI accuracy. Please follow our code of conduct and submit PRs for any architectural improvements.

---

## 📜 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
*Created with ❤️ by the AyurCare AI Team*
