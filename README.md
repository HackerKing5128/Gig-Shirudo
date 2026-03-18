# Gig Shirudo 🛡️
![Gig Shirudo Banner](/assets/project-banner.png)

### AI-Powered Parametric Income Protection for Gig Workers

## Team : CodeBlooded

## 🚀 Project Overview

Gig Shirudo is an **AI-powered parametric insurance platform** designed to protect gig economy delivery workers from **income loss caused by external disruptions** such as extreme weather, pollution, and city-wide restrictions.

⚡ **Key Innovation:**  
This platform focuses specifically on income protection (not health or asset insurance), aligning with parametric insurance principles.

This system eliminates manual claims entirely using **parametric triggers**:

> Event happens → Fixed payout → Instant compensation

Unlike traditional insurance, there is **no claim filing, no verification delay**.

---

## 🎯 Problem Statement

Gig delivery workers (Zomato, Swiggy) face income loss due to:

- Heavy rain
- Extreme heat
- Pollution
- Curfews
- Platform outages

These are:

✔ External  
✔ Measurable  
✔ Uncontrollable  

Yet **no structured income protection exists today**.

---

## 👤 Target Persona

**Food Delivery Worker (Example Persona)**

| Attribute | Value |
|----------|------|
| Name | Rahul |
| Platform | Swiggy |
| City | Delhi |
| Earnings | ₹4000–₹5500/week |

---

## 💡 Solution Overview

Gig Shirudo provides:

- Weekly insurance plans
- Real-time disruption monitoring
- Automatic payout triggers
- Fraud-resistant parametric model

---

# ⚡ Core Concept: Parametric Insurance

Each trigger is:

✔ Verifiable  
✔ External  
✔ Tamper-proof  

### Example:

IF Rainfall > 50mm in worker's active zone
→ ₹800 payout automatically triggered

No income calculation required.

---

# 🌦️ Parametric Triggers

| Event | Condition | Payout | Data Source |
|------|----------|--------|-------------|
| Heavy Rain | Rainfall > 50mm | ₹800 | OpenWeather API |
| Extreme Heat | Temp > 42°C | ₹600 | OpenWeather API |
| High Pollution | AQI > 350 | ₹500 | AQI API |
| Curfew | Govt Alert | ₹1000 | News/Public APIs |
| Platform Downtime | API failure > 30 mins | ₹700 | Platform Monitoring |

> All triggers are externally verifiable, real-time measurable, and tamper-proof, ensuring trust in automated payouts. 

> This approach ensures zero-claim processing time and eliminates manual verification overhead.

## ⚡ Why Parametric Works Better

- No claim filing required  
- Instant payouts  
- Transparent conditions  
- Reduced fraud risk  
- Scalable across cities  

---

# 💰 Weekly Pricing Model

### Formula:
Base Premium = 5% of weekly income  
Final Premium = Base × Risk Multiplier


### Risk Levels:

| Risk | Multiplier |
|------|-----------|
| Low | 1.0 |
| Medium | 1.2 |
| High | 1.5 |

### Example:

Weekly income = ₹5000  
Base premium (5%) = ₹250  
Risk multiplier = 1.2  

Final premium = ₹300/week


---

# 🤖 AI Integration

## ✅ Phase-1
> This ensures a fully functional and testable MVP without dependency on complex ML models.

- Rule-based risk scoring  
- Static thresholds for triggers  
- Basic fraud validation  

## 🚀 Future AI (Planned)

- Risk prediction → Random Forest  
- Fraud detection → Isolation Forest  
- Income estimation → Regression  

---

# 🛡️ Fraud Prevention

Parametric nature itself reduces fraud.

Additional checks:

- Worker location verification  
- Activity validation  
- Duplicate claim detection  

---

# 🔄 System Workflow

1. Worker registers  
2. Selects insurance plan  
3. System continuously monitors external data sources  
4. Trigger condition met  
5. **Fixed payout activated (parametric)**  
6. Fraud check  
7. Instant payout  

---

# 🚀 Phase-1 Prototype (MVP)

This prototype demonstrates end-to-end parametric insurance flow with simulated real-world triggers.

✔ Worker onboarding form  
✔ Premium calculation (rule-based)  
✔ Trigger simulation button  
✔ Automatic payout generation (mock)  
✔ Dashboard showing policy + claims  

---

# 🎬 Demo Flow 

1. User signs up  
2. Selects plan  
3. System calculates premium  
4. Click "Simulate Rain"  
5. Trigger activates  
6. Instant payout shown  

---

# 🧱 System Architecture 

```
Frontend → Backend API → Rule Engine → Trigger Monitor → External APIs → Fraud Check → Payout System
```

### 🔹 Rule Engine (Phase-1)
- Evaluates trigger conditions  
- Calculates payout  

---

# 🛠️ Tech Stack

## 🎨 Frontend
- React (Vite)
- TailwindCSS
- Axios (API communication)

---

## ⚙️ Backend
- Node.js
- Express.js

---

## 🗄️ Database
- PostgreSQL (production-ready)
- SQLite (used for Phase-1 development and local testing)

---

## 🧠 AI / ML (Planned Integration)
- Python
- Scikit-learn
- FastAPI (for future model serving as a microservice)

---

## 🔗 APIs & Data Sources
- OpenWeather API (weather-based triggers)
- AQI API (pollution monitoring)
- Simulated data layer (used for Phase-1 testing and trigger demonstration)

---

## ⚡ Core Engine
- Rule-based Parametric Engine (implemented in Express backend)
  - Trigger condition evaluation
  - Fixed payout execution

---

## 💸 Payments
- Simulated payout system (Phase-1 demonstration)
- Razorpay / UPI (planned production integration)

---


# 📊 Development Roadmap

Phase 1:
- Problem understanding
- Parametric logic
- MVP prototype

Phase 2:
- Backend + UI build

Phase 3:
- AI models

Phase 4:
- Automation engine

---

# 🌍 Impact

- Protect gig workers from income shocks  
- Enable instant payouts  
- Remove claim delays  
- Build trust in digital insurance  

---

# 📁 Repository Structure
``` bash
Gig-Shirudo/
├── README.md
├── frontend/
├── backend/
├── ai-models/
├── docs/
└── assets/
```


---

# 🧠 Final Note

Gig Shirudo redefines insurance by replacing **manual claims with automated, data-driven payouts**, making financial protection **instant, transparent, and scalable**.

---
