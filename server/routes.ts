import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import multer from "multer";
import * as path from "path";
import * as fs from "fs";

const uploadsDir = path.resolve(process.cwd(), "server", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const serial = (_req as Request & { body: { serialNumber?: string } }).body?.serialNumber;
    const name = serial ? `${serial}.jpg` : `${Date.now()}-${file.originalname}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "image/jpeg" || file.mimetype === "image/jpg") {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG images are allowed"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  app.post(
    "/api/upload",
    upload.single("photo"),
    (req: Request, res: Response) => {
      if (!req.file) {
        return res.status(400).json({ error: "No file received" });
      }

      const { serialNumber, latitude, longitude, address, timestamp } = req.body;

      const record = {
        serialNumber,
        fileName: req.file.filename,
        fileSize: req.file.size,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address,
        timestamp: parseInt(timestamp),
        uploadedAt: Date.now(),
      };

      console.log(`Upload received: ${serialNumber} (${req.file.size} bytes)`);

      return res.status(200).json({
        success: true,
        message: "Photo uploaded successfully",
        record,
      });
    },
  );

  app.get("/api/uploads", (_req: Request, res: Response) => {
    try {
      const files = fs.readdirSync(uploadsDir).filter((f) => f.endsWith(".jpg"));
      res.json({ count: files.length, files });
    } catch {
      res.json({ count: 0, files: [] });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
