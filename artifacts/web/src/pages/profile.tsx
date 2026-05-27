import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import type { SessionUser } from "@workspace/api-client-react";

type ProfileUser = SessionUser & {
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  photoUrl?: string | null;
};
import { useUpdateUser, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { User, Lock, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const profileSchema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const passwordSchema = z.object({
  password: z.string().min(6, "Min 6 characters"),
  confirm: z.string().min(1, "Confirm password"),
}).refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

export default function Profile() {
  const { user } = useAuth();
  const pu = user as ProfileUser | null;
  const qc = useQueryClient();
  const { toast } = useToast();
  const updateMutation = useUpdateUser();

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: pu?.name ?? "", email: pu?.email ?? "", phone: pu?.phone ?? "", address: pu?.address ?? "" },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  React.useEffect(() => {
    if (pu) {
      profileForm.reset({ name: pu.name ?? "", email: pu.email ?? "", phone: pu.phone ?? "", address: pu.address ?? "" });
    }
  }, [pu]);

  const onProfile = async (v: z.infer<typeof profileSchema>) => {
    if (!user) return;
    try {
      await updateMutation.mutateAsync({ data: v, id: user.id });
      toast({ title: "Profile updated" });
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const onPassword = async (v: z.infer<typeof passwordSchema>) => {
    if (!user) return;
    try {
      await updateMutation.mutateAsync({ data: { password: v.password } as any, id: user.id });
      toast({ title: "Password changed" });
      passwordForm.reset();
    } catch {
      toast({ title: "Failed to change password", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            {pu?.photoUrl ? (
              <img src={pu.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" data-testid="profile-photo" />
            ) : (
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xl">
                {user?.name?.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-semibold" data-testid="profile-name">{user?.name}</p>
              <p className="text-sm text-muted-foreground">@{user?.username}</p>
            </div>
            <div className="ml-auto flex gap-2">
              <Badge variant="outline" className="capitalize" data-testid="profile-role">{user?.role?.replace("_", " ")}</Badge>
              {user?.sport && <Badge variant="secondary" data-testid="profile-sport">{user.sport}</Badge>}
              {user?.status && <Badge variant={user.status === "approved" ? "default" : "outline"} data-testid="profile-status">{user.status}</Badge>}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" />Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onProfile)} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={profileForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input data-testid="input-profile-name" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={profileForm.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input data-testid="input-profile-email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={profileForm.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Phone</FormLabel><FormControl><Input data-testid="input-profile-phone" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={profileForm.control} name="address" render={({ field }) => (
                <FormItem><FormLabel>Address</FormLabel><FormControl><Input data-testid="input-profile-address" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-profile">Save Changes</Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" />Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPassword)} className="space-y-3 max-w-sm">
              <FormField control={passwordForm.control} name="password" render={({ field }) => (
                <FormItem><FormLabel>New Password</FormLabel><FormControl><PasswordInput data-testid="input-new-password" placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={passwordForm.control} name="confirm" render={({ field }) => (
                <FormItem><FormLabel>Confirm Password</FormLabel><FormControl><PasswordInput data-testid="input-confirm-password" placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-change-password">Change Password</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
