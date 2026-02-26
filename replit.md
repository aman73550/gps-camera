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
- **Files Tab**: Clean 3-column grid (Google Photos style, no text overlays), multi-select on long-press with batch Upload/Share/Save/Delete actions
- **Photo Detail**: Full info view with 4 action buttons: Share, Save to Gallery, Upload (manual-only with compression), Delete
- **Upload Workflow**: Manual-only; triggers compression (200-300KB) + security verification before POST to Express server
- **Security**: Photos stored in private app directory, AsyncStorage whitelist verification; unauthorized files blocked on upload
- **Guest Mode**: 20-photo upload limit for guests
- **Batch Operations**: Upload, Share, Save to DCIM gallery, and Delete multiple photos at once
- **Sync Status**: Each photo shows a grey cloud (local only) or green cloud-done (uploaded) badge in the grid and detail view; status updates immediately after upload
- **Infinite Scroll Pagination**: Files tab loads 20 photos initially and loads the next 20 as user scrolls to the bottom, with a footer showing current vs total count
- **Supabase Integration**: PostgreSQL backend for upload tracking, user profiles, and tier-based upload limits
- **Dynamic Tiers**: Guest (20 total), Standard (50/day, 1000/month), Pro (unlimited) — enforced server-side via Supabase
- **Admin Panel**: Web UI at `/admin` with dashboard stats, 7-day chart, user tier management (upgrade/downgrade), paginated uploads table, and retention policy settings
- **Auto-Delete Cleanup**: Server-side nightly cron at 2am that deletes uploads exceeding the configured retention period (3/6/12 months) when enabled in the admin panel
- **Offline Queue**: Network monitoring via expo-network; offline banner in Files tab shows pending count; uploads that fail due to network are marked `pendingUpload: true` and shown in the tab badge
- **Custom Text Overlay**: Optional Project Name/Note field on camera (folder icon button toggles it); note is permanently burned into pixel overlay, shown with yellow label above GPS data strip
- **App Version Check**: On startup pings Supabase `app_settings.required_version`; if current app version is lower, shows a non-dismissible update dialog directing user to the app store
- **Privacy Policy**: Settings tab added to navigation; contains Privacy Policy and Terms of Service links (update URLs in `app/(tabs)/settings.tsx`)
- **Haptic + Shutter Sync**: Camera shutter and haptic feedback now fire simultaneously via `Promise.all` for a premium feel

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
  photo-storage.ts         # AsyncStorage operations, serial generation, isWhitelisted
  upload.ts                # Upload logic: security verify, compress, POST to server
  query-client.ts          # React Query client

constants/
  colors.ts                # Material 3 tonal blue color palette

server/
  index.ts                 # Express server entry
  routes.ts                # API routes
```

## Performance & UX

- **Instant Location**: Last-known GPS cached in AsyncStorage, restored instantly on every app launch — no waiting for "Fetching location..."
- **Background Processing**: All image resize/crop/compress runs inside `InteractionManager.runAfterInteractions()` so camera shutter animations and haptics never stutter
- **FadeThrough Transitions**: Both tabs fade in with Material 3 easing (`Easing.bezier(0.4, 0, 0.2, 1)`, 280ms) via `FadeInView` + `useFocusEffect`
- **Container Transform**: Grid items scale to 0.94 on press-in (100ms), spring back on press-out (220ms) using reanimated v4 `useSharedValue`
- **Photo Detail Transition**: Stack navigation uses `fade_from_bottom` at 300ms for a native container-transform feel

## File Structure

```
app/
  _layout.tsx              # Root layout; photo/[id] uses fade_from_bottom animation
  (tabs)/
    _layout.tsx            # Two-tab layout (Camera + Files)
    index.tsx              # Camera tab screen; FadeInView + InteractionManager
    files.tsx              # Files/gallery tab; FadeInView + animated grid items

components/
  FadeInView.tsx           # Reusable M3 fade component (useFocusEffect + reanimated)
  QRCodeView.tsx           # QR code rendering component
  PhotoOverlay.tsx         # GPS overlay for photos
  ErrorBoundary.tsx        # Error boundary
  ErrorFallback.tsx        # Error fallback UI

lib/
  location-cache.ts        # AsyncStorage cached location (instant Fast-Fix display)
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
