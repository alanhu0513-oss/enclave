import { useState, useEffect, useCallback } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "motion/react";

export function OfflineBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => setShowBanner(false);
    const handleOffline = () => setShowBanner(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (!navigator.onLine) setShowBanner(true);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleRetry = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50 bg-amber-500/90 backdrop-blur-sm text-black px-4 py-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <WifiOff className="w-5 h-5" />
            <span className="font-medium text-sm">
              You're offline. Some features may be unavailable.
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRetry}
            className="text-black hover:bg-black/10"
          >
            <RefreshCw className="w-4 h-4 mr-1" /> Retry
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
