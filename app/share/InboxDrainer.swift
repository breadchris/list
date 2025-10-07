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
        DispatchQueue.global(qos: .utility).async { [weak self] in
            guard let self = self else {
                completion(false)
                return
            }

            do {
                let inbox = try SharedInbox(appGroupId: self.appGroupId)
                let files = try inbox.drain()

                guard !files.isEmpty else {
                    print("📭 InboxDrainer: Inbox is empty")
                    completion(true)
                    return
                }

                print("📥 InboxDrainer: Processing \(files.count) items")

                guard let tokenStore = self.getTokenStore(),
                      let accessToken = try? tokenStore.read() else {
                    print("⚠️ InboxDrainer: No access token available, will retry later")
                    completion(false)
                    return
                }

                guard let userId = self.getUserId() else {
                    print("⚠️ InboxDrainer: No user ID available, will retry later")
                    completion(false)
                    return
                }

                guard let groupId = self.getDefaultGroupId(userId: userId, accessToken: accessToken) else {
                    print("⚠️ InboxDrainer: No default group available, will retry later")
                    completion(false)
                    return
                }

                var allSucceeded = true

                for fileURL in files {
                    do {
                        let item = try inbox.read(fileURL)
                        let success = self.sendToSupabase(
                            item: item,
                            userId: userId,
                            groupId: groupId,
                            accessToken: accessToken
                        )

                        if success {
                            inbox.remove(fileURL)
                            print("✅ InboxDrainer: Processed item \(item.id)")
                        } else {
                            allSucceeded = false
                            print("⚠️ InboxDrainer: Failed to process item \(item.id), will retry")
                        }
                    } catch {
                        print("❌ InboxDrainer: Error processing file \(fileURL): \(error)")
                        allSucceeded = false
                    }
                }

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
            return false
        }

        request.httpBody = jsonData

        let semaphore = DispatchSemaphore(value: 0)
        var success = false

        URLSession.shared.dataTask(with: request) { _, response, error in
            defer { semaphore.signal() }

            if let httpResponse = response as? HTTPURLResponse {
                success = (200..<300).contains(httpResponse.statusCode)
                print("📡 InboxDrainer: Supabase response: \(httpResponse.statusCode)")
            } else if let error = error {
                print("❌ InboxDrainer: Network error: \(error)")
            }
        }.resume()

        _ = semaphore.wait(timeout: .now() + 10)
        return success
    }
}
