# 📱 GreenRoute Mobile Application: Architecture, Technology Stack & Implementation Roadmap

## 1. Executive Summary & Vision

GreenRoute is expanding from its desktop web portal into an **enterprise-grade, cross-platform mobile application** (iOS & Android). The mobile application brings real-time IoT smart bin interaction into the hands of two key field personas:
1. **The Green Citizen (Recycler):** Uses phone camera to scan physical QR codes affixed to smart bins, detects recyclable materials via AI Vision, claims verified Green Points, tracks recycling streaks, and redeems campus cafeteria vouchers.
2. **The Fleet Driver / Collector:** Turn-by-turn navigation overlay, offline-first routing cache for basement/dead-zone waste collection, and rapid bin empty/full status confirmation.
3. **The Field Technician:** Diagnostics scanner to check ultrasonic fill level sensors, battery voltages, and assign new tamper-evident QR serials to newly installed physical bins.

---

## 2. Technology Stack Evaluation & Decision

### Selected Stack: **React Native + Expo SDK 51+ (TypeScript)**

| Criteria | React Native (Expo) ⭐ Selected | Flutter | Native (Swift / Kotlin) | Capacitor / PWA |
| :--- | :--- | :--- | :--- | :--- |
| **Cross-Platform** | 100% Shared UI for iOS & Android | 100% Shared UI | 2 separate codebases | Web wrapped in WebView |
| **Camera & QR Speed** | Native GPU-accelerated (`expo-camera` / `react-native-vision-camera`) | Native (`mobile_scanner`) | Native AVFoundation / CameraX | Browser `getUserMedia` |
| **Geolocation & Geofence** | Native background geofencing (`expo-location`) | Native (`geolocator`) | Full native control | Web Geolocation API (restricted in bg) |
| **Offline-First Storage** | `expo-sqlite` / WatermelonDB | `sqflite` / Hive | CoreData / Room | IndexedDB / localStorage |
| **Push Notifications** | `expo-notifications` (APNs & FCM unified) | Firebase FCM | APNs & FCM separate | Web Push (iOS limited) |
| **Time to Market** | ⚡ Fast (reusable JS/TS logic from web) | Moderate (Dart required) | Slow (2x dev effort) | ⚡ Fast (WebView limitations) |

### Why Expo?
- **Zero Native Build Friction:** Compile APK, AAB, and iOS IPA in the cloud using EAS (Expo Application Services).
- **Hardware Native Modules:** Built-in hardware camera QR scanning with `CameraView`, high-accuracy GPS with `expo-location`, and tactile vibration cues with `expo-haptics`.
- **Deep Linking Engine:** Universal scheme `greenroute://scan?bin_id=3` or `https://greenroute.app/bin/3` opens the app directly into the verified deposit viewfinder.

---

## 3. System Architecture & Component Hierarchy

```mermaid
graph TD
    subgraph Mobile Application (React Native / Expo)
        A[App Navigation / Expo Router] --> B[Auth Guard / JWT Store]
        B --> C[Citizen View]
        B --> D[Driver View]
        B --> E[Admin Inspector]

        subgraph Citizen Module
            C --> C1[Interactive Map & Smart Bins]
            C --> C2[Live Hardware Camera QR Scanner]
            C --> C3[AI Waste Item Vision Model]
            C --> C4[Gamification, Streaks & Vouchers]
        end

        subgraph Driver Module
            D --> D1[Dynamic TSP Turn-by-Turn Route]
            D --> D2[Offline Tile Cache]
            D --> D3[One-Tap Bin Collected Toggle]
        end

        subgraph Core Services
            S1[Secure Store / Token Manager]
            S2[Offline SQLite Sync Engine]
            S3[Haversine Geofencing Validator]
        end
    end

    subgraph Backend Cloud (FastAPI)
        API1[/users/{id}/scan POST with GPS geofence]
        API2[/bins/ GET & /bins/{id}/qr]
        API3[/routing/optimize POST Dijkstra/TSP]
        API4[/telemetry WebSocket Stream]
    end

    C2 --> S3
    S3 --> API1
    C1 --> API2
    D1 --> API3
    D2 --> S2
```

---

## 4. Mobile Repository Structure (`/mobile`)

