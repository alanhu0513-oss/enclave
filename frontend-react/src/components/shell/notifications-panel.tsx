import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { api, type Notification } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function NotificationsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { setUnread, toast } = useApp();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    api
      .getNotifications({ limit: 20 })
      .then(async (data) => {
        if (!active) return;
        const unreadCount =
          typeof (await api.getUnreadCount()) === "number"
            ? await api.getUnreadCount()
            : 0;
        setItems(data);
        setUnread(unreadCount);
      })
      .catch(() => setItems([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open]);

  async function markAll() {
    try {
      await api.markAllNotificationsRead();
      setItems((prev) => prev?.map((n) => ({ ...n, read: true })) ?? []);
      setUnread(0);
      toast({ title: "All notifications read", variant: "success" });
    } catch (e: any) {
      toast({ title: "Error", body: e.message, variant: "error" });
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[60]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong absolute right-4 top-16 z-[70] w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-xl shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Bell className="h-4 w-4 text-cyan" />
                Notifications
              </div>
              <button
                onClick={markAll}
                className="flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-green"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all
              </button>
            </div>
            <div className="max-h-[380px] overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center gap-2 p-8 text-sm text-ink-faint">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              )}
              {!loading && (!items || items.length === 0) && (
                <div className="p-8 text-center text-sm text-ink-faint">
                  You're all caught up.
                </div>
              )}
              {!loading &&
                items?.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "flex gap-3 border-b border-white/[0.05] px-4 py-3 transition-colors hover:bg-white/[0.03] cursor-pointer",
                      !n.read && "bg-green/[0.03]"
                    )}
                    onClick={async () => {
                      if (!n.read) {
                        try {
                          await api.markNotificationRead(n.id);
                          setItems((prev) => prev?.map((x) => x.id === n.id ? { ...x, read: true } as Notification : x) ?? []);
                          const count = await api.getUnreadCount();
                          setUnread(typeof count === 'number' ? count : 0);
                        } catch (_) {}
                      }
                    }}
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        n.read ? "bg-white/15" : "bg-green"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {n.title || "Notification"}
                      </p>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-ink-faint">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
