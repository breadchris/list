//
//  NetworkMonitor.swift
//  share
//
//  Monitors network connectivity using NWPathMonitor
//  Publishes connection status and notifies on reconnection
//

import Foundation
import Network
import Combine

final class NetworkMonitor: ObservableObject {
    static let shared = NetworkMonitor()

    /// Current connection status
    @Published private(set) var isConnected: Bool = true

    /// Whether the device is on WiFi
    @Published private(set) var isWiFi: Bool = false

    /// Whether the device is on cellular
    @Published private(set) var isCellular: Bool = false

    /// Notification posted when device reconnects after being offline
    static let didReconnectNotification = Notification.Name("NetworkMonitorDidReconnect")

    private let monitor: NWPathMonitor
    private let queue = DispatchQueue(label: "com.breadchris.share.networkmonitor")
    private var wasConnected: Bool = true

    private init() {
        monitor = NWPathMonitor()

        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.handlePathUpdate(path)
            }
        }

        monitor.start(queue: queue)
        print("📡 NetworkMonitor: Started monitoring network status")
    }

    deinit {
        monitor.cancel()
    }

    private func handlePathUpdate(_ path: NWPath) {
        let previouslyConnected = isConnected
        isConnected = path.status == .satisfied
        isWiFi = path.usesInterfaceType(.wifi)
        isCellular = path.usesInterfaceType(.cellular)

        let statusEmoji = isConnected ? "🟢" : "🔴"
        let connectionType = isWiFi ? "WiFi" : (isCellular ? "Cellular" : "Other")
        print("\(statusEmoji) NetworkMonitor: \(isConnected ? "Connected" : "Disconnected") (\(connectionType))")

        // Notify if we just reconnected
        if !previouslyConnected && isConnected {
            print("📡 NetworkMonitor: Reconnected! Posting notification...")
            NotificationCenter.default.post(name: Self.didReconnectNotification, object: nil)
        }

        wasConnected = isConnected
    }

    /// Manually check if we're currently connected
    func checkConnection() -> Bool {
        return isConnected
    }
}
