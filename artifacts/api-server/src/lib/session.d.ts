import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    role?: string;
    schoolId?: number | null;
    userName?: string;
    isOwner?: boolean;
    loginAt?: number;
    // Parent portal session fields
    parentPlayerId?: number;
    parentSchoolId?: number;
    parentName?: string;
    isParentDemo?: boolean;
  }
}
