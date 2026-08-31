import { useEffect, useState } from "react";
import { isNative } from "@/lib/platform";
import { Shield } from "lucide-react";

export function NativeHeader() {
  const [isNativePlatform, setIsNativePlatform] = useState(false);

  useEffect(() => {
    setIsNativePlatform(isNative());
  }, []);

  if (!isNativePlatform) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-11 flex items-center justify-center bg-[#0a0e17]/95 backdrop-blur-xl border-b border-white/5 safe-area-top">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-cyan-400" />
        <span className="text-xs font-semibold text-white/90 tracking-wider uppercase">Enclave</span>
      </div>
    </div>
  );
}
