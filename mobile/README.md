# 📱 GreenRoute Mobile App (Expo & React Native)

Cross-platform mobile client for **GreenRoute Smart Waste Management & Logistics Platform**. Built for iOS & Android with hardware camera QR scanning, GPS anti-fraud geofencing, and driver collection routing.

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Node.js** v18+ installed on your system.
- **Expo Go** app installed on your physical smartphone ([iOS App Store](https://apps.apple.com/app/expo-go/id982107779) / [Android Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)).

### 2. Install Dependencies
```bash
cd mobile
npm install
```

### 3. Start the Development Server
```bash
npx expo start
```
- A QR code will display in your terminal and browser.
- Open **Expo Go** on your iPhone or Android phone and scan the QR code to load the app instantly with hot-reloading!

### 4. Hardware Camera & Physical Bin QR Testing
1. Point your mobile phone camera at any physical bin sticker generated from the GreenRoute Admin Command Center (`admin.html` -> **🖨️ QR Labels**).
2. The app uses `expo-camera` hardware scanning (`CameraView`) to instantly lock onto the bin UID (e.g., `GR-SOU-0001`).
3. GPS coordinates are validated via `expo-location` with 50m geofencing.
4. Select material (Plastic, Organic, E-Waste) to log deposit and earn Green Points!

---

## 📦 Building Standalone APK / IPA for Distribution

Configure and build in the cloud with **EAS Build**:
```bash
# Install EAS CLI globally
npm install -g eas-cli

# Log in to your Expo account
eas login

# Build Android APK for direct testing
eas build -p android --profile preview

# Build iOS App Store bundle
eas build -p ios --profile production
```
