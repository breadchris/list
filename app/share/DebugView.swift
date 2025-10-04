//
//  DebugView.swift
//  share
//
//  Debug interface for testing share functionality
//

import SwiftUI

struct DebugView: View {
    @State private var testResults: [String] = []
    @State private var testURL = "https://www.apple.com"
    @State private var testTitle = "Apple"
    @State private var showingResults = false
    
    var body: some View {
        NavigationView {
            List {
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
                    
                    Button("Check for Shared URLs") {
                        SharedURLManager.shared.checkForSharedURLs()
                        addResult("Checked for shared URLs")
                    }
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
        }
    }
    
    private func runTest(_ test: () -> Bool) {
        let success = test()
        addResult(success ? "✅ Test passed" : "❌ Test failed")
    }
    
    private func addResult(_ result: String) {
        testResults.append("\(Date().formatted(.dateTime.hour().minute().second())): \(result)")
    }
}

#Preview {
    DebugView()
}