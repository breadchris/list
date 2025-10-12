#!/bin/bash

# Claude Code Lambda API Test Suite
# Tests the vibe coding feature comprehensively

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Lambda endpoint
LAMBDA_URL="https://6jvwlnnks2.execute-api.us-east-1.amazonaws.com/claude-code"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test results array
declare -a FAILED_TESTS

# Helper functions
print_test_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}TEST $TESTS_RUN: $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

assert_success() {
    local response="$1"
    local test_name="$2"

    if echo "$response" | jq -e '.success == true' > /dev/null 2>&1; then
        print_success "Response indicates success"
        return 0
    else
        print_error "Response indicates failure"
        echo "$response" | jq '.' || echo "$response"
        return 1
    fi
}

assert_has_session_id() {
    local response="$1"

    if echo "$response" | jq -e '.session_id' > /dev/null 2>&1; then
        local session_id=$(echo "$response" | jq -r '.session_id')
        print_success "Session ID present: ${session_id:0:20}..."
        echo "$session_id"
        return 0
    else
        print_error "Session ID missing"
        return 1
    fi
}

assert_exit_code_zero() {
    local response="$1"

    local exit_code=$(echo "$response" | jq -r '.exitCode // 999')
    if [ "$exit_code" == "0" ]; then
        print_success "Exit code is 0"
        return 0
    else
        print_error "Exit code is $exit_code (expected 0)"
        return 1
    fi
}

assert_file_count() {
    local response="$1"
    local expected="$2"

    local file_count=$(echo "$response" | jq -r '.file_count // 0')
    if [ "$file_count" -ge "$expected" ]; then
        print_success "File count is $file_count (expected >= $expected)"
        return 0
    else
        print_error "File count is $file_count (expected >= $expected)"
        return 1
    fi
}

assert_s3_url_present() {
    local response="$1"

    local s3_url=$(echo "$response" | jq -r '.s3_url // ""')
    if [ ! -z "$s3_url" ]; then
        print_success "S3 URL present: ${s3_url:0:50}..."
        return 0
    else
        print_error "S3 URL missing or empty"
        return 1
    fi
}

assert_s3_url_empty() {
    local response="$1"

    local s3_url=$(echo "$response" | jq -r '.s3_url // ""')
    if [ -z "$s3_url" ]; then
        print_success "S3 URL is empty (expected for text-only response)"
        return 0
    else
        print_error "S3 URL should be empty but is: $s3_url"
        return 1
    fi
}

assert_error_code() {
    local http_code="$1"
    local expected="$2"

    if [ "$http_code" == "$expected" ]; then
        print_success "HTTP status code is $http_code"
        return 0
    else
        print_error "HTTP status code is $http_code (expected $expected)"
        return 1
    fi
}

run_test() {
    TESTS_RUN=$((TESTS_RUN + 1))
    print_test_header "$1"
}

pass_test() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    print_success "TEST PASSED"
}

fail_test() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    FAILED_TESTS+=("Test $TESTS_RUN: $1")
    print_error "TEST FAILED"
}

# ============================================================================
# TEST 1: Simple Text-Only Response (No Files Generated)
# ============================================================================
test_text_only_response() {
    run_test "Text-Only Response (No Files)"

    local payload=$(cat <<EOF
{
  "prompt": "What is 2 + 2? Just answer with the number, don't create any files."
}
EOF
)

    print_info "Sending text-only prompt..."
    local response=$(curl -s -X POST "$LAMBDA_URL" \
        -H "Content-Type: application/json" \
        -d "$payload")

    if assert_success "$response" && \
       assert_exit_code_zero "$response" && \
       assert_s3_url_empty "$response" && \
       assert_has_session_id "$response"; then
        pass_test
    else
        fail_test "Text-Only Response"
    fi
}

# ============================================================================
# TEST 2: Simple React Component Generation (Single File)
# ============================================================================
test_single_component() {
    run_test "Single React Component Generation"

    local payload=$(cat <<EOF
{
  "prompt": "Create a simple React Button component with TypeScript. Just the component file, nothing else. Use only React, no external dependencies."
}
EOF
)

    print_info "Sending component generation prompt..."
    local response=$(curl -s -X POST "$LAMBDA_URL" \
        -H "Content-Type: application/json" \
        -d "$payload")

    if assert_success "$response" && \
       assert_exit_code_zero "$response" && \
       assert_file_count "$response" 1 && \
       assert_s3_url_present "$response" && \
       assert_has_session_id "$response"; then

        # Store session ID for continuation test
        SESSION_ID_FOR_CONTINUATION=$(assert_has_session_id "$response")
        pass_test
    else
        fail_test "Single Component Generation"
    fi
}

