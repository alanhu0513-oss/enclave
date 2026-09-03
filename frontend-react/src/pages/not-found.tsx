import { Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  function handleGoHome() {
    window.location.href = "/";
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#111113] px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green/10 mb-6">
        <Shield className="h-8 w-8 text-green" />
      </div>

      <h1 className="text-6xl font-bold text-white mb-4" style={{ letterSpacing: "-0.03em" }}>
        404
      </h1>

      <h2 className="text-xl font-semibold text-white mb-3">
        Page not found
      </h2>

      <p className="max-w-md text-base text-[#a1a1aa] leading-relaxed mb-8">
        The page you're looking for doesn't exist or has been moved.
        If you followed a link to get here, it may be outdated or broken.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <Button
          onClick={handleGoHome}
          className="bg-green text-black font-semibold px-6"
        >
          Go to Homepage
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          onClick={() => window.history.back()}
          className="border-white/10"
        >
          Go Back
        </Button>
      </div>

      <div className="mt-12 max-w-sm">
        <p className="text-sm text-[#71717a] mb-4">Or try one of these:</p>
        <div className="flex flex-wrap justify-center gap-3 text-sm">
          <a href="/" className="text-green hover:underline">Home</a>
          <span className="text-[#3f3f46]">|</span>
          <a href="/terms" className="text-[#a1a1aa] hover:text-white hover:underline">Terms</a>
          <span className="text-[#3f3f46]">|</span>
          <a href="/privacy" className="text-[#a1a1aa] hover:text-white hover:underline">Privacy</a>
          <span className="text-[#3f3f46]">|</span>
          <a href="/dmca" className="text-[#a1a1aa] hover:text-white hover:underline">DMCA</a>
        </div>
      </div>
    </div>
  );
}
