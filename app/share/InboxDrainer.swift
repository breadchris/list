//
//  InboxDrainer.swift
//  share
//
//  Drains shared URL inbox to Supabase content table
//

import Foundation
import BackgroundTasks

class InboxDrainer {
    static let shared = InboxDrainer()
    private let appGroupId = "group.com.breadchris.share"
    private let backgroundTaskId = "com.breadchris.list.drain"

    private init() {}

    func registerBackgroundTask() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: backgroundTaskId, using: nil) { [weak self] task in
            self?.drainInbox { success in
                task.setTaskCompleted(success: success)
                self?.scheduleNextDrain()
            }
        }
        print("📋 InboxDrainer: Background task registered")
    }

    func scheduleNextDrain() {
        let request = BGAppRefreshTaskRequest(identifier: backgroundTaskId)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)

        do {
            try BGTaskScheduler.shared.submit(request)
            print("⏰ InboxDrainer: Next drain scheduled")
        } catch {
            print("❌ InboxDrainer: Failed to schedule drain: \(error)")
        }
    }

    func drainInbox(completion: @escaping (Bool) -> Void) {
        print("🚀 InboxDrainer: Starting inbox drain...")

        DispatchQueue.global(qos: .utility).async { [weak self] in
            guard let self = self else {
                print("❌ InboxDrainer: Self was deallocated")
                completion(false)
                return
            }

            do {
                let inbox = try SharedInbox(appGroupId: self.appGroupId)
                print("✅ InboxDrainer: Successfully opened inbox at App Group: \(self.appGroupId)")

                let files = try inbox.drain()
                print("📊 InboxDrainer: Found \(files.count) files in inbox")

                guard !files.isEmpty else {
                    print("📭 InboxDrainer: Inbox is empty, nothing to process")
                    completion(true)
                    return
                }

                print("📥 InboxDrainer: Processing \(files.count) items...")
                for file in files {
                    print("📄 InboxDrainer: File: \(file.lastPathComponent)")
                }

                guard let tokenStore = self.getTokenStore() else {
                    print("❌ InboxDrainer: Failed to create token store")
                    completion(false)
                    return
                }

                print("🔍 InboxDrainer: Attempting to read access token from Keychain...")
                guard let accessToken = try? tokenStore.read() else {
                    print("⚠️ InboxDrainer: No access token available in Keychain")
                    print("💡 InboxDrainer: User needs to authenticate in the app first")
                    completion(false)
                    return
                }
                print("✅ InboxDrainer: Access token retrieved from Keychain")

                print("🔍 InboxDrainer: Looking for user_id in shared container...")
                guard let userId = self.getUserId() else {
                    print("⚠️ InboxDrainer: No user ID available in shared UserDefaults")
                    print("💡 InboxDrainer: User needs to authenticate in the app first")
                    completion(false)
                    return
                }
                print("✅ InboxDrainer: User ID found: \(userId)")

                print("🔍 InboxDrainer: Looking for default group_id...")
                guard let groupId = self.getDefaultGroupId(userId: userId, accessToken: accessToken) else {
                    print("⚠️ InboxDrainer: No default group available")
                    print("💡 InboxDrainer: User may need to create or join a group first")
                    completion(false)
                    return
                }
                print("✅ InboxDrainer: Default group ID found: \(groupId)")

                var allSucceeded = true
                var processedCount = 0
                var failedCount = 0

                for fileURL in files {
                    do {
                        let item = try inbox.read(fileURL)
                        print("📤 InboxDrainer: Sending item \(item.id) to Supabase (URL: \(item.url))")

                        let success = self.sendToSupabase(
                            item: item,
                            userId: userId,
                            groupId: groupId,
                            accessToken: accessToken
                        )

                        if success {
                            inbox.remove(fileURL)
                            processedCount += 1
                            print("✅ InboxDrainer: Successfully processed and removed item \(item.id)")
                        } else {
                            allSucceeded = false
                            failedCount += 1
                            print("⚠️ InboxDrainer: Failed to process item \(item.id), will retry later")
                        }
                    } catch {
                        print("❌ InboxDrainer: Error processing file \(fileURL.lastPathComponent): \(error)")
                        allSucceeded = false
                        failedCount += 1
                    }
                }

                print("📊 InboxDrainer: Drain complete - Processed: \(processedCount), Failed: \(failedCount)")
                completion(allSucceeded)
            } catch {
                print("❌ InboxDrainer: Failed to drain inbox: \(error)")
                completion(false)
            }
        }
    }

    private func getTokenStore() -> KeychainTokenStore? {
        return KeychainTokenStore(
            service: "com.breadchris.list",
            account: "supabase_access_token",
            accessGroup: "group.com.breadchris.share"
        )
    }

    private func getUserId() -> String? {
        guard let sharedContainer = UserDefaults(suiteName: appGroupId) else {
            return nil
        }
        return sharedContainer.string(forKey: "user_id")
    }

    private func getDefaultGroupId(userId: String, accessToken: String) -> String? {
        guard let sharedContainer = UserDefaults(suiteName: appGroupId) else {
            return nil
        }

        if let cachedGroupId = sharedContainer.string(forKey: "default_group_id") {
            return cachedGroupId
        }

        let supabaseUrl = "https://zazsrepfnamdmibcyenx.supabase.co"
        guard let url = URL(string: "\(supabaseUrl)/rest/v1/group_memberships?user_id=eq.\(userId)&select=group_id&limit=1") else {
            return nil
        }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let semaphore = DispatchSemaphore(value: 0)
        var groupId: String?

        URLSession.shared.dataTask(with: request) { data, response, error in
            defer { semaphore.signal() }

            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]],
                  let firstGroup = json.first,
                  let id = firstGroup["group_id"] as? String else {
                return
            }

            groupId = id
            sharedContainer.set(id, forKey: "default_group_id")
            sharedContainer.synchronize()
        }.resume()

        _ = semaphore.wait(timeout: .now() + 10)
        return groupId
    }

    private func sendToSupabase(item: ShareItem, userId: String, groupId: String, accessToken: String) -> Bool {
        let supabaseUrl = "https://zazsrepfnamdmibcyenx.supabase.co"
        guard let url = URL(string: "\(supabaseUrl)/rest/v1/content") else {
            print("❌ InboxDrainer: Failed to construct Supabase URL")
            return false
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")

        let metadata: [String: Any] = [
            "url": item.url,
            "shared_from": "ios_share_extension"
        ]

        let body: [String: Any] = [
            "type": "text",
            "data": item.url,
            "metadata": metadata,
            "user_id": userId,
            "group_id": groupId
        ]

        guard let jsonData = try? JSONSerialization.data(withJSONObject: body) else {
            print("❌ InboxDrainer: Failed to serialize JSON body")
            return false
        }

        if let bodyString = String(data: jsonData, encoding: .utf8) {
            print("📤 InboxDrainer: Sending POST to \(url)")
            print("📦 InboxDrainer: Request body: \(bodyString)")
        }

        request.httpBody = jsonData

        let semaphore = DispatchSemaphore(value: 0)
        var success = false

        URLSession.shared.dataTask(with: request) { data, response, error in
            defer { semaphore.signal() }

            if let httpResponse = response as? HTTPURLResponse {
                success = (200..<300).contains(httpResponse.statusCode)
                print("📡 InboxDrainer: Supabase HTTP \(httpResponse.statusCode) - \(success ? "SUCCESS" : "FAILED")")

                if !success, let data = data, let responseBody = String(data: data, encoding: .utf8) {
                    print("📄 InboxDrainer: Error response body: \(responseBody)")
                }
            } else if let error = error {
                print("❌ InboxDrainer: Network error: \(error.localizedDescription)")
            }
        }.resume()

        _ = semaphore.wait(timeout: .now() + 10)
        return success
    }
}
