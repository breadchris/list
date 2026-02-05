//
//  CalendarHeader.swift
//  share
//
//  Navigation header with view mode selector and date navigation
//

import SwiftUI

struct CalendarHeader: View {
    @ObservedObject var viewModel: CalendarViewModel

    var body: some View {
        VStack(spacing: 12) {
            // View mode selector + Today button
            HStack(spacing: 12) {
                // View mode picker
                Picker("View", selection: $viewModel.viewMode) {
                    ForEach(CalendarViewMode.allCases, id: \.self) { mode in
                        Text(mode.shortLabel).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 200)

                Spacer()

                // Today button
                Button {
                    viewModel.goToToday()
                } label: {
                    Text("Today")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.blue)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.blue.opacity(0.1))
                        .cornerRadius(8)
                }
            }
            .padding(.horizontal)

            // Navigation row
            HStack {
                // Previous button
                Button(action: viewModel.goToPrevious) {
                    Image(systemName: "chevron.left")
                        .font(.title3)
                        .foregroundColor(.blue)
                        .frame(width: 44, height: 44)
                }

                Spacer()

                // Period title
                VStack(spacing: 2) {
                    Text(viewModel.periodTitle)
                        .font(.headline)
                        .foregroundColor(.primary)
                }

                Spacer()

                // Next button
                Button(action: viewModel.goToNext) {
                    Image(systemName: "chevron.right")
                        .font(.title3)
                        .foregroundColor(.blue)
                        .frame(width: 44, height: 44)
                }
            }
            .padding(.horizontal, 8)
        }
        .padding(.vertical, 8)
        .background(Color(.systemBackground))
    }
}

// MARK: - View Mode Extensions

extension CalendarViewMode {
    var shortLabel: String {
        switch self {
        case .month: return "M"
        case .week: return "W"
        case .day: return "D"
        }
    }

    var fullLabel: String {
        switch self {
        case .month: return "Month"
        case .week: return "Week"
        case .day: return "Day"
        }
    }
}

// MARK: - Preview

#Preview {
    VStack {
        CalendarHeader(viewModel: CalendarViewModel())
        Spacer()
    }
}
