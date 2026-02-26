import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import multer from "multer";
import * as path from "path";
import * as fs from "fs";
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
  UploadRecord,
} from "./supabase";

const uploadsDir = path.resolve(process.cwd(), "server", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ACCEPTED_MIME = new Set(["image/jpeg", "image/jpg", "image/webp"]);

const multerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const serial = (req as Request & { body: { serialNumber?: string } }).body
      ?.serialNumber;
    const ext = file.mimetype === "image/webp" ? "webp" : "jpg";
    const name = serial ? `${serial}.${ext}` : `${Date.now()}-${file.originalname}`;
    cb(null, name);
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

function adminAuth(req: Request, res: Response, next: NextFunction) {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) return next();
  const username = req.headers["x-admin-username"] as string | undefined;
  const password = req.headers["x-admin-password"] as string | undefined;
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {

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
      if (supabase) {
        const { data } = await supabase
          .from("profiles")
          .select("tier")
          .eq("phone", phone)
          .single();
        if (data?.tier) tier = data.tier as "standard" | "pro";
      }

      return res.json({ success: true, phone, tier });
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

      const { serialNumber, latitude, longitude, address, locationName, plusCode, altitude } =
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

      const { data, count } = await supabase
        .from("uploads")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      res.json({ data: data || [], total: count || 0, page, limit });
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
      const { phone } = req.params;
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
