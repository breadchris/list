//
//  UploadStatusOverlay.swift
//  share
//
//  Overlay showing upload status on pending images
//

import SwiftUI

struct UploadStatusOverlay: View {
    let status: PendingMessageStatus

    private var iconName: String {
        switch status {
        case .pending, .sending:
            return "arrow.up.circle"
        case .failed:
            return "exclamationmark.circle"
        case .sent:
            return "checkmark.circle"
        }
    }

    private var showRetryHint: Bool {
        status == .failed
    }

    var body: some View {
        ZStack {
            // Dimmed overlay
            Color.black.opacity(0.4)

            // Status icon with badge background
            VStack(spacing: 4) {
                Image(systemName: iconName)
                    .font(.title)
                    .foregroundColor(.white)

                if showRetryHint {
                    Text("Tap to retry")
                        .font(.caption2)
                        .foregroundColor(.white.opacity(0.8))
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(.ultraThinMaterial)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.white.opacity(0.3), lineWidth: 0.5)
            )
            .shadow(color: .black.opacity(0.2), radius: 2, x: 0, y: 1)
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        ZStack {
            Image(systemName: "photo.fill")
                .resizable()
                .frame(width: 200, height: 150)
                .foregroundColor(.gray)

            UploadStatusOverlay(status: .sending)
                .cornerRadius(8)
        }

        ZStack {
            Image(systemName: "photo.fill")
                .resizable()
                .frame(width: 200, height: 150)
                .foregroundColor(.gray)

            UploadStatusOverlay(status: .failed)
                .cornerRadius(8)
        }
    }
    .padding()
}
