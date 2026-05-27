import type { Request, Response, NextFunction } from "express";
import { getLogoutAllTimestamp } from "../lib/logoutTokens";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const loginAt = req.session.loginAt ?? 0;
  const loggedOutAllAt = getLogoutAllTimestamp(req.session.userId);
  if (loggedOutAllAt > loginAt) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Session invalidated. Please log in again." });
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const loginAt = req.session.loginAt ?? 0;
    const loggedOutAllAt = getLogoutAllTimestamp(req.session.userId);
    if (loggedOutAllAt > loginAt) {
      req.session.destroy(() => {});
      res.status(401).json({ error: "Session invalidated. Please log in again." });
      return;
    }
    if (!req.session.role || !roles.includes(req.session.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

export function requireSchoolAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (req.session.role === "superadmin") {
    next();
    return;
  }
  if (!req.session.schoolId) {
    res.status(403).json({ error: "No school context" });
    return;
  }
  next();
}
