import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ParentPortal from "@/pages/parent-portal";
import Dashboard from "@/pages/dashboard";
import Schools from "@/pages/schools";
import UsersPage from "@/pages/users";
import UserDetail from "@/pages/user-detail";
import Performances from "@/pages/performances";
import Attendance from "@/pages/attendance";
import Notifications from "@/pages/notifications";
import Sports from "@/pages/sports";
import Analytics from "@/pages/analytics";
import Profile from "@/pages/profile";
import SchoolSettings from "@/pages/school-settings";
import CalendarPage from "@/pages/calendar";
import MessagesPage from "@/pages/messages";
import FeesPage from "@/pages/fees";
import LeaderboardPage from "@/pages/leaderboard";
import PricingPage from "@/pages/pricing";
import SubscriptionPage from "@/pages/subscription";
import RemindersInbox from "@/pages/reminders";
import LettersPage from "@/pages/letters";
import CertificatesPage from "@/pages/certificates";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function Router() {
  return (
    <AuthProvider>
      <AppLayout>
        <Switch>
          <Route path="/" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/parent-portal" component={ParentPortal} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/schools" component={Schools} />
          <Route path="/users/:id" component={UserDetail} />
          <Route path="/users" component={UsersPage} />
          <Route path="/performances" component={Performances} />
          <Route path="/attendance" component={Attendance} />
          <Route path="/notifications" component={Notifications} />
          <Route path="/sports" component={Sports} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/profile" component={Profile} />
          <Route path="/school-settings" component={SchoolSettings} />
          <Route path="/calendar" component={CalendarPage} />
          <Route path="/messages" component={MessagesPage} />
          <Route path="/fees" component={FeesPage} />
          <Route path="/pricing" component={PricingPage} />
          <Route path="/subscription" component={SubscriptionPage} />
          <Route path="/reminders" component={RemindersInbox} />
          <Route path="/letters" component={LettersPage} />
          <Route path="/certificates" component={CertificatesPage} />
          <Route path="/leaderboard" component={LeaderboardPage} />
          <Route component={NotFound} />
        </Switch>
      </AppLayout>
    </AuthProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
