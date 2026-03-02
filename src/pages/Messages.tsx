import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  MessageSquare,
  Send,
  Inbox,
  ArrowLeft,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";

interface Message {
  id: string;
  title: string;
  content: string;
  is_read: boolean | null;
  created_at: string;
  sender_id: string | null;
  recipient_id: string | null;
  sender_profile?: {
    full_name: string;
    team_code: string | null;
  };
  recipient_profile?: {
    full_name: string;
    team_code: string | null;
  };
}

const Messages = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState({
    title: "",
    content: "",
  });

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("messages-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      setCurrentUserId(session.user.id);

      // Check if user is admin
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      setIsAdmin(userRole?.role === "admin" || userRole?.role === "owner");

      await fetchMessages();
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from("messages")
      .select(
        `
        *,
        sender_profile:profiles!messages_sender_id_fkey(full_name, team_code),
        recipient_profile:profiles!messages_recipient_id_fkey(full_name, team_code)
      `
      )
      .or(`recipient_id.eq.${session.user.id},sender_id.eq.${session.user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching messages:", error);
      return;
    }

    setMessages((data || []) as Message[]);
  };

  const handleMarkAsRead = async (message: Message) => {
    if (!message.is_read && message.recipient_id === currentUserId) {
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("id", message.id);

      fetchMessages();
    }
    setSelectedMessage(message);
  };

  const handleSendMessage = async () => {
    if (!newMessage.title.trim() || !newMessage.content.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      setSending(true);

      // Find an admin to send to
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "owner"])
        .limit(1);

      const recipientId = adminRoles?.[0]?.user_id;

      if (!recipientId) {
        toast.error("No admin found to send message to");
        return;
      }

      const { error } = await supabase.from("messages").insert({
        title: newMessage.title,
        content: newMessage.content,
        sender_id: currentUserId,
        recipient_id: recipientId,
      });

      if (error) throw error;

      toast.success("Message sent successfully!");
      setNewMessage({ title: "", content: "" });
      fetchMessages();
    } catch (error: any) {
      toast.error(error.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const unreadCount = messages.filter(
    (m) => !m.is_read && m.recipient_id === currentUserId
  ).length;
  const inboxMessages = messages.filter(
    (m) => m.recipient_id === currentUserId
  );

  const getSenderName = (message: Message): string => {
    if (message.sender_id === currentUserId) return "You";
    return message.sender_profile?.full_name || "Unknown";
  };

  /* ── Loading state ── */
  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gradient-primary">
              Messages
            </h1>
            <p className="text-muted-foreground mt-1">
              Communicate with administrators
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2">
              <CardSkeleton />
            </div>
            <div className="lg:col-span-3">
              <CardSkeleton />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gradient-primary">
              Messages
            </h1>
            <p className="text-muted-foreground mt-1">
              Communicate with administrators
            </p>
          </div>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1 shrink-0">
              {unreadCount} Unread
            </Badge>
          )}
        </div>

        {/* ── Split Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ── Inbox List (left panel, or full-width when no message selected on mobile) ── */}
          <div
            className={`lg:col-span-2 ${
              selectedMessage ? "hidden lg:block" : "block"
            }`}
          >
            <div className="glass-card flex flex-col h-full">
              {/* Inbox header */}
              <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Inbox
                </h2>
                <span className="text-xs text-muted-foreground">
                  {inboxMessages.length} message{inboxMessages.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Message list */}
              <div className="flex-1 overflow-y-auto divide-y divide-border/20">
                {inboxMessages.length === 0 ? (
                  <EmptyState
                    icon={Inbox}
                    title="No messages yet"
                    description="Messages from administrators will appear here."
                  />
                ) : (
                  inboxMessages.map((message) => {
                    const isActive = selectedMessage?.id === message.id;
                    const isUnread =
                      !message.is_read && message.recipient_id === currentUserId;

                    return (
                      <button
                        key={message.id}
                        onClick={() => handleMarkAsRead(message)}
                        className={`w-full text-left px-4 py-3.5 transition-colors ${
                          isActive
                            ? "bg-primary/10"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Unread indicator */}
                          <div className="pt-1.5 shrink-0">
                            {isUnread ? (
                              <span className="block h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)]" />
                            ) : (
                              <span className="block h-2.5 w-2.5 rounded-full bg-transparent" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* Sender + timestamp row */}
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <span
                                className={`text-sm truncate ${
                                  isUnread
                                    ? "font-semibold text-foreground"
                                    : "font-medium text-muted-foreground"
                                }`}
                              >
                                {getSenderName(message)}
                              </span>
                              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                                {formatDistanceToNow(new Date(message.created_at), {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>

                            {/* Subject */}
                            <p
                              className={`text-sm truncate ${
                                isUnread ? "font-semibold text-foreground" : "text-foreground"
                              }`}
                            >
                              {message.title}
                            </p>

                            {/* Preview text */}
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {message.content}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* ── Right Panel: Message Detail or Compose ── */}
          <div
            className={`lg:col-span-3 ${
              selectedMessage ? "block" : "hidden lg:block"
            }`}
          >
            <div className="glass-card h-full flex flex-col">
              {selectedMessage ? (
                <>
                  {/* Detail header */}
                  <div className="border-b border-border/40 px-4 py-3">
                    <div className="flex items-center gap-3 mb-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="lg:hidden -ml-1"
                        onClick={() => setSelectedMessage(null)}
                      >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back
                      </Button>
                    </div>
                    <h2 className="text-lg font-bold text-foreground">
                      {selectedMessage.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      From:{" "}
                      <span className="font-medium text-foreground">
                        {getSenderName(selectedMessage)}
                      </span>{" "}
                      &middot;{" "}
                      {formatDistanceToNow(new Date(selectedMessage.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>

                  {/* Message body */}
                  <div className="flex-1 px-4 py-4 overflow-y-auto">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {selectedMessage.content}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Compose header */}
                  <div className="border-b border-border/40 px-4 py-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      New Message to Admin
                    </h2>
                  </div>

                  {/* Compose form */}
                  <div className="flex-1 px-4 py-4 space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="msg-subject" className="text-sm font-medium">
                        Subject
                      </Label>
                      <Input
                        id="msg-subject"
                        value={newMessage.title}
                        onChange={(e) =>
                          setNewMessage({ ...newMessage, title: e.target.value })
                        }
                        placeholder="Enter message subject"
                        className="input-enhanced"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="msg-body" className="text-sm font-medium">
                        Message
                      </Label>
                      <Textarea
                        id="msg-body"
                        value={newMessage.content}
                        onChange={(e) =>
                          setNewMessage({ ...newMessage, content: e.target.value })
                        }
                        placeholder="Type your message here..."
                        rows={10}
                        className="input-enhanced resize-none"
                      />
                    </div>

                    <Button
                      onClick={handleSendMessage}
                      disabled={
                        sending ||
                        !newMessage.title.trim() ||
                        !newMessage.content.trim()
                      }
                      className="w-full sm:w-auto"
                    >
                      {sending ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Sending...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Send className="h-4 w-4" />
                          Send Message
                        </span>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Messages;
