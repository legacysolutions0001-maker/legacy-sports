import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trophy, LayoutDashboard, Users, GraduationCap, ClipboardList, Activity, ActivitySquare, Bell, BarChart3, LogOut, Settings, Calendar as CalIcon, MessageSquare, DollarSign, SlidersHorizontal, Wallet, FileText, Award, Baby, CheckSquare, TrendingUp, CreditCard, Info } from "lucide-react";
import { useSchoolSettings } from "@/hooks/use-school-settings";
import { SiteFooter } from "@/components/site-footer";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, school, logout, logoutAll } = useAuth();
  const [location] = useLocation();
  const ss = useSchoolSettings();
  const isSuper = user?.role === "superadmin";

  if (location.startsWith("/parent-login")) {
    return <>{children}</>;
  }

  if (!user) {
    return (
      <div className="flex min-h-[100dvh] flex-col">
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </div>
    );
  }

  const role = user.role;
  const isSuperadmin = role === "superadmin";
  const isSchoolAdmin = role === "school_admin" || role === "sub_admin";
  const isCoach = role === "coach";
  const isPlayer = role === "player";
  const isParent = role === "parent";
  const isDemoSchool = school?.isDemo === true;

  return (
    <SidebarProvider>
      <div className="flex min-h-[100dvh] w-full">
        <Sidebar className="border-r border-sidebar-border bg-sidebar">
          <SidebarHeader className="h-16 flex items-center px-4 border-b border-sidebar-border">
            <Link href="/dashboard" className="flex items-center gap-2 text-sidebar-primary font-bold text-lg">
              <Trophy className="h-6 w-6" />
              <span>Legacy Sports</span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Menu</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {isParent ? (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={location === "/parent-portal" && !location.includes("?tab=")}>
                          <Link href="/parent-portal">
                            <Baby />
                            <span>My Child</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <Link href="/parent-portal?tab=attendance">
                            <CheckSquare />
                            <span>Attendance</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <Link href="/parent-portal?tab=performances">
                            <TrendingUp />
                            <span>Performances</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <Link href="/parent-portal?tab=fees">
                            <CreditCard />
                            <span>Fees</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <Link href="/parent-portal?tab=schedule">
                            <CalIcon />
                            <span>Schedule</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </>
                  ) : (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/dashboard"}>
                        <Link href="/dashboard">
                          <LayoutDashboard />
                          <span>Dashboard</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {!isParent && isSuperadmin && (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={location.startsWith("/schools")}>
                          <Link href="/schools">
                            <GraduationCap />
                            <span>Schools</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={location.startsWith("/sports")}>
                          <Link href="/sports">
                            <ActivitySquare />
                            <span>Sports Config</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </>
                  )}

                  {!isParent && (isSuperadmin || isSchoolAdmin || isCoach) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.startsWith("/users")}>
                        <Link href="/users">
                          <Users />
                          <span>Users</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {!isParent && (isSuper || ss.performanceEnabled) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.startsWith("/performances")}>
                        <Link href="/performances">
                          <Activity />
                          <span>Performances</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {!isParent && (isSuperadmin || isSchoolAdmin || isCoach || isPlayer) && (isSuper || ss.attendanceEnabled) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.startsWith("/attendance")}>
                        <Link href="/attendance">
                          <ClipboardList />
                          <span>Attendance</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {!isParent && (isSuper || ss.calendarEnabled) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.startsWith("/calendar")}>
                        <Link href="/calendar">
                          <CalIcon />
                          <span>Calendar</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {!isParent && (isSuper || ss.messagingEnabled) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.startsWith("/messages")}>
                        <Link href="/messages">
                          <MessageSquare />
                          <span>Messages</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {!isParent && (isSuper || ss.feesEnabled) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.startsWith("/fees")}>
                        <Link href="/fees">
                          <DollarSign />
                          <span>Player Fees</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {isSuperadmin && (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={location.startsWith("/pricing")}>
                          <Link href="/pricing">
                            <Wallet />
                            <span>Pricing & Billing</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={location.startsWith("/reminders")}>
                          <Link href="/reminders">
                            <Bell />
                            <span>Reminder Inbox</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </>
                  )}

                  {!isParent && isSchoolAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.startsWith("/subscription")}>
                        <Link href="/subscription">
                          <Wallet />
                          <span>Subscription</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {!isParent && (isSuperadmin || isSchoolAdmin || isCoach) && (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={location.startsWith("/letters")}>
                          <Link href="/letters">
                            <FileText />
                            <span>Letters</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={location.startsWith("/certificates")}>
                          <Link href="/certificates">
                            <Award />
                            <span>Certificates</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </>
                  )}

                  {!isParent && (isSuper || ss.leaderboardEnabled) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.startsWith("/leaderboard")}>
                        <Link href="/leaderboard">
                          <Trophy />
                          <span>Leaderboard</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {!isParent && (isSuper || ss.analyticsEnabled) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.startsWith("/analytics")}>
                        <Link href="/analytics">
                          <BarChart3 />
                          <span>Analytics</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {!isParent && (isSuper || ss.notificationsEnabled) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.startsWith("/notifications")}>
                        <Link href="/notifications">
                          <Bell />
                          <span>Notifications</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {!isParent && isSchoolAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.startsWith("/school-settings")}>
                        <Link href="/school-settings">
                          <SlidersHorizontal />
                          <span>School Settings</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-primary/10 text-sidebar-primary font-bold">
                {user.name.charAt(0)}
              </div>
              <div className="flex flex-col flex-1 overflow-hidden">
                <span className="text-sm font-medium truncate text-sidebar-foreground">{user.name}</span>
                <span className="text-xs text-sidebar-foreground/60 capitalize truncate">{role.replace('_', ' ')}</span>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-1 flex-col w-full">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 shadow-sm">
            <SidebarTrigger />
            <div className="flex-1" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm select-none">
                    {user.name.charAt(0)}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground font-normal capitalize">{role.replace('_', ' ')}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                {isSuperadmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => logoutAll()}
                      className="text-orange-600 focus:text-orange-600 focus:bg-orange-50 cursor-pointer"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Logout from all devices</span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logout()}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="flex-1 overflow-auto bg-muted/30">
            {isDemoSchool && (
              <div className="bg-yellow-400 text-yellow-900 px-4 py-2 text-sm font-semibold flex items-center gap-2">
                <Info className="h-4 w-4 flex-shrink-0" />
                <span>Demo Mode — This is a demonstration school. Data may be reset periodically.{school?.demoMessage ? ` ${school.demoMessage}` : ""}</span>
              </div>
            )}
            <div key={location} className="page-fade-in">
              {children}
            </div>
            <SiteFooter />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
