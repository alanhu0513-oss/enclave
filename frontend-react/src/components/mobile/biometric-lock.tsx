import { useState, useEffect } from "react";
import { Shield, Fingerprint, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "motion/react";
import { isNative } from "@/lib/platform";

interface BiometricLockProps {
  onUnlock: () => void;
}

export function BiometricLock({ onUnlock }: BiometricLockProps) {
  const [isLocked, setIsLocked] = useState(true);
  const [method, setMethod] = useState<"fingerprint" | "face" | "none">("none");

  useEffect(() => {
    if (isNative()) {
      setMethod("fingerprint"); // Default to fingerprint on native
    }
  }, []);

  const handleUnlock = async () => {
    // In production, use Capacitor Biometrics plugin
    setIsLocked(false);
    onUnlock();
  };

  if (!isLocked) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-[#0a0e17] flex items-center justify-center"
    >
      <Card className="w-80 bg-white/5 border-white/10">
        <CardContent className="p-8 text-center space-y-6">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-20 h-20 mx-auto rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              {method === "fingerprint" ? (
                <Fingerprint className="w-10 h-10 text-cyan-400" />
              ) : method === "face" ? (
                <Shield className="w-10 h-10 text-cyan-400" />
              ) : (
                <Lock className="w-10 h-10 text-cyan-400" />
              )}
            </div>
          </motion.div>

          <div>
            <h2 className="text-xl font-semibold text-white">Enclave Locked</h2>
            <p className="text-sm text-white/60 mt-1">
              {method === "fingerprint"
                ? "Touch sensor to unlock"
                : method === "face"
                  ? "Look at camera to unlock"
                  : "Tap to unlock"}
            </p>
          </div>

          <Button
            onClick={handleUnlock}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-semibold"
          >
            <Unlock className="w-4 h-4 mr-2" />
            Unlock
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
