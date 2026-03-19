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

## 📋 Coverage Scope

**What Gig Shirudo Covers:**
✅ **Income Loss ONLY** - Compensation for earnings lost due to external disruptions (weather, pollution, curfews, platform outages)

**What is NOT Covered:**
❌ Health insurance or medical expenses
❌ Vehicle damage or repair costs
❌ Accident-related injuries or hospitalization
❌ Personal asset protection

**Why this scope?**
Parametric insurance works best for measurable, external events with fixed payouts. Medical claims and vehicle repairs require individual assessment, making them unsuitable for automated parametric triggers. By focusing exclusively on income protection, we maintain the integrity of instant, no-claim payouts.

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

# 🚨 Adversarial Defense & Anti-Spoofing Strategy

## The Threat: Coordinated GPS Spoofing Attack

A critical vulnerability exists in parametric insurance: **GPS-only location verification**.

**Attack Scenario:**
- Coordinated groups (e.g., 500 workers via Telegram)
- GPS-spoofing apps to fake location in trigger zones
- Workers safely at home while claiming payouts
- Mass simultaneous claims drain liquidity pool instantly

**Why simple GPS verification fails:**
- Spoofing apps easily manipulate coordinates
- No cross-validation with real physical presence
- Parametric automation = instant payout before detection
- Single point of failure threatens entire system

---

## Our 3-Layer Defense Architecture

### 🎯 Layer 1: Multi-Signal Location Verification

**Beyond GPS - Cross-Reference Multiple Data Points:**

| Signal | Purpose | Why Spoofing Fails |
|--------|---------|-------------------|
| **Platform Activity Logs** | Cross-check with delivery platform API (orders accepted/completed) | Spoofed location won't match actual order geolocation |
| **Device Motion Sensors** | Accelerometer/gyroscope data indicates bike movement | Sitting at home = no delivery-pattern movement |
| **Network Metadata** | Cell tower IDs and signal strength patterns | Spoofer's home cell tower ≠ claimed weather zone tower |
| **Weather Data Cross-Check** | Compare claimed zone weather with worker's reported sensor data | Phone at home won't detect rain in distant zone |

**Implementation (Phase-1):**
- Rule-based checks: Platform activity + GPS correlation
- Motion sensor data validation (simple threshold checks)

**Future Enhancement (Phase-2+):**
- ML model trained on legitimate delivery patterns vs anomalies
- Real-time cell tower triangulation integration

---

### 🔍 Layer 2: Behavioral Pattern & Fraud Ring Detection

**Identify Coordinated Attacks:**

| Red Flag | Detection Method | Implementation |
|----------|------------------|----------------|
| **Mass simultaneous claims** | 100+ claims from same zone within 10 minutes | Rule-based alert threshold (Phase-1) |
| **Identical GPS coordinates** | Multiple workers claiming exact same location | Clustering detection (Phase-2: DBSCAN) |
| **New account exploitation** | First-time users immediately making claims | Account age + activity history scoring |
| **Platform inactivity during trigger** | Claim triggered but zero orders accepted in last 2 hours | Cross-validation with platform API |

**Anomaly Scoring (Planned - Phase-2):**
- Isolation Forest algorithm to detect mass claim spikes
- Time-series analysis of claim patterns (normal vs coordinated)
- Social graph analysis (future: detect Telegram group patterns)

---

### ⚡ Layer 3: Real-Time Legitimacy Scoring

**Composite Trust Score (0-100):**

```
Legitimacy Score =
  (40% Platform Activity in last 2 hours) +
  (30% Multi-signal location match) +
  (20% Historical delivery pattern) +
  (10% Device sensor consistency)
```

**Payout Decision Matrix:**

| Score Range | Action | Timeline | UX Impact |
|-------------|--------|----------|-----------|
| **80-100** | ✅ Auto-approve | Instant | Zero friction for legitimate workers |
| **50-79** | 🟡 Delayed review | 2-4 hours | SMS: "Verifying location, payout by evening" |
| **0-49** | 🔴 Manual investigation | 24 hours | Account flagged, human review required |

