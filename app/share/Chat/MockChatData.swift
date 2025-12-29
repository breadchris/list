//
//  MockChatData.swift
//  share
//
//  Mock data for chat demonstration
//

import Foundation
import ExyteChat

/// Generates rich mock chat data with multiple users, message types, and interactions
struct MockChatData {

    // MARK: - Users

    static let currentUser = User(
        id: "user-1",
        name: "Me",
        avatarURL: nil,
        isCurrentUser: true
    )

    static let alice = User(
        id: "user-2",
        name: "Alice",
        avatarURL: URL(string: "https://ui-avatars.com/api/?name=Alice&background=5B8DEE&color=fff&size=128"),
        isCurrentUser: false
    )

    static let bob = User(
        id: "user-3",
        name: "Bob",
        avatarURL: URL(string: "https://ui-avatars.com/api/?name=Bob&background=9B59B6&color=fff&size=128"),
        isCurrentUser: false
    )

    // MARK: - Dates

    private static var yesterday: Date {
        Calendar.current.date(byAdding: .day, value: -1, to: Date()) ?? Date()
    }

    private static func yesterdayAt(hour: Int, minute: Int) -> Date {
        var components = Calendar.current.dateComponents([.year, .month, .day], from: yesterday)
        components.hour = hour
        components.minute = minute
        return Calendar.current.date(from: components) ?? yesterday
    }

    private static func todayAt(hour: Int, minute: Int) -> Date {
        var components = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        components.hour = hour
        components.minute = minute
        return Calendar.current.date(from: components) ?? Date()
    }

    // MARK: - Mock Attachments

    private static func imageAttachment() -> Attachment {
        Attachment(
            id: UUID().uuidString,
            url: URL(string: "https://picsum.photos/400/300")!,
            type: .image
        )
    }

    // MARK: - Generate Conversation

    static func generateConversation() -> [Message] {
        [
            // Yesterday's messages
            Message(
                id: "msg-1",
                user: alice,
                status: .read,
                createdAt: yesterdayAt(hour: 14, minute: 30),
                text: "Hey! Have you seen the new update?"
            ),

            Message(
                id: "msg-2",
                user: currentUser,
                status: .read,
                createdAt: yesterdayAt(hour: 14, minute: 32),
                text: "Not yet, what's new?"
            ),

            Message(
                id: "msg-3",
                user: bob,
                status: .read,
                createdAt: yesterdayAt(hour: 14, minute: 35),
                text: "Check this out!",
                attachments: [imageAttachment()]
            ),

            Message(
                id: "msg-4",
                user: alice,
                status: .read,
                createdAt: yesterdayAt(hour: 14, minute: 38),
                text: "That looks great!",
                reactions: [
                    Reaction(
                        user: currentUser,
                        type: .emoji("👍"),
                        status: .sent
                    ),
                    Reaction(
                        user: bob,
                        type: .emoji("🔥"),
                        status: .sent
                    )
                ]
            ),

            Message(
                id: "msg-5",
                user: bob,
                status: .read,
                createdAt: yesterdayAt(hour: 15, minute: 10),
                text: "The team has been working on this for weeks. Really happy with how it turned out!"
            ),

            // Today's messages
            Message(
                id: "msg-6",
                user: currentUser,
                status: .delivered,
                createdAt: todayAt(hour: 9, minute: 15),
                text: "Just tried it out. Really impressed with the new features. The performance improvements are noticeable."
            ),

            Message(
                id: "msg-7",
                user: alice,
                status: .sent,
                createdAt: todayAt(hour: 9, minute: 20),
                text: "Right? The team did an amazing job.",
                replyMessage: ReplyMessage(
                    id: "msg-6",
                    user: currentUser,
                    createdAt: todayAt(hour: 9, minute: 15),
                    text: "Just tried it out. Really impressed with the new features..."
                )
            ),

            Message(
                id: "msg-8",
                user: bob,
                status: .sending,
                createdAt: todayAt(hour: 9, minute: 25),
                text: "Let's discuss more at the meeting tomorrow"
            )
        ]
    }
}
