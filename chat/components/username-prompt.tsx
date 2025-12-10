"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const USERNAME_KEY = "y-sweet-username";

export function UsernamePrompt({ children }: { children: React.ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for existing username
    const stored = localStorage.getItem(USERNAME_KEY);
    if (stored) {
      setUsername(stored);
    }
    setIsLoading(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      const trimmed = inputValue.trim();
      localStorage.setItem(USERNAME_KEY, trimmed);
      setUsername(trimmed);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  if (!username) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-full max-w-sm space-y-4 p-6 border rounded-lg">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Welcome!</h1>
            <p className="text-muted-foreground">
              Enter your name to join the shared chat session
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              placeholder="Your name"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoFocus
              maxLength={30}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={!inputValue.trim()}
            >
              Join Session
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function useUsername(): string | null {
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(USERNAME_KEY);
    if (stored) {
      setUsername(stored);
    }
  }, []);

  return username;
}

export function clearUsername(): void {
  localStorage.removeItem(USERNAME_KEY);
  window.location.reload();
}
