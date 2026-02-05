//
//  NotesIndicatorBadge.swift
//  share
//
//  Badge showing note count overlay for images
//

import SwiftUI

struct NotesIndicatorBadge: View {
    let count: Int

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "note.text")
                .font(.caption2)
            Text("\(count)")
                .font(.caption2)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(.ultraThinMaterial)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.white.opacity(0.3), lineWidth: 0.5)
        )
        .shadow(color: .black.opacity(0.2), radius: 2, x: 0, y: 1)
        .padding(6)
    }
}

#Preview {
    ZStack {
        Color.gray
        NotesIndicatorBadge(count: 3)
    }
}