# ============================================================================
# TEST 3: Multi-File Generation
# ============================================================================
test_multi_file_generation() {
    run_test "Multi-File Generation"

    local payload=$(cat <<EOF
{
  "prompt": "Create a Todo List component with TypeScript. Include: 1) TodoList.tsx component, 2) types.ts for TypeScript interfaces, 3) utils.ts for helper functions. Use only React, no external dependencies."
}
EOF
)

    print_info "Sending multi-file generation prompt..."
    local response=$(curl -s -X POST "$LAMBDA_URL" \
        -H "Content-Type: application/json" \
        -d "$payload")

    if assert_success "$response" && \
       assert_exit_code_zero "$response" && \
       assert_file_count "$response" 3 && \
       assert_s3_url_present "$response" && \
       assert_has_session_id "$response"; then
        pass_test
    else
        fail_test "Multi-File Generation"
    fi
}

# ============================================================================
# TEST 4: Selected Content - Single Item
# ============================================================================
test_selected_content_single() {
    run_test "Selected Content Context (Single Item)"

    local payload=$(cat <<EOF
{
  "prompt": "<selected_content>\nContent Item 1:\nType: text\nData: https://react.dev/learn/hooks\n</selected_content>\n\nCreate a React component that displays this link with a title and description."
}
EOF
)

    print_info "Sending prompt with single selected content item..."
    local response=$(curl -s -X POST "$LAMBDA_URL" \
        -H "Content-Type: application/json" \
        -d "$payload")

    if assert_success "$response" && \
       assert_exit_code_zero "$response" && \
       assert_has_session_id "$response"; then

        # Check if response mentions the URL
        if echo "$response" | jq -r '.messages[].message.content[].text // ""' | grep -q "react.dev/learn/hooks"; then
            print_success "Response references selected content URL"
            pass_test
        else
            print_error "Response does not reference selected content"
            fail_test "Selected Content Single"
        fi
    else
        fail_test "Selected Content Single"
    fi
}

# ============================================================================
# TEST 5: Selected Content - Multiple Items
# ============================================================================
test_selected_content_multiple() {
    run_test "Selected Content Context (Multiple Items)"

    local payload=$(cat <<EOF
{
  "prompt": "<selected_content>\nContent Item 1:\nType: text\nData: https://react.dev\n---\nContent Item 2:\nType: text\nData: https://github.com/facebook/react\n---\nContent Item 3:\nType: text\nData: https://legacy.reactjs.org\n</selected_content>\n\nCreate a LinkList component displaying these 3 URLs as clickable links."
}
EOF
)

    print_info "Sending prompt with multiple selected content items..."
    local response=$(curl -s -X POST "$LAMBDA_URL" \
        -H "Content-Type: application/json" \
        -d "$payload")

    if assert_success "$response" && \
       assert_exit_code_zero "$response" && \
       assert_has_session_id "$response"; then
        pass_test
    else
        fail_test "Selected Content Multiple"
    fi
}

# ============================================================================
# TEST 6: Session Continuation (Valid Session ID)
# ============================================================================
test_session_continuation() {
    run_test "Session Continuation (Valid Session)"

    if [ -z "$SESSION_ID_FOR_CONTINUATION" ]; then
        print_error "No session ID available from previous test - skipping"
        return
    fi

    local payload=$(cat <<EOF
{
  "prompt": "Add a 'disabled' prop to the Button component and update the styling when disabled.",
  "session_id": "$SESSION_ID_FOR_CONTINUATION"
}
EOF
)

    print_info "Continuing session $SESSION_ID_FOR_CONTINUATION..."
    local response=$(curl -s -X POST "$LAMBDA_URL" \
        -H "Content-Type: application/json" \
        -d "$payload")

    if assert_success "$response" && \
       assert_exit_code_zero "$response"; then

        # Verify same session ID returned
        local returned_session=$(echo "$response" | jq -r '.session_id')
        if [ "$returned_session" == "$SESSION_ID_FOR_CONTINUATION" ]; then
            print_success "Session ID matches: $returned_session"
            pass_test
        else
            print_error "Session ID mismatch: expected $SESSION_ID_FOR_CONTINUATION, got $returned_session"
            fail_test "Session Continuation"
        fi
    else
        fail_test "Session Continuation"
    fi
}

