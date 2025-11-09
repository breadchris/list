import { useState, useEffect, useCallback, useRef } from "react";

/**
 * MapKit Authentication Hook
 *
 * Handles fetching and caching MapKit JS JWT tokens from the Lambda endpoint.
 * Tokens are valid for 1 hour and are automatically refreshed when needed.
 */

interface MapKitAuthState {
  token: string | null;
  expiresAt: number | null;
  isLoading: boolean;
  error: string | null;
}

interface MapKitTokenResponse {
  token: string;
  expires_at: number;
}

const LAMBDA_URL = "https://6jvwlnnks2.execute-api.us-east-1.amazonaws.com";
const TOKEN_ENDPOINT = `${LAMBDA_URL}/mapkit/token`;

// Refresh token 5 minutes before expiration
const REFRESH_BUFFER_SECONDS = 5 * 60;

export function useMapKitAuth() {
  const [authState, setAuthState] = useState<MapKitAuthState>({
    token: null,
    expiresAt: null,
    isLoading: false,
    error: null,
  });

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch a new MapKit token from the Lambda endpoint
   */
  const fetchToken = useCallback(async (): Promise<void> => {
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          origin: window.location.origin,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            `Failed to fetch MapKit token: ${response.status}`,
        );
      }

      const data: MapKitTokenResponse = await response.json();

      setAuthState({
        token: data.token,
        expiresAt: data.expires_at,
        isLoading: false,
        error: null,
      });

      // Schedule automatic refresh before expiration
      const now = Math.floor(Date.now() / 1000);
      const timeUntilRefresh =
        (data.expires_at - now - REFRESH_BUFFER_SECONDS) * 1000;

      if (timeUntilRefresh > 0) {
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current);
        }

        refreshTimerRef.current = setTimeout(() => {
          fetchToken();
        }, timeUntilRefresh);
      }
    } catch (error) {
      console.error("Error fetching MapKit token:", error);
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }));
    }
  }, []);

  /**
   * Check if the current token is expired or about to expire
   */
  const isTokenExpired = useCallback((): boolean => {
    if (!authState.token || !authState.expiresAt) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    return now >= authState.expiresAt - REFRESH_BUFFER_SECONDS;
  }, [authState.token, authState.expiresAt]);

  /**
   * Get a valid token, fetching a new one if needed
   */
  const getToken = useCallback(async (): Promise<string | null> => {
    if (isTokenExpired()) {
      await fetchToken();
    }
    return authState.token;
  }, [isTokenExpired, fetchToken, authState.token]);

  // Fetch token on mount if not already available
  useEffect(() => {
    if (!authState.token && !authState.isLoading && !authState.error) {
      fetchToken();
    }
  }, [authState.token, authState.isLoading, authState.error, fetchToken]);

  // Cleanup refresh timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  return {
    token: authState.token,
    expiresAt: authState.expiresAt,
    isLoading: authState.isLoading,
    error: authState.error,
    isTokenExpired,
    getToken,
    refreshToken: fetchToken,
  };
}