---

## 🤖 How AI/ML Differentiates Genuine vs Fraud

### Genuine Worker Profile:
```
✅ GPS location matches cell tower zone
✅ Accelerometer shows bike movement (last 60 mins)
✅ Platform API: 4 orders delivered today
✅ Historical data: 180 days active, consistent delivery zones
→ Legitimacy Score: 95/100 → Instant ₹800 payout
```

### Spoofing Attacker Profile:
```
❌ GPS shows rain zone, cell tower shows residential area 15km away
❌ Accelerometer: stationary for 3+ hours (no delivery motion)
❌ Platform API: zero orders accepted today
❌ Account created 2 days ago, first trigger claim
→ Legitimacy Score: 12/100 → Flagged for investigation
```

**Key Differentiator: Platform Activity Integration**
- Real gig workers have continuous platform engagement during shift hours
- Spoofing syndicates can't fake actual order acceptance/delivery on Swiggy/Zomato systems
- Cross-validation with delivery platform APIs becomes the "ground truth"

---

## 📊 Data Points Analyzed (Beyond GPS)

### Primary Signals:
1. **Platform Integration Data**
   - Order acceptance timestamps
   - Delivery completion locations
   - Shift start/end times
   - Customer ratings received today

2. **Device Sensor Data**
   - Accelerometer patterns (delivery vs stationary)
   - Gyroscope (bike turning/movement detection)
   - Battery drain patterns (GPS + screen usage indicates active delivery)

3. **Network Metadata**
   - Cell tower ID logs
   - Network handoff patterns (movement between towers)
   - Signal strength variations

4. **Environmental Cross-Check**
   - Weather API data for worker's tower zone
   - Historical trigger patterns for the zone

### Fraud Ring Detection Signals:
1. **Temporal Clustering**
   - Claim timestamp patterns (coordinated attacks = tight time windows)
   - Account creation date clustering (mass signup before attack)

2. **Spatial Clustering**
   - GPS coordinate clustering (multiple claims from identical lat/long)
   - Cell tower clustering (attackers in same residential area)

3. **Behavioral Anomalies**
   - First claim = high-value trigger (no history of smaller claims)
   - Sudden activity spike from dormant accounts

---

## ⚖️ UX Balance: Protecting Honest Workers

### Problem: Legitimate Worker Edge Cases
**Scenario 1:** Network drops during genuine weather event
- Phone battery dying in rain
- Intermittent GPS signal
- Temporary location accuracy issues

**Scenario 2:** New gig workers
- Recently joined platform
- Limited historical data
- Genuine first claim during actual trigger

### Our Solution: Benefit-of-Doubt Tiers

**For Low-Score Legitimate Workers:**

| Situation | System Response | Timeline | User Communication |
|-----------|----------------|----------|-------------------|
| **Low score + High platform activity** | Delayed approval | 2-4 hours | "Verifying location due to network issues, payout today" |
| **New account + Active orders** | Manual priority review | 6 hours | "First claim under review, expedited process" |
| **Network drop detected** | Grace period extension | 24 hours | "We see network issues in your area, reviewing claim" |

**False Positive Prevention:**
- Historical trust builds over time (consistent delivery pattern = faster approvals)
- Appeal process for disputed flags (human review within 24 hours)
- Transparent scoring dashboard in worker app: "Your trust score: 87/100"
- If proven false positive: Full payout + ₹50 apology bonus

**Communication Protocol:**
- Real-time SMS updates on claim status
- Clear explanation if flagged (e.g., "Location verification pending")
- No generic "claim denied" - specific reason provided
- Human support escalation for disputed cases

---

## 🔄 Fraud Prevention Workflow

```
Trigger Event Detected
    ↓
1. Check Legitimacy Score
    ↓
├─ Score ≥ 80 → Instant Payout ✅
├─ Score 50-79 → Queue for Review (2-4h) 🟡
└─ Score < 50 → Flag + Manual Investigation 🔴
    ↓
2. Anomaly Detection (Parallel Check)
    ↓
├─ Mass claim spike? → Alert fraud team
├─ Coordinate clustering? → Flag entire group
└─ Platform inactivity? → Cross-validate with API
    ↓
3. Final Decision
    ↓
├─ Approved → Payout + Update trust score
├─ Delayed → SMS notification + Timeline
└─ Rejected → Reason provided + Appeal option
```