# ============================================================================
# TEST 7: Invalid Session ID (Should Return 404)
# ============================================================================
test_invalid_session_id() {
    run_test "Invalid Session ID (Error Handling)"

    local payload=$(cat <<EOF
{
  "prompt": "Continue the previous work.",
  "session_id": "session-invalid-does-not-exist-123"
}
EOF
)

    print_info "Attempting to continue non-existent session..."
    local http_code=$(curl -s -w "%{http_code}" -o /tmp/claude_response.json -X POST "$LAMBDA_URL" \
        -H "Content-Type: application/json" \
        -d "$payload")

    local response=$(cat /tmp/claude_response.json)

    if assert_error_code "$http_code" "404"; then
        print_info "Error message: $(echo "$response" | jq -r '.error')"
        pass_test
    else
        fail_test "Invalid Session ID"
    fi
}

# ============================================================================
# TEST 8: React Hooks Component
# ============================================================================
test_react_hooks() {
    run_test "React Component with Hooks"

    local payload=$(cat <<EOF
{
  "prompt": "Create a Counter component using useState and useEffect hooks. The counter should increment every second. Use only React, no external dependencies."
}
EOF
)

    print_info "Sending React hooks component prompt..."
    local response=$(curl -s -X POST "$LAMBDA_URL" \
        -H "Content-Type: application/json" \
        -d "$payload")

    if assert_success "$response" && \
       assert_exit_code_zero "$response" && \
       assert_has_session_id "$response"; then
        pass_test
    else
        fail_test "React Hooks Component"
    fi
}

# ============================================================================
# TEST 9: TypeScript Types Component
# ============================================================================
test_typescript_types() {
    run_test "Component with TypeScript Types"

    local payload=$(cat <<EOF
{
  "prompt": "Create a Card component with TypeScript. Define proper interfaces for props including title, description, and onClick handler. Use only React and TypeScript, no external dependencies."
}
EOF
)

    print_info "Sending TypeScript component prompt..."
    local response=$(curl -s -X POST "$LAMBDA_URL" \
        -H "Content-Type: application/json" \
        -d "$payload")

    if assert_success "$response" && \
       assert_exit_code_zero "$response" && \
       assert_has_session_id "$response"; then
        pass_test
    else
        fail_test "TypeScript Types Component"
    fi
}

# ============================================================================
# TEST 10: Empty Prompt (Should Fail Validation)
# ============================================================================
test_empty_prompt() {
    run_test "Empty Prompt (Validation Error)"

    local payload=$(cat <<EOF
{
  "prompt": ""
}
EOF
)

    print_info "Sending empty prompt..."
    local http_code=$(curl -s -w "%{http_code}" -o /tmp/claude_response.json -X POST "$LAMBDA_URL" \
        -H "Content-Type: application/json" \
        -d "$payload")

    local response=$(cat /tmp/claude_response.json)

    if assert_error_code "$http_code" "400"; then
        print_info "Error message: $(echo "$response" | jq -r '.error')"
        pass_test
    else
        fail_test "Empty Prompt"
    fi
}

# ============================================================================
# TEST 11: Very Long Prompt
# ============================================================================
test_long_prompt() {
    run_test "Very Long Prompt (Stress Test)"

    # Generate a long but reasonable prompt
    local long_context=""
    for i in {1..50}; do
        long_context="${long_context}Content Item $i: https://example.com/page-$i with detailed description about React component development and TypeScript integration.\n"
    done

    local payload=$(cat <<EOF
{
  "prompt": "<selected_content>\n${long_context}</selected_content>\n\nCreate a component that references these links."
}
EOF
)

    print_info "Sending long prompt with 50 content items..."
    local response=$(curl -s -X POST "$LAMBDA_URL" \
        -H "Content-Type: application/json" \
        -d "$payload")

    if assert_success "$response" && \
       assert_has_session_id "$response"; then
        pass_test
    else
        fail_test "Long Prompt"
    fi
}

# ============================================================================
# TEST 12: Special Characters in Prompt
# ============================================================================
test_special_characters() {
    run_test "Special Characters Handling"

    local payload=$(cat <<'EOF'
{
  "prompt": "Create a component that displays this text: \"Hello 'World'\" with <tags> and &special; characters. Use only React."
}
EOF
)

    print_info "Sending prompt with special characters..."
    local response=$(curl -s -X POST "$LAMBDA_URL" \
        -H "Content-Type: application/json" \
        -d "$payload")

    if assert_success "$response" && \
       assert_has_session_id "$response"; then
        pass_test
    else
        fail_test "Special Characters"
    fi
}

