//
//  EPUBItem.swift
//  share
//
//  Data model for EPUB books stored in Supabase content table
//

import Foundation

/// Represents an EPUB book stored in Supabase content table
struct EPUBItem: Codable, Identifiable {
    let id: String
    let created_at: String
    let data: String  // Title/filename
    let group_id: String
    let user_id: String
    let metadata: EPUBMetadata?

    /// Display title (parsed from metadata or data field)
    var displayTitle: String {
        // Try metadata.filename first
        if let filename = metadata?.filename, !filename.isEmpty {
            // Remove .epub extension
            if filename.lowercased().hasSuffix(".epub") {
                return String(filename.dropLast(5))
            }
            return filename
        }
        // Try metadata.file_name (alternative key)
        if let fileName = metadata?.file_name, !fileName.isEmpty {
            if fileName.lowercased().hasSuffix(".epub") {
                return String(fileName.dropLast(5))
            }
            return fileName
        }
        // Fallback to data field
        if !data.isEmpty {
            return data
        }
        return "Unknown Book"
    }
}

/// Metadata for EPUB content
struct EPUBMetadata: Codable {
    let file_url: String?
    let filename: String?
    let file_name: String?  // Alternative key used in some records
}
