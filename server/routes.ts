import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import multer from "multer";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import {
  supabase,
  checkUploadLimit,
  recordUpload,
  recordUploadBatch,
  upsertProfile,
  getAppSettings,
  updateAppSettings,
  runAutoCleanup,
  requestUploadDelete,
  getPendingDeletions,
  confirmUploadDeletion,
  rejectUploadDeletion,
  isUserBanned,
  flagUpload,
  warnUser,
  banUser,
  unbanUser,
  claimGuestUploads,
  checkImageHashes,
  UploadRecord,
} from "./supabase";

const uploadsDir = path.resolve(process.cwd(), "server", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ACCEPTED_MIME = new Set(["image/jpeg", "image/jpg", "image/webp"]);

const multerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    cb(null, safeName);
  },
});

const upload = multer({
  storage: multerStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ACCEPTED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG or WebP images are allowed"));
    }
  },
});

async function tierCheckMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userPhone = req.headers["x-user-phone"] as string | undefined;
    const isGuestHeader = req.headers["x-is-guest"] as string | undefined;
    const isGuest = isGuestHeader === "true" || !userPhone;

    if (userPhone && !isGuest) {
      const banned = await isUserBanned(userPhone);
      if (banned) {
        return res.status(403).json({ error: "BANNED", message: "Your account has been suspended. Contact support." });
      }
    }

    const check = await checkUploadLimit(userPhone || null, isGuest);
    if (!check.allowed) {
      return res
        .status(429)
        .json({ error: check.reason, tier: check.tier });
    }

    (req as Request & { userPhone?: string | null; isGuest?: boolean; userTier?: string }).userPhone =
      userPhone || null;
    (req as Request & { userPhone?: string | null; isGuest?: boolean; userTier?: string }).isGuest =
      isGuest;
    (req as Request & { userPhone?: string | null; isGuest?: boolean; userTier?: string }).userTier =
      check.tier;

    next();
  } catch (err) {
    console.error("Tier check error:", err);
    next();
  }
}

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const adminSessions = new Map<string, number>();

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [token, expiry] of adminSessions) {
    if (now > expiry) adminSessions.delete(token);
  }
}

function isValidSession(token: string | undefined): boolean {
  if (!token) return false;
  pruneExpiredSessions();
  const expiry = adminSessions.get(token);
  return expiry !== undefined && Date.now() <= expiry;
}

