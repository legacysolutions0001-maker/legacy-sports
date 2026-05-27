import * as React from "react";
import { useListNotifications, useSendNotification, useMarkNotificationRead, useListUsers, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const sendSchema = z.object({
  receiverId: z.string().min(1, "Recipient required"),
  message: z.string().min(1, "Message required"),
});

export default function Notifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);

  const { data: notifications, isLoading } = useListNotifications();
  const { data: users } = useListUsers({ schoolId: user?.schoolId ?? undefined });
  const sendMutation = useSendNotification();
  const readMutation = useMarkNotificationRead();

  const form = useForm<z.infer<typeof sendSchema>>({
    resolver: zodResolver(sendSchema),
    defaultValues: { receiverId: "", message: "" },
  });

  const onSend = async (v: z.infer<typeof sendSchema>) => {
    const receiver = users?.find((u) => u.id === parseInt(v.receiverId));
    try {
      await sendMutation.mutateAsync({
        data: { receiverId: parseInt(v.receiverId), receiverRole: receiver?.role ?? "player", message: v.message },
      });
      toast({ title: "Notification sent" });
      qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      setOpen(false);
      form.reset();
    } catch {
      toast({ title: "Failed to send", variant: "destructive" });
    }
  };

  const handleRead = async (id: number) => {
    await readMutation.mutateAsync({ id });
    qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
  };

  const unread = notifications?.filter((n) => !n.isRead).length ?? 0;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Notifications
            {unread > 0 && <Badge variant="destructive" className="text-xs">{unread} new</Badge>}
          </h1>
          <p className="text-muted-foreground">Your message inbox</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-compose"><Send className="h-4 w-4 mr-2" />Send Message</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Send Notification</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSend)} className="space-y-3">
                <FormField control={form.control} name="receiverId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Send To</FormLabel>
                    <Select onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-receiver"><SelectValue placeholder="Select recipient..." /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users?.filter((u) => u.id !== user?.id).map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>{u.name} ({u.role?.replace("_", " ")})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="message" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea data-testid="textarea-message" placeholder="Type your message..." rows={4} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={sendMutation.isPending} data-testid="button-send">
                  Send Notification
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : notifications?.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Bell className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications?.slice().reverse().map((n) => (
            <Card key={n.id} data-testid={`card-notification-${n.id}`} className={!n.isRead ? "border-primary/40 bg-primary/5" : ""}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{n.senderName}</span>
                      {!n.isRead && <span className="inline-block h-2 w-2 rounded-full bg-primary"></span>}
                      <span className="text-xs text-muted-foreground ml-auto">{new Date(n.createdAt!).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm">{n.message}</p>
                  </div>
                  {!n.isRead && (
                    <Button size="sm" variant="ghost" onClick={() => handleRead(n.id)} className="shrink-0 text-xs" data-testid={`button-read-${n.id}`}>
                      Mark read
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
