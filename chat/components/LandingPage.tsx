"use client";

import { useState } from "react";
import { AuthModal } from "./AuthModal";

export function LandingPage() {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black">
      <h1 className="animate-fade-in text-white text-4xl font-light tracking-wide">
        just share
      </h1>
      <button
        onClick={() => setShowAuth(true)}
        className="mt-8 text-neutral-500 hover:text-white transition-colors duration-300 text-lg font-light"
      >
        enter
      </button>
      <AuthModal open={showAuth} onOpenChange={setShowAuth} />
    </div>
  );
}
