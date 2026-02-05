"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/components/SupabaseClient";
import { getOrCreateDeviceFingerprint } from "@/lib/device-fingerprint";
import { config } from "@/lib/config";

type RedemptionState =
	| { status: "loading"; message: string }
	| { status: "success"; displayName: string; groupId: string }
	| { status: "error"; message: string };

export default function TokenRedemptionPage() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const [state, setState] = useState<RedemptionState>({
		status: "loading",
		message: "Verifying your access link...",
	});

	useEffect(() => {
		const redeemToken = async () => {
			const token = searchParams.get("t");

			if (!token) {
				setState({
					status: "error",
					message: "Invalid link - no access token found",
				});
				return;
			}

			try {
				// Get device fingerprint
				setState({
					status: "loading",
					message: "Identifying your device...",
				});
				const deviceFingerprint = await getOrCreateDeviceFingerprint();

				// Call Lambda to redeem token
				setState({
					status: "loading",
					message: "Setting up your account...",
				});

				const response = await fetch(`${config.lambdaEndpoint}/content`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						action: "auth-redeem-token",
						payload: {
							token,
							device_fingerprint: deviceFingerprint,
						},
					}),
				});

				const result = await response.json();

				if (!result.success) {
					setState({
						status: "error",
						message: result.error || "Failed to redeem access link",
					});
					return;
				}

				// If we got session tokens, set them in Supabase
				if (result.access_token && result.refresh_token) {
					setState({
						status: "loading",
						message: "Signing you in...",
					});

					const { error: sessionError } = await supabase.auth.setSession({
						access_token: result.access_token,
						refresh_token: result.refresh_token,
					});

					if (sessionError) {
						console.error("Error setting session:", sessionError);
						// Continue anyway - user was created
					}
				}

				// Success!
				setState({
					status: "success",
					displayName: result.user?.display_name || "User",
					groupId: result.group_id,
				});

				// Redirect after a short delay
				setTimeout(() => {
					if (result.group_id) {
						router.push(`/list/group/${result.group_id}`);
					} else {
						router.push("/list");
					}
				}, 2000);
			} catch (error) {
				console.error("Token redemption error:", error);
				setState({
					status: "error",
					message:
						error instanceof Error
							? error.message
							: "An unexpected error occurred",
				});
			}
		};

		redeemToken();
	}, [searchParams, router]);

	return (
		<div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
			<div className="max-w-md w-full">
				{state.status === "loading" && (
					<div className="text-center">
						<div className="mb-6">
							<div className="w-12 h-12 border-4 border-neutral-700 border-t-blue-500 rounded-full animate-spin mx-auto" />
						</div>
						<h1 className="text-xl font-semibold text-white mb-2">
							{state.message}
						</h1>
						<p className="text-neutral-400">Please wait...</p>
					</div>
				)}

				{state.status === "success" && (
					<div className="text-center">
						<div className="mb-6">
							<div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
								<svg
									className="w-6 h-6 text-green-500"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M5 13l4 4L19 7"
									/>
								</svg>
							</div>
						</div>
						<h1 className="text-xl font-semibold text-white mb-2">
							Welcome, {state.displayName}!
						</h1>
						<p className="text-neutral-400">
							Your access has been set up. Redirecting you now...
						</p>
					</div>
				)}

				{state.status === "error" && (
					<div className="text-center">
						<div className="mb-6">
							<div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
								<svg
									className="w-6 h-6 text-red-500"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</div>
						</div>
						<h1 className="text-xl font-semibold text-white mb-2">
							Access Denied
						</h1>
						<p className="text-neutral-400 mb-6">{state.message}</p>
						<button
							onClick={() => router.push("/list")}
							className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
						>
							Go to Home
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
