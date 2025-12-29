//
//  MainTabView.swift
//  share
//
//  Root TabView with Chat and List tabs
//

import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0  // Chat is default (index 0)

    var body: some View {
        TabView(selection: $selectedTab) {
            ChatTab()
                .tabItem {
                    Label("Chat", systemImage: "bubble.left.and.bubble.right")
                }
                .tag(0)

            WebViewTab()
                .tabItem {
                    Label("List", systemImage: "list.bullet")
                }
                .tag(1)
        }
    }
}

#Preview {
    MainTabView()
}
