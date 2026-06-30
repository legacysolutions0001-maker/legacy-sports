import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET ?? "fallback-dev-secret-change-in-prod";

export interface AuthPayload {
  userId: number;
  role: string;
  schoolId: number | null;
  name: string;
  isOwner: boolean;
  username: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  return (jwt as any).sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return (jwt as any).verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.ls_token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }
  req.auth = payload;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.ls_token || req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({ error: "Invalid or expired session" });
      return;
    }
    req.auth = payload;
    if (!roles.includes(payload.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

export function requireSchoolAccess(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.ls_token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }
  req.auth = payload;
  if (payload.role === "superadmin") {
    next();
    return;
  }
  if (!payload.schoolId) {
    res.status(403).json({ error: "No school context" });
    return;
  }
  next();
}
