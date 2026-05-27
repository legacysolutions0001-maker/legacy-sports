import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { customFetch } from "@workspace/api-client-react";
import { useListUsers } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, Loader2, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination, usePagination } from "@/components/pagination";
import { cn } from "@/lib/utils";

type Message = {
  id: number;
  senderId: number;
  receiverId: number;
  body: string;
  isRead: boolean;
  createdAt: string;
};

export default function Messages() {
  const { user } = useAuth();
  const { data: usersResp } = useListUsers();
  const users = (usersResp ?? []).filter((u) => u.id !== user?.id);
  const [peerId, setPeerId] = React.useState<number | null>(null);
  const [thread, setThread] = React.useState<Message[]>([]);
  const [convs, setConvs] = React.useState<Message[]>([]);
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [loadingThread, setLoadingThread] = React.useState(false);
  const [userQuery, setUserQuery] = React.useState("");

  const loadConvs = React.useCallback(() => {
    customFetch<Message[]>("/api/messages").then(setConvs).catch(() => setConvs([]));
  }, []);
  React.useEffect(() => { loadConvs(); }, [loadConvs]);

  const loadThread = React.useCallback((pid: number) => {
    setLoadingThread(true);
    customFetch<Message[]>(`/api/messages/${pid}`).then(setThread).catch(() => setThread([])).finally(() => setLoadingThread(false));
  }, []);

  const filteredUsers = React.useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || (u.role ?? "").toLowerCase().includes(q));
  }, [users, userQuery]);

  React.useEffect(() => { if (peerId) loadThread(peerId); }, [peerId, loadThread]);

  const peerIds = React.useMemo(() => {
    const ids = new Set<number>();
    for (const m of convs) ids.add(m.senderId === user?.id ? m.receiverId : m.senderId);
    return Array.from(ids);
  }, [convs, user?.id]);

  const userName = React.useCallback(
    (id: number) => users.find((u) => u.id === id)?.name ?? `User #${id}`,
    [users],
  );

  const peers = React.useMemo(
    () => peerIds.map((id) => ({ id, name: userName(id) })),
    [peerIds, userName],
  );
  const { page: convPage, setPage: setConvPage, pageCount: convPageCount, total: convTotal, pageItems: convPageItems } = usePagination(peers, 10);
  const { page: userPage, setPage: setUserPage, pageCount: userPageCount, total: userTotal, pageItems: userPageItems } = usePagination(filteredUsers, 15);
  React.useEffect(() => { setUserPage(1); }, [userQuery, setUserPage]);

  const send = async () => {
    if (!body.trim() || !peerId) return;
    setSending(true);
    try {
      await customFetch("/api/messages", { method: "POST", body: JSON.stringify({ receiverId: peerId, body: body.trim() }) });
      setBody("");
      loadThread(peerId);
      loadConvs();
    } finally { setSending(false); }
  };

  return (
    <div className="p-6 max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><MessageSquare className="h-6 w-6" /> Messages</h1>
        <p className="text-muted-foreground">Direct messages with your team</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
        <Card className="md:col-span-1 overflow-y-auto">
          <CardContent className="p-2 space-y-1">
            <div className="px-2 py-1 text-xs uppercase text-muted-foreground">Recent</div>
            {peers.length === 0 && <div className="px-2 py-4 text-sm text-muted-foreground">No conversations yet</div>}
            {convPageItems.map(({ id, name }) => (
              <button
                key={id}
                onClick={() => setPeerId(id)}
                className={cn("w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm", peerId === id && "bg-muted font-medium")}
                data-testid={`conv-${id}`}
              >
                {name}
              </button>
            ))}
            {convPageCount > 1 && (
              <Pagination page={convPage} pageCount={convPageCount} total={convTotal} onChange={setConvPage} />
            )}
            <div className="px-2 pt-3 pb-1 text-xs uppercase text-muted-foreground">Start new</div>
            <div className="relative px-1 pb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                data-testid="input-search-users-msg"
                className="pl-8 h-8 text-xs"
                placeholder="Search people..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
              />
            </div>
            {userPageItems.map((u) => (
              <button
                key={u.id}
                onClick={() => setPeerId(u.id)}
                className={cn("w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm flex justify-between", peerId === u.id && "bg-muted font-medium")}
                data-testid={`user-${u.id}`}
              >
                <span>{u.name}</span>
                <span className="text-xs text-muted-foreground capitalize">{u.role?.replace("_", " ")}</span>
              </button>
            ))}
            {userPageCount > 1 && (
              <Pagination page={userPage} pageCount={userPageCount} total={userTotal} onChange={setUserPage} />
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2 flex flex-col">
          {peerId ? (
            <>
              <div className="px-4 py-3 border-b font-semibold">{userName(peerId)}</div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {loadingThread && thread.length === 0 && (
                  <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-2/3" />)}</div>
                )}
                {!loadingThread && thread.length === 0 && <div className="text-center text-muted-foreground text-sm py-8">No messages yet — say hi!</div>}
                {thread.map((m) => (
                  <div
                    key={m.id}
                    className={cn("max-w-[70%] px-3 py-2 rounded-lg text-sm",
                      m.senderId === user?.id ? "ml-auto bg-primary text-primary-foreground" : "bg-muted")}
                    data-testid={`msg-${m.id}`}
                  >
                    {m.body}
                    <div className="text-[10px] opacity-70 mt-1">{new Date(m.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t flex gap-2">
                <Input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
                  placeholder="Type a message…"
                  data-testid="input-message-body"
                />
                <Button onClick={send} disabled={sending || !body.trim()} data-testid="button-send-message">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Pick someone to chat with</div>
          )}
        </Card>
      </div>
    </div>
  );
}
