import * as React from "react";
import { Link, useSearch } from "wouter";
import { useListUsers, useUpdateUserStatus, useDeleteUser, useCreateUser, useListSchools, useListSports, useResetUserPassword, getListUsersQueryKey, getListSchoolsQueryKey } from "@workspace/api-client-react";
import type { UserSummary, School, SportConfig } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, CheckCircle, XCircle, PauseCircle, PlayCircle, Eye, Trash2, Search, UserPlus, Loader2, KeyRound, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Pagination, usePagination } from "@/components/pagination";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  suspended: "bg-gray-100 text-gray-800 border-gray-200",
};

const FITNESS_COLORS: Record<string, string> = {
  fit: "bg-green-100 text-green-700",
  injured: "bg-red-100 text-red-700",
  recovering: "bg-yellow-100 text-yellow-700",
  resting: "bg-blue-100 text-blue-700",
};

const RESET_MATRIX: Record<string, string[]> = {
  superadmin: ["school_admin"],
  school_admin: ["coach", "player"],
};

export default function UsersPage() {
  const { user } = useAuth();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const initialStatus = params.get("status") ?? "";

  const [roleFilter, setRoleFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState(initialStatus);
  const [searchQuery, setSearchQuery] = React.useState("");

  const queryParams = {
    role: roleFilter !== "all" ? roleFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    schoolId: user?.role !== "superadmin" ? (user?.schoolId ?? undefined) : undefined,
  };

  const { data: users, isLoading } = useListUsers(queryParams);
  const qc = useQueryClient();
  const { toast } = useToast();
  const updateStatus = useUpdateUserStatus();
  const deleteUser = useDeleteUser();
  const [resetTarget, setResetTarget] = React.useState<{ id: number; name: string } | null>(null);

  const filtered: UserSummary[] | undefined = users?.filter((u: UserSummary) =>
    !searchQuery || u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { page, setPage, pageCount, total, pageItems } = usePagination<UserSummary>(filtered, 20);
  React.useEffect(() => { setPage(1); }, [searchQuery, roleFilter, statusFilter, setPage]);

  const handleStatus = async (id: number, status: "approved" | "rejected" | "suspended" | "pending") => {
    try {
      await updateStatus.mutateAsync({ data: { status }, id });
      toast({ title: `User ${status}` });
      qc.invalidateQueries({ queryKey: getListUsersQueryKey(queryParams) });
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteUser.mutateAsync({ id });
      toast({ title: "User deleted" });
      qc.invalidateQueries({ queryKey: getListUsersQueryKey(queryParams) });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const canCreate = user?.role === "superadmin" || user?.role === "school_admin" || user?.role === "sub_admin" || user?.role === "coach";
  const canExport = user?.role === "superadmin" || user?.role === "school_admin" || user?.role === "sub_admin" || user?.role === "coach";
  const resettableRoles = RESET_MATRIX[user?.role ?? ""] ?? [];

  const [exporting, setExporting] = React.useState<string | null>(null);
  const handleExport = async (type: "players" | "coaches") => {
    setExporting(type);
    try {
      const res = await fetch(`/api/export/users?type=${type}`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground">Manage players, coaches, and administrators</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canExport && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleExport("players")} disabled={exporting !== null} data-testid="button-export-players">
                {exporting === "players" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Export Players
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("coaches")} disabled={exporting !== null} data-testid="button-export-coaches">
                {exporting === "coaches" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Export Coaches
              </Button>
            </>
          )}
          {canCreate && (
            <CreateUserDialog
              viewerRole={user?.role ?? ""}
              viewerSchoolId={user?.schoolId ?? null}
              onCreated={() => qc.invalidateQueries({ queryKey: getListUsersQueryKey(queryParams) })}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-search-users"
            className="pl-9"
            placeholder="Search by name or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger data-testid="select-role-filter" className="w-36"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="player">Players</SelectItem>
            <SelectItem value="coach">Coaches</SelectItem>
            <SelectItem value="school_admin">School Admin</SelectItem>
            <SelectItem value="sub_admin">Sub Admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger data-testid="select-status-filter" className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : !filtered?.length ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No users found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Sport</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">ID</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Fitness</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((u) => {
                const canReset = resettableRoles.includes(u.role ?? "");
                const idCode = u.playerCode ?? u.coachCode ?? u.admissionNumber ?? "";
                return (
                  <tr key={u.id} data-testid={`row-user-${u.id}`} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">@{u.username}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize">{u.role?.replace("_", " ")}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{u.sport || "—"}</td>
                    <td className="px-4 py-3 hidden lg:table-cell font-mono text-xs text-muted-foreground">{idCode || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full border font-medium ${STATUS_COLORS[u.status ?? "pending"]}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {u.role === "player" && u.fitnessStatus && (
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${FITNESS_COLORS[u.fitnessStatus ?? "fit"]}`}>
                          {u.fitnessStatus}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {u.status === "pending" && (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => handleStatus(u.id, "approved")} data-testid={`button-approve-${u.id}`}>
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleStatus(u.id, "rejected")} data-testid={`button-reject-${u.id}`}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {u.status === "approved" && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-yellow-600" onClick={() => handleStatus(u.id, "suspended")} data-testid={`button-suspend-${u.id}`} title="Suspend user">
                            <PauseCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {u.status === "suspended" && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => handleStatus(u.id, "approved")} data-testid={`button-reactivate-${u.id}`} title="Reactivate user">
                            <PlayCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {canReset && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-blue-600"
                            onClick={() => setResetTarget({ id: u.id, name: u.name })}
                            data-testid={`button-reset-password-${u.id}`}
                            title="Reset password"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                        )}
                        <Link href={`/users/${u.id}`}>
                          <Button size="icon" variant="ghost" className="h-7 w-7" data-testid={`button-view-${u.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {(user?.role === "superadmin" || user?.role === "school_admin") && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" data-testid={`button-delete-${u.id}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>Delete {u.name}? This cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(u.id)} className="bg-destructive">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t px-4">
            <Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />
          </div>
        </div>
      )}

      {resetTarget && (
        <ResetPasswordDialog
          target={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  );
}

function ResetPasswordDialog({ target, onClose }: { target: { id: number; name: string }; onClose: () => void }) {
  const { toast } = useToast();
  const reset = useResetUserPassword();
  const [pwd, setPwd] = React.useState("");
  const [confirm, setConfirm] = React.useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (pwd !== confirm) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    try {
      await reset.mutateAsync({ id: target.id, data: { newPassword: pwd } });
      toast({ title: `Password reset for ${target.name}` });
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      toast({
        title: "Reset failed",
        description: e?.response?.data?.error ?? e?.message ?? "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>Set a new password for {target.name}. They will use it on next sign-in.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3" autoComplete="off">
          <div className="space-y-1">
            <Label htmlFor="rp-new">New password</Label>
            <PasswordInput id="rp-new" data-testid="input-new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="min 6 chars" autoComplete="new-password" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rp-confirm">Confirm password</Label>
            <PasswordInput id="rp-confirm" data-testid="input-confirm-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="re-enter" autoComplete="new-password" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={reset.isPending} data-testid="button-submit-reset">
              {reset.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateUserDialog({ viewerRole, viewerSchoolId: _viewerSchoolId, onCreated }: { viewerRole: string; viewerSchoolId: number | null; onCreated: () => void }) {
  const [open, setOpen] = React.useState(false);
  const { toast } = useToast();
  const createUser = useCreateUser();
  const { data: schools } = useListSchools({ query: { enabled: viewerRole === "superadmin", queryKey: getListSchoolsQueryKey() } });
  const { data: sports } = useListSports();

  const ALLOWED: Record<string, string[]> = {
    superadmin: ["school_admin", "sub_admin", "coach", "player"],
    school_admin: ["sub_admin", "coach", "player"],
    sub_admin: ["coach", "player"],
    coach: ["player"],
  };
  const roleOptions = ALLOWED[viewerRole] ?? [];

  const [role, setRole] = React.useState<string>(roleOptions[0] ?? "player");
  const [schoolId, setSchoolId] = React.useState<string>("");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [whatsappNumber, setWhatsapp] = React.useState("");
  const [sport, setSport] = React.useState("");
  const [designation, setDesignation] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [age, setAge] = React.useState("");
  const [dateOfBirth, setDob] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [className, setClassName] = React.useState("");
  const [section, setSection] = React.useState("");
  const [rollNumber, setRollNumber] = React.useState("");
  const [admissionNumber, setAdmission] = React.useState("");
  const [parentName, setParentName] = React.useState("");
  const [parentPhone, setParentPhone] = React.useState("");
  const [parentWhatsapp, setParentWhatsapp] = React.useState("");
  const [parentEmail, setParentEmail] = React.useState("");
  const [createParentAccount, setCreateParentAccount] = React.useState(false);
  const [parentPortalUsername, setParentPortalUsername] = React.useState("");
  const [parentPortalPassword, setParentPortalPassword] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setRole(roleOptions[0] ?? "player");
      setSchoolId(""); setUsername(""); setPassword(""); setName(""); setEmail(""); setPhone("");
      setWhatsapp(""); setSport(""); setDesignation(""); setAddress(""); setAge(""); setDob("");
      setGender(""); setClassName(""); setSection(""); setRollNumber(""); setAdmission("");
      setParentName(""); setParentPhone(""); setParentWhatsapp(""); setParentEmail("");
      setCreateParentAccount(false); setParentPortalUsername(""); setParentPortalPassword("");
    }
  }, [open]);

  const isPlayer = role === "player";
  const isCoach = role === "coach";
  const isAdmin = role === "school_admin" || role === "sub_admin";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password || !name.trim()) {
      toast({ title: "Username, password, and name are required", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (viewerRole === "superadmin" && !schoolId) {
      toast({ title: "Please pick a school", variant: "destructive" });
      return;
    }
    if ((isPlayer || isCoach) && !sport) {
      toast({ title: "Sport is required for coaches and players", variant: "destructive" });
      return;
    }
    try {
      await createUser.mutateAsync({
        data: {
          role: role as "player" | "coach" | "school_admin" | "sub_admin" | "superadmin",
          username: username.trim(),
          password,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          whatsappNumber: whatsappNumber.trim(),
          sport: sport || "",
          designation: designation.trim(),
          address: address.trim(),
          age: age ? parseInt(age) : undefined,
          dateOfBirth: dateOfBirth || undefined,
          gender: gender || "",
          className: className.trim(),
          section: section.trim(),
          rollNumber: rollNumber.trim(),
          admissionNumber: admissionNumber.trim() || undefined,
          parentName: parentName.trim(),
          parentPhone: parentPhone.trim(),
          parentWhatsapp: parentWhatsapp.trim(),
          parentEmail: parentEmail.trim(),
          createParentAccount,
          parentUsername: parentPortalUsername.trim() || undefined,
          parentPassword: parentPortalPassword || undefined,
          ...(viewerRole === "superadmin" ? { schoolId: parseInt(schoolId) } : {}),
        },
      });
      toast({ title: `${role.replace("_", " ")} created successfully` });
      setOpen(false);
      onCreated();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      toast({
        title: "Failed to create user",
        description: e?.response?.data?.error ?? e?.message ?? "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-user"><UserPlus className="h-4 w-4 mr-2" /> Add User</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
          <DialogDescription>Create a new admin, coach, or player. They will be approved automatically.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3" autoComplete="off">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger data-testid="select-new-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r} value={r}>{r.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {viewerRole === "superadmin" && (
              <div className="space-y-1">
                <Label>School</Label>
                <Select value={schoolId} onValueChange={setSchoolId}>
                  <SelectTrigger data-testid="select-new-school"><SelectValue placeholder="Pick a school" /></SelectTrigger>
                  <SelectContent>
                    {schools?.map((s: School) => <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.code})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="new-name">Full Name <span className="text-destructive">*</span></Label>
            <Input id="new-name" data-testid="input-new-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="new-username">Username <span className="text-destructive">*</span></Label>
              <Input id="new-username" data-testid="input-new-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" autoComplete="off" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-password">Password <span className="text-destructive">*</span></Label>
              <PasswordInput id="new-password" data-testid="input-new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 6 chars" autoComplete="new-password" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="new-email">Email</Label>
              <Input id="new-email" data-testid="input-new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@..." />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-phone">Phone</Label>
              <Input id="new-phone" data-testid="input-new-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="phone" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="new-whatsapp">WhatsApp Number</Label>
              <Input id="new-whatsapp" data-testid="input-new-whatsapp" value={whatsappNumber} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-address">Address</Label>
              <Input id="new-address" data-testid="input-new-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" />
            </div>
          </div>

          {(isPlayer || isCoach) && (
            <div className="space-y-1">
              <Label>Sport <span className="text-destructive">*</span></Label>
              <Select value={sport} onValueChange={setSport}>
                <SelectTrigger data-testid="select-new-sport"><SelectValue placeholder="Pick a sport" /></SelectTrigger>
                <SelectContent>
                  {sports?.map((s: SportConfig) => <SelectItem key={s.id} value={s.sportName}>{s.sportName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {isAdmin && (
            <div className="space-y-1">
              <Label htmlFor="new-designation">Designation</Label>
              <Input id="new-designation" data-testid="input-new-designation" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Principal, Sports Director" />
            </div>
          )}

          {isPlayer && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="new-admission">Admission No.</Label>
                  <Input id="new-admission" data-testid="input-new-admission" value={admissionNumber} onChange={(e) => setAdmission(e.target.value)} placeholder="ADM001" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-class">Class</Label>
                  <Input id="new-class" data-testid="input-new-class" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="e.g. 10" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-section">Section</Label>
                  <Input id="new-section" data-testid="input-new-section" value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. A" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="new-age">Age</Label>
                  <Input id="new-age" data-testid="input-new-age" type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-dob">Date of Birth</Label>
                  <Input id="new-dob" data-testid="input-new-dob" type="date" value={dateOfBirth} onChange={(e) => setDob(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Gender</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger data-testid="select-new-gender"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-parent-name">Parent / Guardian Name</Label>
                  <Input id="new-parent-name" data-testid="input-new-parent-name" value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Parent name" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="new-parent-phone">Parent Phone</Label>
                  <Input id="new-parent-phone" data-testid="input-new-parent-phone" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="Parent phone" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-parent-whatsapp">Parent WhatsApp</Label>
                  <Input id="new-parent-whatsapp" data-testid="input-new-parent-whatsapp" value={parentWhatsapp} onChange={(e) => setParentWhatsapp(e.target.value)} placeholder="Parent WhatsApp" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-parent-email">Parent Email</Label>
                  <Input id="new-parent-email" data-testid="input-new-parent-email" type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} placeholder="Parent email" />
                </div>
              </div>

              <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="create-parent-account"
                    checked={createParentAccount}
                    onChange={(e) => setCreateParentAccount(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <Label htmlFor="create-parent-account" className="cursor-pointer font-medium">
                    Create Parent Portal login account
                  </Label>
                </div>
                {createParentAccount && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="parent-portal-username">Portal Username</Label>
                      <Input
                        id="parent-portal-username"
                        value={parentPortalUsername}
                        onChange={(e) => setParentPortalUsername(e.target.value)}
                        placeholder="parent.username"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="parent-portal-password">Portal Password</Label>
                      <Input
                        id="parent-portal-password"
                        type="password"
                        value={parentPortalPassword}
                        onChange={(e) => setParentPortalPassword(e.target.value)}
                        placeholder="Min 6 characters"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createUser.isPending} data-testid="button-submit-new-user">
              {createUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
