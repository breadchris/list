//
//  DebugView.swift
//  share
//
//  Debug interface for testing share functionality
//

import SwiftUI
import UserNotifications

struct DebugView: View {
    @State private var testResults: [String] = []
    @State private var testURL = "https://www.apple.com"
    @State private var testTitle = "Apple"
    @State private var showingResults = false
    @State private var pendingItems: [(item: ShareItem, fileURL: URL)] = []
    @State private var inboxError: String?
    @State private var notificationStatus: String = "Unknown"
    @State private var testNotificationTitle: String = "Test Notification"
    @State private var testNotificationBody: String = "This is a test notification"

    private let appGroupId = "group.com.breadchris.share"
    
    var body: some View {
        NavigationView {
            List {
                Section("Pending Inbox Items (\(pendingItems.count))") {
                    if let error = inboxError {
                        Text("Error: \(error)")
                            .foregroundColor(.red)
                            .font(.caption)
                    } else if pendingItems.isEmpty {
                        Text("No pending items")
                            .foregroundColor(.secondary)
                    } else {
                        ForEach(pendingItems, id: \.item.id) { entry in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(entry.item.url)
                                    .font(.caption)
                                    .lineLimit(2)
                                if let note = entry.item.note {
                                    Text(note)
                                        .font(.caption2)
                                        .foregroundColor(.blue)
                                }
                                Text(entry.item.createdAt.formatted())
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                            .padding(.vertical, 2)
                        }
                        .onDelete(perform: deleteItems)
                    }

                    Button("Refresh Inbox") {
                        loadPendingItems()
                    }
                }

                Section("System Tests") {
                    Button("Test App Group") {
                        runTest {
                            TestHelpers.testAppGroup()
                        }
                    }
                    
                    Button("Test Keychain") {
                        runTest {
                            TestHelpers.testKeychain()
                        }
                    }
                    
                    Button("Generate Test API Key") {
                        runTest {
                            let key = TestHelpers.generateTestAPIKey()
                            addResult("Generated API key: \(key)")
                            return true
                        }
                    }
                    
                    Button("Inspect Shared Container") {
                        TestHelpers.inspectSharedContainer()
                        addResult("Check console for shared container contents")
                    }
                }
                
                Section("Share Testing") {
                    VStack(alignment: .leading, spacing: 8) {
                        TextField("Test URL", text: $testURL)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                        
                        TextField("Test Title", text: $testTitle)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                        
                        Button("Simulate Shared URL") {
                            TestHelpers.simulateSharedURL(url: testURL, title: testTitle)
                            addResult("Simulated sharing: \(testURL)")
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    
                    Button("Test URL Scheme Handler") {
                        TestHelpers.testURLScheme()
                        addResult("Tested URL scheme handling")
                    }
                    
                    Button("Drain Shared Inbox") {
                        Task {
                            let success = await InboxDrainer.shared.drainInboxAsync()
                            addResult("Drained inbox: \(success ? "success" : "failed")")
                        }
                    }
                }
                
                Section("Notification Testing") {
                    HStack {
                        Text("Status:")
                        Text(notificationStatus)
                            .foregroundColor(notificationStatus == "Authorized" ? .green :
                                           notificationStatus == "Denied" ? .red : .secondary)
                    }

                    Button("Check Permission Status") {
                        checkNotificationStatus()
                    }

                    Button("Request Permission") {
                        requestNotificationPermission()
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        TextField("Notification Title", text: $testNotificationTitle)
                            .textFieldStyle(RoundedBorderTextFieldStyle())

                        TextField("Notification Body", text: $testNotificationBody)
                            .textFieldStyle(RoundedBorderTextFieldStyle())

                        Button("Send Test Notification (3s)") {
                            sendTestNotification(delay: 3)
                        }
                        .buttonStyle(.borderedProminent)

                        Button("Send Immediate Notification") {
                            sendTestNotification(delay: 1)
                        }
                        .buttonStyle(.bordered)
                    }

                    Button("Clear All Notifications") {
                        clearAllNotifications()
                    }
                    .foregroundColor(.orange)
                }

                Section("Cleanup") {
                    Button("Clear All Test Data") {
                        TestHelpers.clearTestData()
                        testResults.removeAll()
                        addResult("Cleared all test data")
                    }
                    .foregroundColor(.red)
                }
                
                if !testResults.isEmpty {
                    Section("Test Results") {
                        ForEach(testResults.indices, id: \.self) { index in
                            Text(testResults[index])
                                .font(.caption)
                                .foregroundColor(testResults[index].contains("✅") ? .green : 
                                               testResults[index].contains("❌") ? .red : .primary)
                        }
                    }
                }
            }
            .navigationTitle("Debug Tools")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Clear Results") {
                        testResults.removeAll()
                    }
                }
            }
            .onAppear {
                loadPendingItems()
            }
        }
    }
    
    private func runTest(_ test: () -> Bool) {
        let success = test()
        addResult(success ? "✅ Test passed" : "❌ Test failed")
    }
    
    private func addResult(_ result: String) {
        testResults.append("\(Date().formatted(.dateTime.hour().minute().second())): \(result)")
    }

    private func loadPendingItems() {
        do {
            let inbox = try SharedInbox(appGroupId: appGroupId)
            let files = try inbox.drain()
            pendingItems = files.compactMap { fileURL in
                guard let item = try? inbox.read(fileURL) else { return nil }
                return (item: item, fileURL: fileURL)
            }.sorted { $0.item.createdAt > $1.item.createdAt }
            inboxError = nil
        } catch {
            inboxError = error.localizedDescription
            pendingItems = []
        }
    }

    private func deleteItems(at offsets: IndexSet) {
        do {
            let inbox = try SharedInbox(appGroupId: appGroupId)
            for index in offsets {
                let entry = pendingItems[index]
                inbox.remove(entry.fileURL)
            }
            loadPendingItems()
        } catch {
            inboxError = error.localizedDescription
        }
    }

    private func checkNotificationStatus() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                switch settings.authorizationStatus {
                case .notDetermined:
                    notificationStatus = "Not Determined"
                    addResult("Notification status: Not determined (permission not yet requested)")
                case .denied:
                    notificationStatus = "Denied"
                    addResult("❌ Notification status: Denied (user declined or disabled in Settings)")
                case .authorized:
                    notificationStatus = "Authorized"
                    addResult("✅ Notification status: Authorized")
                case .provisional:
                    notificationStatus = "Provisional"
                    addResult("Notification status: Provisional (quiet notifications)")
                case .ephemeral:
                    notificationStatus = "Ephemeral"
                    addResult("Notification status: Ephemeral (App Clip)")
                @unknown default:
                    notificationStatus = "Unknown"
                    addResult("Notification status: Unknown")
                }
            }
        }
    }

    private func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            DispatchQueue.main.async {
                if let error = error {
                    addResult("❌ Permission request failed: \(error.localizedDescription)")
                } else if granted {
                    addResult("✅ Notification permission granted")
                    notificationStatus = "Authorized"
                } else {
                    addResult("❌ Notification permission denied")
                    notificationStatus = "Denied"
                }
            }
        }
    }

    private func sendTestNotification(delay: TimeInterval) {
        let content = UNMutableNotificationContent()
        content.title = testNotificationTitle
        content.body = testNotificationBody
        content.sound = .default
        content.badge = 1

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: delay, repeats: false)
        let identifier = "debug-test-\(UUID().uuidString)"
        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)

        UNUserNotificationCenter.current().add(request) { error in
            DispatchQueue.main.async {
                if let error = error {
                    addResult("❌ Failed to schedule notification: \(error.localizedDescription)")
                } else {
                    addResult("✅ Notification scheduled (fires in \(Int(delay))s)")
                }
            }
        }
    }

    private func clearAllNotifications() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
        UIApplication.shared.applicationIconBadgeNumber = 0
        addResult("✅ Cleared all pending and delivered notifications")
    }
}

#Preview {
    DebugView()
}