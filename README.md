# 🦷 DentalCloud

**A Professional Dental Practice Management System for streamlined patient care and clinical record-keeping.**

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen?style=for-the-badge&logo=netlify)](https://dentalcloudbythuta.netlify.app/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-181818?style=for-the-badge&logo=supabase&logoColor=3ECF8E)](https://supabase.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

---

## 📖 Project Overview
**DentalCloud** is a full-stack clinical management platform designed to digitize dental practice workflows. Built with a focus on high-density data storage and real-time synchronization, it allows practitioners to manage patient profiles, track complex dental procedures, and monitor billing through a clean, intuitive interface.

### 🔗 [Launch Live Application](https://dentalcloudbythuta.netlify.app/)

---

## 🛠 Tech Stack

* **Frontend:** React 19 + TypeScript 5.8 + Vite 6 (Modern build tooling, State management, Hooks, Responsive UI)
* **Backend & Auth:** Supabase (Backend-as-a-Service)
* **Database:** PostgreSQL (Relational data modeling & specialized indexing)
* **Hosting:** Netlify (Continuous Deployment) / Docker (Containerized Deployment)

---

## 🚀 Key Features

* **AI Clinical Assistant (Loli):** Advanced AI-powered assistant for patient care analysis, treatment recommendations, and clinical documentation with voice input support in Myanmar language.
* **Clinical Record Management:** Comprehensive tracking of patient visits and history.
* **Tooth-Level Specificity:** Specialized data arrays to track treatments on specific teeth (ISO/FDI standard support).
* **Financial Tracking:** Integrated billing system to manage treatment costs and payments.
* **Data Efficiency:** Engineered for scalability, utilizing an optimized PostgreSQL schema capable of handling ~2.2 million records per 500MB of storage.
* **Real-time Updates:** Instant data persistence and retrieval powered by Supabase.

## 🤖 AI Clinical Assistant (Loli)

**DentalCloud** features an advanced AI assistant named **Loli** powered by Qwen AI technology, designed specifically for dental healthcare:

### ✨ Core Capabilities
* **Clinical Analysis:** Provides patient case analysis and treatment recommendations
* **Voice Input:** Supports Myanmar language speech recognition with custom dental terminology
* **Intelligent Suggestions:** Offers evidence-based dental diagnosis suggestions
* **Documentation Support:** Assists with clinical documentation and record keeping
* **Context Awareness:** Maintains conversation context across sessions

### 🧠 Advanced Features
* **Myanmar Language Support:** Optimized for local language with SpeechGrammarList
* **Dental Terminology:** Custom vocabulary for better recognition accuracy
* **Feedback Learning:** Adapts to user preferences based on helpfulness ratings
* **Multi-mode Operation:** Ask mode for analysis, Agent mode for data changes

### 💬 User-Friendly Interface
* **Natural Language Processing:** Communicate using conversational language
* **Visual Feedback:** Thumbs up/down rating system for continuous improvement
* **Guided Workflows:** Step-by-step assistance for complex procedures
* **Quick Prompts:** Predefined suggestions for common tasks

### 📈 Autonomous Improvement
* **Learning Algorithm:** Becomes smarter based on user feedback patterns
* **Adaptive Responses:** Adjusts communication style to match user preferences
* **Persistent Memory:** Remembers conversation context and user preferences

---

## 🏛 Database Architecture

The system is optimized for relational integrity and storage efficiency.

## ⚙️ Local Development

To run this project locally, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/MinThutaSawNaing/DentalCloud-by-Thuta.git
    cd DentalCloud-by-Thuta
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Setup:**
    Create a `.env` file in the root directory and add your AI API key:
    ```env
    AI_API_KEY=your_ai_api_key_here
    ```

4.  **Launch:**
    ```bash
    npm run dev
    ```

---

## 🐳 Docker Deployment

The production Compose configuration runs the static site with nginx and applies
bounded CPU, memory, swap, PID, temporary-storage, and log usage. It also uses a
read-only root filesystem, drops Linux capabilities, enables health checks, and
restarts the service after a process or host failure.

1.  **Build and start the production service:**
    ```bash
    docker compose -f compose.production.yml up -d --build
    ```

2.  **Optional build-time AI configuration:**
    ```bash
    AI_API_KEY=your_api_key_here docker compose -f compose.production.yml up -d --build
    ```

    Vite embeds this value in browser JavaScript. It is **not a secret** and must
    not be a privileged provider credential.

3.  **Inspect status, health, and resource use:**
    ```bash
    docker compose -f compose.production.yml ps
    docker stats dentalcloud-web
    docker inspect --format='{{.State.Health.Status}}' dentalcloud-web
    ```

4.  **Access the application:**
    Open your browser and navigate to `http://localhost:18082`

The defaults are `0.50` CPU, a `128 MiB` memory/swap ceiling, a `64 MiB` memory
reservation, and 100 PIDs. Override them when necessary:

```bash
DENTALCLOUD_CPU_LIMIT=1.0 DENTALCLOUD_MEMORY_LIMIT=256m \
docker compose -f compose.production.yml up -d
```

These controls contain failures; they cannot guarantee years of uninterrupted
operation. Keep Docker and the host patched, monitor health/OOM/restart counts,
test backups for Supabase and other persistent services, and schedule controlled
maintenance. The frontend container itself stores no persistent application data.

---

## 👨‍💻 Author
**Min Thuta Saw Naing (Eric)**
* GitHub: [@MinThutaSawNaing](https://github.com/MinThutaSawNaing)
* Project Link: [DentalCloud](https://dentalcloudbythuta.netlify.app/)

---
*This project was developed as a showcase of full-stack engineering capabilities, focusing on cloud-native architecture and optimized relational database design.*