---

## 🛠️ Implementation Phases

### Phase-1 (Current MVP):
- ✅ Basic GPS + Platform activity validation
- ✅ Rule-based scoring for obvious fraud patterns
- ✅ Manual review queue for flagged cases
- ✅ Simple threshold alerts for mass claims

### Phase-2 (AI Integration):
- 🔄 Machine learning models:
  - Random Forest for legitimacy scoring
  - Isolation Forest for anomaly detection
  - DBSCAN clustering for fraud ring identification
- 🔄 Real-time cell tower integration
- 🔄 Advanced motion pattern analysis

### Phase-3 (Advanced Defense):
- 🔮 Deep learning for behavioral biometrics
- 🔮 Social network analysis (detect coordination patterns)
- 🔮 Blockchain-based immutable audit trail
- 🔮 Predictive fraud prevention (flag accounts before attack)

---

## 💪 Why Our Defense is Resilient

1. **Multi-Layered Approach**: No single point of failure - attackers must defeat all 3 layers simultaneously
2. **Platform Integration**: Impossible to fake actual Swiggy/Zomato order logs (our "ground truth")
3. **Behavioral Analysis**: Detects coordinated patterns that individual spoofing can't hide
4. **Adaptive Scoring**: Legitimacy score improves with history - rewards honest workers
5. **Human Oversight**: AI flags suspicious patterns, humans make final call for edge cases

**The syndicate's attack vector is neutralized because:**
- GPS spoofing alone is insufficient (platform activity required)
- Coordinated mass claims trigger immediate anomaly alerts
- No historical delivery pattern = low legitimacy score
- Cell tower data contradicts spoofed GPS coordinates

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

# 📱 Platform Architecture & Justification

## Platform Choice: Progressive Web App (PWA)

We chose **PWA** as the optimal balance between user experience and development feasibility. While native apps offer the smoothest experience, PWA provides 80% of native capability with 40% of development time - critical for rapid prototyping and iteration during this hackathon. Our target users (delivery workers) need installable, offline-capable, notification-enabled apps - all achievable with PWA using our existing React expertise.

### Why PWA Over Native Mobile Apps?

**Native App Challenges:**
- Dual development (Android + iOS) = 2x time and cost
- App store approval delays (3-7 days per update)
- React Native learning curve (team has no prior experience)
- Not feasible for 6-week hackathon timeline

**Why PWA is Optimal:**

| Feature | Requirement | PWA Capability |
|---------|------------|----------------|
| **Phone-like access** | Workers need quick app launch | ✅ Install on home screen |
| **Offline functionality** | Network drops during weather events | ✅ Service workers cache data |
| **Push notifications** | Real-time trigger alerts | ✅ Web Push API |
| **GPS access** | Location verification | ✅ Geolocation API |
| **Motion sensors** | Anti-spoofing detection | ✅ Accelerometer/Gyroscope APIs |
| **Cross-platform** | Android + iOS workers | ✅ Single codebase |
| **Rapid iteration** | Fast updates during hackathon | ✅ No app store delays |

### Implementation Strategy:

**Phase-1 (Week 1-2):** Build standard React web application (current tech stack)
**Phase-2 (Week 3):** Convert to PWA (add manifest + service worker - ~4 hours)
**Phase-3+ (Week 4-6):** Enhance PWA features (offline sync, advanced notifications)

**Technical Approach:**
- Using Vite PWA Plugin for seamless conversion
- No code rewrite required - pure progressive enhancement
- Sensor APIs (GPS, accelerometer) accessible via standard Web APIs
- Push notifications via Firebase Cloud Messaging (FCM)

**Real-World Validation:**
Leading platforms (Twitter Lite, Starbucks, Flipkart Lite) use PWAs successfully in Indian market - proven approach for our target demographic of gig workers.

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