# ============================================================================
# TEST 13: Component with Inline Styles
# ============================================================================
test_inline_styles() {
    run_test "Component with Inline Styles"

    local payload=$(cat <<EOF
{
  "prompt": "Create a styled Button component using inline styles (no external CSS libraries). Include hover effects using React state. Use only React."
}
EOF
)

    print_info "Sending inline styles prompt..."
    local response=$(curl -s -X POST "$LAMBDA_URL" \
        -H "Content-Type: application/json" \
        -d "$payload")

    if assert_success "$response" && \
       assert_exit_code_zero "$response" && \
       assert_has_session_id "$response"; then
        pass_test
    else
        fail_test "Inline Styles Component"
    fi
}

# ============================================================================
# TEST 14: Form Component with State Management
# ============================================================================
test_form_component() {
    run_test "Form Component with State"

    local payload=$(cat <<EOF
{
  "prompt": "Create a contact form component with name and email fields. Use useState to manage form state and handle submission. Use only React, no form libraries."
}
EOF
)

    print_info "Sending form component prompt..."
    local response=$(curl -s -X POST "$LAMBDA_URL" \
        -H "Content-Type: application/json" \
        -d "$payload")

    if assert_success "$response" && \
       assert_exit_code_zero "$response" && \
       assert_has_session_id "$response"; then
        pass_test
    else
        fail_test "Form Component"
    fi
}

# ============================================================================
# TEST 15: Vibe Coding Constraint - No External Dependencies
# ============================================================================
test_no_external_deps() {
    run_test "Vibe Coding Constraint (No External Deps)"

    local payload=$(cat <<EOF
{
  "prompt": "I want to create a component that makes HTTP requests. Can you use axios? Actually, follow the rule: only React and no external dependencies."
}
EOF
)

    print_info "Testing vibe coding constraint..."
    local response=$(curl -s -X POST "$LAMBDA_URL" \
        -H "Content-Type: application/json" \
        -d "$payload")

    if assert_success "$response" && \
       assert_has_session_id "$response"; then

        # Check that response doesn't suggest external libs
        local message_content=$(echo "$response" | jq -r '.messages[].message.content[].text // ""')
        if echo "$message_content" | grep -qi "fetch"; then
            print_success "Response suggests fetch API (built-in, not external)"
            pass_test
        elif echo "$message_content" | grep -qi "axios\|npm\|install\|library"; then
            print_error "Response suggests external dependencies"
            fail_test "No External Dependencies"
        else
            print_success "Response adheres to no external dependencies constraint"
            pass_test
        fi
    else
        fail_test "No External Dependencies"
    fi
}

# ============================================================================
# Print Summary
# ============================================================================
print_summary() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}TEST SUMMARY${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "Total Tests Run:     ${BLUE}$TESTS_RUN${NC}"
    echo -e "Tests Passed:        ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests Failed:        ${RED}$TESTS_FAILED${NC}"
    echo ""

    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}ALL TESTS PASSED! ✓${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        exit 0
    else
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}SOME TESTS FAILED:${NC}"
        for failed_test in "${FAILED_TESTS[@]}"; do
            echo -e "${RED}  ✗ $failed_test${NC}"
        done
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        exit 1
    fi
}

# ============================================================================
# Main Test Execution
# ============================================================================
main() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Claude Code Lambda API Test Suite${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "Endpoint: ${YELLOW}$LAMBDA_URL${NC}"
    echo ""

    # Check dependencies
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}Error: jq is not installed. Please install jq to run these tests.${NC}"
        exit 1
    fi

    if ! command -v curl &> /dev/null; then
        echo -e "${RED}Error: curl is not installed. Please install curl to run these tests.${NC}"
        exit 1
    fi

    # Run all tests
    test_text_only_response
    test_single_component
    test_multi_file_generation
    test_selected_content_single
    test_selected_content_multiple
    test_session_continuation
    test_invalid_session_id
    test_react_hooks
    test_typescript_types
    test_empty_prompt
    test_long_prompt
    test_special_characters
    test_inline_styles
    test_form_component
    test_no_external_deps

    # Print summary
    print_summary
}

# Run main function
main
