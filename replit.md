# GPS Camera

A professional GPS camera app built with Expo React Native that captures geo-tagged photos with unique serial numbers, QR codes, and anti-hack security measures.

## Architecture

- **Frontend**: Expo React Native with Expo Router (file-based routing)
- **Backend**: Express.js (port 5000) for API and landing page
- **State**: React Context + AsyncStorage for photo registry
- **Design**: Material 3 inspired with tonal blue palette, Inter font family

## Features

- **Camera Tab**: Live camera with real-time GPS overlay (lat/long/address)
- **Photo Capture**: Auto-generates serial numbers (IMG-YYYYMMDD-XXX) and QR codes
- **Image Compression**: Photos compressed to ~200-300KB via expo-image-manipulator
- **Files Tab**: Grid gallery with search by serial number and QR code scanner
- **Security**: Photos stored in private app directory, AsyncStorage whitelist verification
- **Guest Mode**: 20-photo upload limit for guests

## File Structure

```
app/
  _layout.tsx              # Root layout with fonts, providers
  (tabs)/
    _layout.tsx            # Two-tab layout (Camera + Files)
    index.tsx              # Camera tab screen
    files.tsx              # Files/gallery tab screen
  photo/
    [id].tsx               # Photo detail screen

components/
  QRCodeView.tsx           # QR code rendering component
  PhotoOverlay.tsx         # GPS overlay for photos
  ErrorBoundary.tsx        # Error boundary
  ErrorFallback.tsx        # Error fallback UI

contexts/
  PhotoContext.tsx          # Photo state management

lib/
  photo-storage.ts         # AsyncStorage operations, serial generation
  query-client.ts          # React Query client

constants/
  colors.ts                # Material 3 tonal blue color palette

server/
  index.ts                 # Express server entry
  routes.ts                # API routes
```

## Key Dependencies

- expo-camera: Camera and QR scanning
- expo-location: GPS coordinates and reverse geocoding
- expo-image-manipulator: Image compression
- expo-file-system: Private file storage
- expo-crypto: UUID generation
- react-native-qrcode-svg: QR code generation
- react-native-view-shot: View capture for overlays
- @expo-google-fonts/inter: Typography

## Running

- Frontend: `npm run expo:dev` (port 8081)
- Backend: `npm run server:dev` (port 5000)