```text
mobile/
├── app.json                  # Expo app config (bundle ID, permissions, schemes)
├── package.json              # React Native dependencies
├── tsconfig.json             # TypeScript configuration
├── src/
│   ├── assets/               # Local icons, badges, and cyber sound effects
│   ├── components/           # Reusable UI components
│   │   ├── BentoCard.tsx     # Modern glassmorphism container
│   │   ├── QrReticle.tsx     # Animated cyber green QR targeting viewfinder
│   │   └── StreakBadge.tsx   # Streak fire counter & rank badge
│   ├── screens/              # Core Application Screens
│   │   ├── CitizenMapScreen.tsx      # Map of nearby smart bins with fill levels
│   │   ├── CitizenScannerScreen.tsx  # Native Camera QR + AI item classifier
│   │   ├── RewardsWalletScreen.tsx   # Green points, quest cards, voucher pass
│   │   └── DriverRouteScreen.tsx     # Turn-by-turn navigation & collection list
│   ├── services/             # Networking, Storage & Hardware Bridges
│   │   ├── api.ts            # Axios / Fetch client connecting to FastAPI
│   │   ├── auth.ts           # SecureStore JWT token lifecycle
│   │   ├── qrScanner.ts      # Hardware camera QR decoder & URL validator
│   │   ├── geofence.ts       # Native GPS coordinate & 50m proximity validator
│   │   └── offlineCache.ts   # SQLite offline mutation queue
│   └── types/                # TypeScript interfaces (Bin, User, ScanResult)
└── README.md                 # Running with Expo Go & Building APK/IPA
```

---

## 5. Security & Anti-Fraud Architecture for Physical QR Codes

A common vulnerability in QR-based recycling systems is **"Sticker Spoofing"** (users photographing the QR code and scanning it from home to farm points). GreenRoute eliminates this through a **3-Layer Defense-in-Depth Model**:

1. **GPS Geofence Verification:**
   - When the user scans the bin's physical QR code, `expo-location` captures the citizen's GPS coordinates (`latitude`, `longitude`) with high accuracy (`Accuracy.Highest`).
   - The backend computes the Haversine distance between the citizen and the bin's registered coordinates.
   - If distance $\le 50\text{ meters}$, the scan is verified and receives the `VERIFIED_ON_SITE` bonus ($+15$ pts).
   - If distance $> 200\text{ meters}$, the scan is flagged `SPOOF_FLAGGED` and points are withheld.

2. **Tamper-Evident Physical QR Label:**
   - The physical label is generated with a cryptographic tag UID: `GR-{tenant}-{bin_id}-{sha256_hash}`.
   - Weatherproof, destructible vinyl stickers: If peeled or removed from the bin, the label tears into tamper fragments.

3. **Rate Limiting & Daily Streak Multiplier Rules:**
   - Citizens can only log verified deposits at the same bin once every 15 minutes.
   - Streaks advance only once per calendar day.

---

## 6. Implementation Phasing & Milestones

### Phase 1: Core Foundation & Scanner (Weeks 1 - 2)
- [x] Backend QR Generation & Physical Vinyl Sticker Label Endpoints (`/bins/{id}/qr`, `/bins/{id}/qr-label`)
- [x] Admin Web QR Center with direct preview and batch ZIP download
- [x] Web Citizen camera scanner with `BarcodeDetector` and deep-link parsing
- [ ] Initialize Expo project in `/mobile`
- [ ] Implement `CitizenScannerScreen.tsx` using `expo-camera`
- [ ] Wire JWT authentication & user login

### Phase 2: Location, Geofence & AI Integration (Weeks 3 - 4)
- [ ] Implement `expo-location` high-accuracy proximity check
- [ ] Integrate Mobile AI Waste Classifier (TensorFlow Lite or Gemini Vision API via backend proxy)
- [ ] Gamification dashboard: Live streak progress, quest list, and rank celebrations

### Phase 3: Driver Navigation & Offline Sync (Weeks 5 - 6)
- [ ] Implement Driver turn-by-turn routing with Mapbox / Leaflet Native
- [ ] Build offline mutation queue with `expo-sqlite`
- [ ] Setup background WebSocket listener for IoT bin overflow alerts

### Phase 4: Production Store Launch (Week 7)
- [ ] Configure EAS Build profiles for Android (`.aab` for Google Play) and iOS (`.ipa` for TestFlight / App Store)
- [ ] Submit apps for campus beta rollout at Silver Oak University
