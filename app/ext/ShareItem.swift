//
//  ShareItem.swift
//  share
//
//  Data model for shared URLs passed between extension and main app
//

import Foundation

struct ShareItem: Codable, Equatable, Identifiable {
    let id: UUID
    let url: String
    let note: String?
    let createdAt: Date
    let userId: UUID?

    init(id: UUID = UUID(), url: String, note: String? = nil, createdAt: Date = Date(), userId: UUID? = nil) {
        self.id = id
        self.url = url
        self.note = note
        self.createdAt = createdAt
        self.userId = userId
    }
}
