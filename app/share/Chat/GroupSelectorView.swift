//
//  GroupSelectorView.swift
//  share
//
//  Modal view for selecting a chat group
//

import SwiftUI
import AuthenticationServices

struct GroupSelectorView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var groups: [GroupInfo] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var isAuthenticating = false
    @State private var needsSignIn = false

    private let presentationContextProvider = ASWebAuthenticationPresentationContextProvider()

    let onGroupSelected: (GroupInfo) -> Void

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading groups...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if needsSignIn {
                    VStack(spacing: 20) {
                        Image(systemName: "person.circle")
                            .font(.system(size: 60))
                            .foregroundColor(.secondary)
                        Text("Sign In Required")
                            .font(.headline)
                        Text("Sign in to see your groups and start chatting")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)

                        if isAuthenticating {
                            ProgressView("Signing in...")
                                .padding(.top, 8)
                        } else {
                            Button {
                                Task { await signInWithGoogle() }
                            } label: {
                                HStack {
                                    Image(systemName: "g.circle.fill")
                                    Text("Sign in with Google")
                                }
                                .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.borderedProminent)
                            .padding(.top, 8)
                        }
                    }
                    .padding()
                } else if let error = errorMessage {
                    VStack(spacing: 16) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.largeTitle)
                            .foregroundColor(.orange)
                        Text(error)
                            .multilineTextAlignment(.center)
                            .foregroundColor(.secondary)
                        Button("Try Again") {
                            Task { await loadGroups() }
                        }
                        .buttonStyle(.bordered)
                    }
                    .padding()
                } else if groups.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "person.3")
                            .font(.largeTitle)
                            .foregroundColor(.secondary)
                        Text("No groups found")
                            .font(.headline)
                        Text("Join a group to start chatting")
                            .foregroundColor(.secondary)
                    }
                    .padding()
                } else {
                    List(groups) { group in
                        Button {
                            onGroupSelected(group)
                            dismiss()
                        } label: {
                            HStack {
                                Text(group.name ?? "Unnamed Group")
                                    .font(.headline)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .foregroundColor(.secondary)
                            }
                        }
                        .foregroundColor(.primary)
                    }
                }
            }
            .navigationTitle("Select Group")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
        .task {
            await loadGroups()
        }
    }

    private func loadGroups() async {
        isLoading = true
        errorMessage = nil
        needsSignIn = false

        do {
            // Check if authenticated first
            guard await SupabaseManager.shared.isAuthenticated else {
                needsSignIn = true
                isLoading = false
                return
            }

            groups = try await SupabaseManager.shared.getUserGroups()
            isLoading = false
        } catch {
            print("❌ GroupSelectorView: Failed to load groups: \(error)")
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    private func signInWithGoogle() async {
        isAuthenticating = true

        do {
            try await SupabaseManager.shared.client.auth.signInWithOAuth(
                provider: .google
            ) { (session: ASWebAuthenticationSession) in
                session.presentationContextProvider = self.presentationContextProvider
                session.prefersEphemeralWebBrowserSession = false
            }

            print("✅ GroupSelectorView: OAuth completed successfully")

            // Reload groups after successful authentication
            await loadGroups()
        } catch {
            print("❌ GroupSelectorView: OAuth failed: \(error)")

            // Check if user just cancelled
            if let authError = error as? ASWebAuthenticationSessionError,
               authError.code == .canceledLogin {
                print("👤 GroupSelectorView: User canceled login")
            } else {
                errorMessage = "Sign in failed: \(error.localizedDescription)"
                needsSignIn = false
            }
        }

        isAuthenticating = false
    }
}

#Preview {
    GroupSelectorView { group in
        print("Selected group: \(group.id)")
    }
}
