import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { customFetch } from "@workspace/api-client-react";

export type SchoolSettings = {
  schoolId: number;
  customMessage?: string | null;
  calendarEnabled: boolean;
  messagingEnabled: boolean;
  photosEnabled: boolean;
  feesEnabled: boolean;
  performanceEnabled: boolean;
  analyticsEnabled: boolean;
  leaderboardEnabled: boolean;
  notificationsEnabled: boolean;
  attendanceEnabled: boolean;
  registrationEnabled: boolean;
};

const DEFAULTS: Omit<SchoolSettings, "schoolId"> = {
  customMessage: null,
  calendarEnabled: true, messagingEnabled: true, photosEnabled: true,
  feesEnabled: true, performanceEnabled: true, analyticsEnabled: true,
  leaderboardEnabled: true, notificationsEnabled: true,
  attendanceEnabled: true, registrationEnabled: true,
};

export function useSchoolSettings(): SchoolSettings {
  const { user } = useAuth();
  const [s, setS] = React.useState<SchoolSettings>({ schoolId: 0, ...DEFAULTS });
  React.useEffect(() => {
    if (!user || user.role === "superadmin") return;
    customFetch<SchoolSettings>("/api/school-settings")
      .then((data) => setS({ ...DEFAULTS, ...data }))
      .catch(() => {});
  }, [user?.id, user?.role, user?.schoolId]);
  return s;
}