function adminAuth(req: Request, res: Response, next: NextFunction) {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    return res.status(503).json({ error: "Admin credentials not configured" });
  }
  const authHeader = req.headers["authorization"] as string | undefined;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const queryToken = req.query["token"] as string | undefined;
  const token = bearerToken || queryToken;
  if (!isValidSession(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function verifyPage({ upload, error }: { upload?: Record<string, unknown>; error?: string }): string {
  const title = upload ? `Verified Photo · ${upload["serial_number"]}` : "Verified GPS Camera";
  const imgSrc = upload ? `/api/public/image/${encodeURIComponent(upload["serial_number"] as string)}` : null;
  const date = upload?.["created_at"] ? new Date(upload["created_at"] as string).toLocaleString("en-IN", {
    weekday: "short", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  }) : null;
  const mapsUrl = upload
    ? `https://www.google.com/maps?q=${upload["latitude"]},${upload["longitude"]}`
    : null;

  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#1a1a2e">
<title>${title}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  background:#0f0f1a;color:#e8e8f0;min-height:100vh;padding:0}
.header{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);
  padding:18px 20px 14px;border-bottom:1px solid rgba(255,255,255,.08);
  display:flex;align-items:center;gap:12px;}
.logo{font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px}
.logo span{color:#FFD700}
.verified-badge{background:rgba(76,175,80,.18);border:1px solid rgba(76,175,80,.5);
  color:#81C784;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700}
.content{max-width:640px;margin:0 auto;padding:20px 16px 40px}
.photo-wrap{border-radius:16px;overflow:hidden;background:#1e1e2e;
  box-shadow:0 8px 32px rgba(0,0,0,.5);margin-bottom:20px;position:relative}
.photo-wrap img{width:100%;display:block;max-height:70vh;object-fit:contain;background:#111}
.verified-strip{position:absolute;bottom:0;left:0;right:0;
  background:linear-gradient(transparent,rgba(0,0,0,.7));
  padding:24px 16px 10px;display:flex;align-items:center;gap:8px}
.shield{font-size:18px}.verified-text{font-size:13px;font-weight:700;color:#81C784}
.info-card{background:#1e1e2e;border-radius:14px;overflow:hidden;margin-bottom:16px;
  border:1px solid rgba(255,255,255,.07)}
.info-header{padding:12px 16px;background:rgba(255,255,255,.04);
  font-size:11px;font-weight:700;letter-spacing:1px;color:#888;text-transform:uppercase}
.info-row{display:flex;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.05);
  gap:12px;align-items:flex-start}
.info-row:last-child{border-bottom:none}
.info-icon{font-size:16px;flex-shrink:0;margin-top:1px}
.info-key{font-size:12px;color:#888;margin-bottom:3px;font-weight:600}
.info-val{font-size:14px;color:#e8e8f0;font-weight:500;word-break:break-all}
.info-val.mono{font-family:monospace;font-size:13px;color:#FFD700;letter-spacing:.5px}
.map-btn{display:flex;align-items:center;gap:8px;background:#2563EB;color:#fff;
  border:none;border-radius:10px;padding:12px 18px;font-size:14px;font-weight:700;
  cursor:pointer;width:100%;justify-content:center;text-decoration:none;
  margin-bottom:16px;transition:opacity .15s}
.map-btn:hover{opacity:.88}
.error-card{background:#2a0a0a;border:1px solid rgba(244,67,54,.3);border-radius:14px;
  padding:32px 20px;text-align:center}
.error-icon{font-size:40px;margin-bottom:12px}
.error-title{font-size:18px;font-weight:700;color:#EF5350;margin-bottom:8px}
.error-msg{font-size:14px;color:#aaa;line-height:1.6}
.footer{text-align:center;font-size:12px;color:#555;padding:24px 16px;
  border-top:1px solid rgba(255,255,255,.05)}
.footer b{color:#888}
.flagged-banner{background:#4a0a0a;border:1px solid rgba(244,67,54,.4);
  border-radius:10px;padding:12px 16px;display:flex;gap:10px;align-items:center;
  margin-bottom:16px;font-size:13px;color:#EF5350}
</style>
</head><body>
<div class="header">
  <div class="logo">📷 Verified <span>GPS</span> Camera</div>
  ${upload ? '<div class="verified-badge">✓ VERIFIED</div>' : ''}
</div>
<div class="content">
${error ? `
  <div class="error-card">
    <div class="error-icon">🔍</div>
    <div class="error-title">Record Not Found</div>
    <div class="error-msg">${error}<br><br>Make sure you scanned the QR code correctly from a Verified GPS Camera photo.</div>
  </div>
` : `
  ${(upload?.["flagged"] as boolean) ? `<div class="flagged-banner">🚩 <span>This image has been flagged by a moderator${upload["flag_reason"] ? `: ${upload["flag_reason"]}` : ""}.</span></div>` : ""}
  ${imgSrc && !(upload?.["flagged"] as boolean) ? `
  <div class="photo-wrap">
    <img src="${imgSrc}" alt="Verified Photo" loading="lazy" />
    <div class="verified-strip">
      <div class="shield">🛡️</div>
      <div class="verified-text">GPS-Verified Photo · Tamper-Proof Record</div>
    </div>
  </div>` : ""}
  <div class="info-card">
    <div class="info-header">📍 Location Details</div>
    ${upload?.["location_name"] ? `<div class="info-row"><div class="info-icon">🏙️</div><div><div class="info-key">Location</div><div class="info-val">${upload["location_name"]}</div></div></div>` : ""}
    ${upload?.["address"] ? `<div class="info-row"><div class="info-icon">📬</div><div><div class="info-key">Address</div><div class="info-val">${upload["address"]}</div></div></div>` : ""}
    <div class="info-row"><div class="info-icon">🌐</div><div><div class="info-key">Coordinates</div><div class="info-val">${Number(upload?.["latitude"]).toFixed(6)}°N, ${Number(upload?.["longitude"]).toFixed(6)}°E</div></div></div>
    ${upload?.["altitude"] ? `<div class="info-row"><div class="info-icon">⛰️</div><div><div class="info-key">Altitude</div><div class="info-val">${Number(upload?.["altitude"]).toFixed(1)} m</div></div></div>` : ""}
    ${upload?.["plus_code"] ? `<div class="info-row"><div class="info-icon">➕</div><div><div class="info-key">Plus Code</div><div class="info-val">${upload["plus_code"]}</div></div></div>` : ""}
  </div>
  <div class="info-card">
    <div class="info-header">🔐 Verification Details</div>
    <div class="info-row"><div class="info-icon">🔢</div><div><div class="info-key">Serial Number</div><div class="info-val mono">${upload?.["serial_number"]}</div></div></div>
    ${date ? `<div class="info-row"><div class="info-icon">📅</div><div><div class="info-key">Captured On</div><div class="info-val">${date}</div></div></div>` : ""}
    ${upload?.["file_size_kb"] ? `<div class="info-row"><div class="info-icon">💾</div><div><div class="info-key">File Size</div><div class="info-val">${upload["file_size_kb"]} KB</div></div></div>` : ""}
    <div class="info-row"><div class="info-icon">👤</div><div><div class="info-key">Uploaded By</div><div class="info-val">${upload?.["is_guest"] ? "Guest User" : "Registered User"}</div></div></div>
  </div>
  ${mapsUrl ? `<a class="map-btn" href="${mapsUrl}" target="_blank" rel="noopener">🗺️ View on Google Maps</a>` : ""}
`}
</div>
<div class="footer">Powered by <b>Verified GPS Camera</b> · GPS data is cryptographically tied to this image</div>
</body></html>`;
}

export async function registerRoutes(app: Express): Promise<Server> {

  // ── Public: serve image by serial (no auth needed — serial IS the access key) ──
  app.get("/api/public/image/:serial", async (req: Request, res: Response) => {
    if (!supabase) return res.status(503).send("Service unavailable");
    const serial = req.params["serial"] as string;
    const { data } = await supabase
      .from("uploads")
      .select("file_path, flagged")
      .eq("serial_number", serial)
      .single();
    if (!data?.file_path) return res.status(404).send("Not found");
    if (data.flagged) return res.status(403).send("This image has been flagged and is unavailable");
    const filename = path.basename(data.file_path);
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).send("Image file not found");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.sendFile(filePath);
  });

  // ── Public: verification page (scanned from QR on photo) ──
  app.get("/v/:serial", async (req: Request, res: Response) => {
    if (!supabase) {
      return res.send(verifyPage({ error: "Database unavailable" }));
    }
    const serial = req.params["serial"] as string;
    const { data } = await supabase
      .from("uploads")
      .select("serial_number, latitude, longitude, altitude, address, location_name, plus_code, file_size_kb, is_guest, created_at, flagged, flag_reason")
      .eq("serial_number", serial)
      .single();
    if (!data) return res.status(404).send(verifyPage({ error: "No record found for this serial number." }));
    return res.send(verifyPage({ upload: data }));
  });

  app.post("/api/admin/login", (req: Request, res: Response) => {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
      return res.status(503).json({ error: "Admin credentials not configured" });
    }
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = crypto.randomBytes(32).toString("hex");
    adminSessions.set(token, Date.now() + SESSION_TTL_MS);
    return res.json({ token });
  });

  // ── Admin logout — invalidates the session token ──
  app.post("/api/admin/logout", adminAuth, (req: Request, res: Response) => {
    const authHeader = req.headers["authorization"] as string | undefined;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    if (token) adminSessions.delete(token);
    return res.json({ ok: true });
  });

  // ── Auth: login / register by phone ─────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      // Accept phone, email, or a generic identifier
      const body = req.body as { phone?: string; email?: string; identifier?: string; name?: string; provider?: string };
      const raw = body.identifier ?? body.email ?? body.phone ?? "";
      if (!raw || typeof raw !== "string") {
        return res.status(400).json({ error: "Phone number or email is required" });
      }

      // Only validate format for pure phone-number logins
      const isEmail = raw.includes("@");
      const isPhone = !isEmail;
      if (isPhone) {
        const digits = raw.replace(/\D/g, "");
        if (digits.length < 7 || digits.length > 15) {
          return res.status(400).json({ error: "Invalid phone number format" });
        }
      }

      const identifier = raw.trim();

      let tier: "standard" | "pro" = "standard";
      if (supabase) {
        const { data, error } = await supabase
          .from("profiles")
          .upsert({ phone: identifier }, { onConflict: "phone", ignoreDuplicates: true })
          .select("tier")
          .single();
        if (!error && data?.tier) {
          tier = data.tier as "standard" | "pro";
        } else if (error && error.code !== "23505") {
          const { data: existing } = await supabase
            .from("profiles")
            .select("tier")
            .eq("phone", identifier)
            .single();
          if (existing?.tier) tier = existing.tier as "standard" | "pro";
        }
      }

      return res.json({ success: true, phone: identifier, tier, provider: body.provider ?? "phone" });
    } catch (err) {
      console.error("Auth login error:", err);
      return res.status(500).json({ error: "Server error during login" });
    }
  });

  // ── Auth: get current user profile ──────────────────────────
  app.get("/api/auth/profile", async (req: Request, res: Response) => {
    try {
      const phone = req.headers["x-user-phone"] as string | undefined;
      if (!phone) return res.status(400).json({ error: "Phone required" });

      let tier: "standard" | "pro" = "standard";
      let banned = false;
      let warned = false;
      let warnMessage: string | null = null;
      let banReason: string | null = null;

      if (supabase) {
        const { data } = await supabase
          .from("profiles")
          .select("tier, banned, warned, warn_message, ban_reason")
          .eq("phone", phone)
          .single();
        if (data?.tier) tier = data.tier as "standard" | "pro";
        if (data?.banned) banned = true;
        if (data?.warned) { warned = true; warnMessage = data.warn_message || null; }
        if (data?.ban_reason) banReason = data.ban_reason || null;
      }

      return res.json({ success: true, phone, tier, banned, warned, warnMessage, banReason });
    } catch {
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post(
    "/api/upload",
    tierCheckMiddleware,
    upload.single("photo"),
    async (req: Request, res: Response) => {
      if (!req.file) {
        return res.status(400).json({ error: "No file received" });
      }

      const uploadSettings = await getAppSettings();
      const maxFileMb = uploadSettings.image_max_file_mb ?? 5;
      const allowedFormat = uploadSettings.image_format ?? "auto";

      if (req.file.size > maxFileMb * 1024 * 1024) {
        fs.unlinkSync(req.file.path);
        return res.status(413).json({ error: "FILE_TOO_LARGE", maxMb: maxFileMb });
      }

      if (allowedFormat === "jpeg" && !["image/jpeg", "image/jpg"].includes(req.file.mimetype)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "IMAGE_FORMAT_NOT_ALLOWED", allowedFormat });
      }

      const { serialNumber, latitude, longitude, address, locationName, plusCode, altitude, imageHash } =
        req.body;
      const reqExt = req as Request & {
        userPhone?: string | null;
        isGuest?: boolean;
        userTier?: string;
      };
      const userPhone = reqExt.userPhone ?? null;
      const isGuest = reqExt.isGuest ?? true;

      const skipRecord = req.headers["x-skip-record"] === "true";

      if (!skipRecord) {
        await recordUpload({
          user_phone: userPhone,
          serial_number: serialNumber || "",
          latitude: parseFloat(latitude) || 0,
          longitude: parseFloat(longitude) || 0,
          altitude: parseFloat(altitude) || 0,
          address: address || "",
          location_name: locationName || "",
          plus_code: plusCode || "",
          file_path: req.file.filename,
          file_size_kb: Math.round(req.file.size / 1024),
          is_guest: isGuest,
          image_hash: imageHash || null,
        });
      }

      if (userPhone) {
        await upsertProfile(userPhone);
      }

      console.log(
        `Upload: ${serialNumber} (${req.file.size}B) user=${userPhone || "guest"} skipRecord=${skipRecord}`,
      );

      return res.status(200).json({
        success: true,
        message: "Photo uploaded successfully",
        serial: serialNumber,
        filePath: req.file.filename,
      });
    },
  );

  app.get("/api/uploads", (_req: Request, res: Response) => {
    try {
      const files = fs
        .readdirSync(uploadsDir)
        .filter((f) => f.endsWith(".jpg") || f.endsWith(".webp"));
      res.json({ count: files.length, files });
    } catch {
      res.json({ count: 0, files: [] });
    }
  });

  app.post(
    "/api/record-uploads",
    async (req: Request, res: Response) => {
      try {
        const userPhone = req.headers["x-user-phone"] as string | undefined;
        const isGuestHeader = req.headers["x-is-guest"] as string | undefined;
        const isGuest = isGuestHeader === "true" || !userPhone;
        const uploads = req.body?.uploads as Array<{
          serialNumber: string;
          latitude: number;
          longitude: number;
          altitude: number;
          address: string;
          locationName: string;
          plusCode: string;
          filePath: string;
          fileSizeKb: number;
        }>;

        if (!Array.isArray(uploads) || uploads.length === 0) {
          return res.status(400).json({ error: "No uploads provided" });
        }

        const records: UploadRecord[] = uploads.map((u) => ({
          user_phone: userPhone || null,
          serial_number: u.serialNumber || "",
          latitude: Number(u.latitude) || 0,
          longitude: Number(u.longitude) || 0,
          altitude: Number(u.altitude) || 0,
          address: u.address || "",
          location_name: u.locationName || "",
          plus_code: u.plusCode || "",
          file_path: u.filePath || "",
          file_size_kb: Number(u.fileSizeKb) || 0,
          is_guest: isGuest,
        }));

        await recordUploadBatch(records);

        if (userPhone) {
          await upsertProfile(userPhone);
        }

        console.log(`Batch record: ${records.length} uploads for user=${userPhone || "guest"}`);
        return res.status(200).json({ success: true, recorded: records.length });
      } catch (err) {
        console.error("Batch record error:", err);
        return res.status(500).json({ error: "Failed to record uploads" });
      }
    },
  );

  app.post("/api/merge/check-hashes", async (req: Request, res: Response) => {
    try {
      const { hashes } = req.body as { hashes?: string[] };
      if (!Array.isArray(hashes) || hashes.length === 0) {
        return res.status(400).json({ error: "hashes array required" });
      }
      const matches = await checkImageHashes(hashes);
      const map: Record<string, { file_path: string; serial_number: string }> = {};
      for (const m of matches) {
        if (m.hash && !map[m.hash]) {
          map[m.hash] = { file_path: m.file_path, serial_number: m.serial_number };
        }
      }
      return res.json({ results: map });
    } catch (err) {
      console.error("merge/check-hashes error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/merge/claim-guest", async (req: Request, res: Response) => {
    try {
      const { userPhone, serials } = req.body as { userPhone?: string; serials?: string[] };
      if (!userPhone || !Array.isArray(serials) || serials.length === 0) {
        return res.status(400).json({ error: "userPhone and serials required" });
      }
      const claimed = await claimGuestUploads(userPhone, serials);
      await upsertProfile(userPhone);
      console.log(`Merge claim: ${claimed}/${serials.length} records → ${userPhone}`);
      return res.json({ success: true, claimed });
    } catch (err) {
      console.error("merge/claim-guest error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/merge/link-upload", async (req: Request, res: Response) => {
    try {
      const { userPhone, serialNumber, filePath, imageHash, latitude, longitude, altitude, address, locationName, plusCode, fileSizeKb } =
        req.body as {
          userPhone?: string; serialNumber?: string; filePath?: string; imageHash?: string;
          latitude?: number; longitude?: number; altitude?: number; address?: string;
          locationName?: string; plusCode?: string; fileSizeKb?: number;
        };
      if (!userPhone || !serialNumber || !filePath) {
        return res.status(400).json({ error: "userPhone, serialNumber, filePath required" });
      }
      await recordUpload({
        user_phone: userPhone,
        serial_number: serialNumber,
        latitude: Number(latitude) || 0,
        longitude: Number(longitude) || 0,
        altitude: Number(altitude) || 0,
        address: address || "",
        location_name: locationName || "",
        plus_code: plusCode || "",
        file_path: filePath,
        file_size_kb: Number(fileSizeKb) || 0,
        is_guest: false,
        image_hash: imageHash || null,
      });
      await upsertProfile(userPhone);
      return res.json({ success: true });
    } catch (err) {
      console.error("merge/link-upload error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/config/limits", async (_req: Request, res: Response) => {
    const settings = await getAppSettings();
    res.json({
      guestLimit: settings.guest_limit ?? 20,
      standardDailyLimit: settings.standard_daily_limit ?? 50,
      standardMonthlyLimit: settings.standard_monthly_limit ?? 1000,
      imageMaxWidth: settings.image_max_width ?? 1000,
      imageQuality: settings.image_quality ?? 50,
      imageFormat: settings.image_format ?? "auto",
      imageMaxFileMb: settings.image_max_file_mb ?? 5,
    });
  });

  app.get("/admin", (_req: Request, res: Response) => {
    const adminPath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "admin.html",
    );
    if (fs.existsSync(adminPath)) {
      res.sendFile(adminPath);
    } else {
      res.status(404).send("Admin panel not found");
    }
  });

  app.get(
    "/api/admin/stats",
    adminAuth,
    async (_req: Request, res: Response) => {
      if (!supabase)
        return res.json({
          totalUploads: 0,
          totalUsers: 0,
          todayUploads: 0,
          dailyChart: { labels: [], data: [] },
          supabaseConnected: false,
        });

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [
        { count: totalUploads },
        { count: totalUsers },
        { count: todayUploads },
        { data: dailyData },
      ] = await Promise.all([
        supabase.from("uploads").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase
          .from("uploads")
          .select("*", { count: "exact", head: true })
          .gte("created_at", todayStart.toISOString()),
        supabase
          .from("uploads")
          .select("created_at")
          .gte(
            "created_at",
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          )
          .order("created_at"),
      ]);

      const dailyCounts: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dailyCounts[d.toISOString().split("T")[0]] = 0;
      }
      (dailyData || []).forEach((row) => {
        const key = row.created_at.split("T")[0];
        if (dailyCounts[key] !== undefined) dailyCounts[key]++;
      });

      res.json({
        totalUploads: totalUploads || 0,
        totalUsers: totalUsers || 0,
        todayUploads: todayUploads || 0,
        dailyChart: {
          labels: Object.keys(dailyCounts).map((d) => {
            const dt = new Date(d);
            return dt.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
          }),
          data: Object.values(dailyCounts),
        },
        supabaseConnected: true,
      });
    },
  );

  app.get(
    "/api/admin/uploads",
    adminAuth,
    async (req: Request, res: Response) => {
      if (!supabase) return res.json({ data: [], total: 0, page: 1, limit: 20 });
      const page = Math.max(1, parseInt((req.query.page as string) || "1"));
      const limit = Math.min(
        100,
        parseInt((req.query.limit as string) || "20"),
      );
      const offset = (page - 1) * limit;

      const filter = (req.query.filter as string) || "all";
      const search = ((req.query.search as string) || "").trim();
      const geo = ((req.query.geo as string) || "").trim();
      const sort = (req.query.sort as string) || "date_desc";

      let query = supabase
        .from("uploads")
        .select("*", { count: "exact" })
        .range(offset, offset + limit - 1);

      if (sort === "date_asc") query = query.order("created_at", { ascending: true });
      else if (sort === "area_asc") query = query.order("location_name", { ascending: true }).order("created_at", { ascending: false });
      else if (sort === "area_desc") query = query.order("location_name", { ascending: false }).order("created_at", { ascending: false });
      else query = query.order("created_at", { ascending: false });

      if (filter === "flagged") query = query.eq("flagged", true);
      if (filter === "clean") query = query.eq("flagged", false);
      if (search) query = query.ilike("serial_number", `%${search}%`);
      if (geo) query = query.or(`address.ilike.%${geo}%,location_name.ilike.%${geo}%,plus_code.ilike.%${geo}%`);

      const { data: uploads, count } = await query;

      const phones = [...new Set((uploads || []).filter(u => u.user_phone).map(u => u.user_phone))];
      let profileMap: Record<string, { warned: boolean; banned: boolean; ban_reason?: string; warn_message?: string; tier?: string }> = {};
      if (phones.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("phone,tier,warned,banned,ban_reason,warn_message").in("phone", phones);
        (profiles || []).forEach(p => { profileMap[p.phone] = p; });
      }

      const data = (uploads || []).map(u => ({
        ...u,
        user_profile: u.user_phone ? (profileMap[u.user_phone] || null) : null,
      }));

      const { count: flaggedCount } = await supabase.from("uploads").select("*", { count: "exact", head: true }).eq("flagged", true);
      const { count: bannedCount } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("banned", true);

      res.json({ data, total: count || 0, page, limit, flaggedCount: flaggedCount || 0, bannedCount: bannedCount || 0 });
    },
  );

  app.get(
    "/api/admin/users",
    adminAuth,
    async (_req: Request, res: Response) => {
      if (!supabase) return res.json({ data: [] });
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      res.json({ data: data || [] });
    },
  );

  app.post(
    "/api/admin/users/:phone/tier",
    adminAuth,
    async (req: Request, res: Response) => {
      if (!supabase) return res.json({ error: "Supabase not configured" });
      const phone = req.params["phone"] as string;
      const { tier } = req.body;
      if (!["standard", "pro"].includes(tier)) {
        return res.status(400).json({ error: "Invalid tier" });
      }
      const { error } = await supabase
        .from("profiles")
        .update({ tier, updated_at: new Date().toISOString() })
        .eq("phone", decodeURIComponent(phone));
      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true });
    },
  );

  app.get(
    "/api/admin/image/:filename",
    adminAuth,
    async (req: Request, res: Response) => {
      const filename = path.basename(req.params["filename"] as string);
      const filePath = path.join(uploadsDir, filename);
      if (!fs.existsSync(filePath)) return res.status(404).send("Not found");

      const isThumb = req.query["thumb"] === "1";
      if (!isThumb) {
        return res.sendFile(filePath);
      }

      const thumbsDir = path.join(uploadsDir, "thumbs");
      if (!fs.existsSync(thumbsDir)) fs.mkdirSync(thumbsDir, { recursive: true });
      const thumbPath = path.join(thumbsDir, filename.replace(/\.[^.]+$/, ".jpg"));

      try {
        if (!fs.existsSync(thumbPath)) {
          const sharp = (await import("sharp")).default;
          await sharp(filePath)
            .resize(280, 200, { fit: "cover", position: "centre" })
            .jpeg({ quality: 42, progressive: true })
            .toFile(thumbPath);
        }
        if (!fs.existsSync(thumbPath)) return res.sendFile(filePath);
        res.setHeader("Cache-Control", "public, max-age=86400");
        return res.sendFile(thumbPath, (err) => {
          if (err && !res.headersSent) res.sendFile(filePath);
        });
      } catch {
        if (!res.headersSent) return res.sendFile(filePath);
      }
    },
  );

  app.post(
    "/api/admin/uploads/:serial/flag",
    adminAuth,
    async (req: Request, res: Response) => {
      const serial = req.params["serial"] as string;
      const { flagged, reason } = req.body;
      const ok = await flagUpload(serial, !!flagged, reason);
      ok ? res.json({ success: true }) : res.status(500).json({ error: "Failed to flag upload" });
    },
  );

  app.delete(
    "/api/admin/uploads/:serial",
    adminAuth,
    async (req: Request, res: Response) => {
      if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
      const serial = req.params["serial"] as string;
      const { data } = await supabase.from("uploads").select("file_path").eq("serial_number", serial).single();
      if (data?.file_path) {
        const fullPath = path.join(uploadsDir, path.basename(data.file_path));
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      }
      const { error } = await supabase.from("uploads").delete().eq("serial_number", serial);
      error ? res.status(500).json({ error: error.message }) : res.json({ success: true });
    },
  );

  app.post(
    "/api/admin/users/:phone/warn",
    adminAuth,
    async (req: Request, res: Response) => {
      const phone = req.params["phone"] as string;
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: "Warning message required" });
      const ok = await warnUser(decodeURIComponent(phone), message);
      ok ? res.json({ success: true }) : res.status(500).json({ error: "Failed to warn user" });
    },
  );

  app.post(
    "/api/admin/users/:phone/ban",
    adminAuth,
    async (req: Request, res: Response) => {
      const phone = req.params["phone"] as string;
      const { reason } = req.body;
      if (!reason) return res.status(400).json({ error: "Ban reason required" });
      const ok = await banUser(decodeURIComponent(phone), reason);
      ok ? res.json({ success: true }) : res.status(500).json({ error: "Failed to ban user" });
    },
  );

  app.post(
    "/api/admin/users/:phone/unban",
    adminAuth,
    async (req: Request, res: Response) => {
      const phone = req.params["phone"] as string;
      const ok = await unbanUser(decodeURIComponent(phone));
      ok ? res.json({ success: true }) : res.status(500).json({ error: "Failed to unban user" });
    },
  );

  app.get(
    "/api/admin/settings",
    adminAuth,
    async (_req: Request, res: Response) => {
      const settings = await getAppSettings();
      res.json(settings);
    },
  );

  app.post(
    "/api/admin/settings",
    adminAuth,
    async (req: Request, res: Response) => {
      await updateAppSettings(req.body);
      res.json({ success: true });
    },
  );

  app.post(
    "/api/admin/cleanup",
    adminAuth,
    async (_req: Request, res: Response) => {
      const deleted = await runAutoCleanup();
      res.json({ success: true, deleted });
    },
  );

  // ── User: request deletion of an uploaded photo ─────────────
  app.post("/api/user/request-delete", async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.body as { serialNumber?: string };
      if (!serialNumber) return res.status(400).json({ error: "serialNumber required" });
      const userPhone = req.headers["x-user-phone"] as string | undefined;
      const ok = await requestUploadDelete(serialNumber, userPhone || null);
      return res.json({ success: ok });
    } catch (err) {
      console.error("request-delete error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  // ── Admin: list pending deletions ───────────────────────────
  app.get("/api/admin/pending-deletions", adminAuth, async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt((req.query.page as string) || "1"));
    const limit = Math.min(50, parseInt((req.query.limit as string) || "15"));
    const result = await getPendingDeletions(page, limit);
    return res.json({ ...result, page, limit });
  });

  // ── Admin: confirm deletion (deletes file + db row) ─────────
  app.post("/api/admin/deletions/confirm", adminAuth, async (req: Request, res: Response) => {
    const { serialNumber } = req.body as { serialNumber?: string };
    if (!serialNumber) return res.status(400).json({ error: "serialNumber required" });
    const ok = await confirmUploadDeletion(serialNumber, uploadsDir);
    return res.json({ success: ok });
  });

  // ── Admin: reject deletion (clears pending flag) ────────────
  app.post("/api/admin/deletions/reject", adminAuth, async (req: Request, res: Response) => {
    const { serialNumber } = req.body as { serialNumber?: string };
    if (!serialNumber) return res.status(400).json({ error: "serialNumber required" });
    const ok = await rejectUploadDeletion(serialNumber);
    return res.json({ success: ok });
  });

  const httpServer = createServer(app);
  return httpServer;
}
