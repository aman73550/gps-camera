# GPS Camera

A professional GPS camera app built with Expo React Native that captures geo-tagged photos with unique serial numbers, QR codes, and anti-hack security measures.

## Architecture

- **Frontend**: Expo React Native with Expo Router (file-based routing)
- **Backend**: Express.js (port 5000) for API and landing page
- **Database**: Supabase PostgreSQL + Storage
- **State**: React Context + AsyncStorage for photo registry
- **Design**: Material 3 inspired with tonal blue palette, Inter font family

## Current Status

- **Login System**: DISABLED (all users are "pro" tier with unlimited uploads)
- **New Architecture**: DISABLED (`newArchEnabled: false` in app.json for stability)
- **Google OAuth**: Removed from active codebase (LoginModal deleted)

## Features

- **Camera Tab**: Live camera with real-time GPS overlay (lat/long/address)
- **Photo Capture**: Auto-generates serial numbers (IMG-YYYYMMDD-XXX) and QR codes
- **Image Compression**: Photos compressed to ~200-300KB via expo-image-manipulator
- **Files Tab**: Clean 3-column grid (Google Photos style), multi-select with batch actions
- **Photo Detail**: Full info view with Share, Save to Gallery, Upload, Delete
- **Upload Workflow**: Manual-only; triggers compression + security verification
- **Security**: Photos stored in private app directory, AsyncStorage whitelist verification
- **Batch Operations**: Upload, Share, Save to DCIM gallery, and Delete multiple photos
- **Sync Status**: Grey cloud (local) or green cloud-done (uploaded) badge
- **Infinite Scroll Pagination**: Files tab loads 20 photos, loads more on scroll
- **Supabase Integration**: PostgreSQL + Storage for uploads and user tracking
- **Admin Panel**: Web UI at `/admin` with dashboard, user management, uploads table
- **Auto-Delete Cleanup**: Nightly cron for retention policy
- **Offline Queue**: Network monitoring, offline banner, pending upload tracking
- **Custom Text Overlay**: Optional Project Name/Note field on camera
- **App Version Check**: Startup version gate via Supabase `app_settings`
- **QR Verification**: Public verification page at `/v/:serial`

## File Structure

```
app/
  _layout.tsx              # Root layout with fonts, providers, ErrorBoundary
  (tabs)/
    _layout.tsx            # Two-tab layout (Camera + Files)
    index.tsx              # Camera tab screen
    files.tsx              # Files/gallery tab screen
  photo/
    [id].tsx               # Photo detail screen
  settings.tsx             # Settings screen
  trash.tsx                # Recycle bin screen

components/
  ErrorBoundary.tsx        # Error boundary wrapper
  ErrorFallback.tsx        # Error fallback UI with stack trace
  FadeInView.tsx           # Reusable M3 fade animation
  GuestLimitModal.tsx      # Upload limit notification
  PhotoOverlay.tsx         # GPS overlay for photos
  QRCodeView.tsx           # QR code rendering

contexts/
  AuthContext.tsx           # Auth stub (login disabled, tier: "pro")
  PhotoContext.tsx          # Photo state management

lib/
  location-cache.ts        # AsyncStorage cached location
  photo-storage.ts         # AsyncStorage operations, serial generation
  query-client.ts          # React Query client
  signOutAlert.ts          # Sign out confirmation alert
  supabase.ts              # Supabase client + version check
  upload.ts                # Upload logic: verify, compress, POST

constants/
  colors.ts                # Material 3 tonal blue color palette

server/
  index.ts                 # Express server entry
  routes.ts                # API routes + admin panel + verification pages
  supabase.ts              # Server-side Supabase storage helpers
```

## Key Dependencies

- expo-camera: Camera and QR scanning
- expo-location: GPS coordinates and reverse geocoding
- expo-image-manipulator: Image compression
- expo-file-system: Private file storage
- expo-crypto: UUID generation
- react-native-qrcode-svg: QR code generation
- react-native-view-shot: View capture for overlays (lazy-loaded)
- @expo-google-fonts/inter: Typography

## Running

- Frontend: `npm run expo:dev` (port 8081)
- Backend: `npm run server:dev` (port 5000)

## Deployment

### Vercel
- `vercel.json` — routes to `api/index.ts` serverless function
- `api/index.ts` — Vercel entry point
- Domain: verifiedgpscamera.vercel.app

### EAS Build (Android APK)
- `eas.json` — build profiles (development/preview/production)
- Build: `eas build --platform android --profile preview`

### Required env vars
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SESSION_SECRET
ADMIN_USERNAME
ADMIN_PASSWORD
```

### Admin credentials
- Username: `Aman73550`
- Password: `Aman@73550`
