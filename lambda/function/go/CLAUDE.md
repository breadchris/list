# Go Testing Guidelines

## Test-as-Script Pattern (LISP-Style Development)

**CRITICAL**: Go tests can serve dual purposes - validation and execution

### Philosophy

Code should evolve naturally from script to reusable function to validated test, similar to LISP REPL-driven development. Write code once, use it in multiple contexts with minimal duplication.

### Pattern Structure

1. **Shared Core Function** - Contains all business logic, accepts transaction parameter
2. **Validation Test** - Uses `defer tx.Rollback()` to validate logic without side effects
3. **Execution Test** - Commits transaction to actually execute and persist changes

### Implementation Example

**Step 1: Extract Shared Function**
```go
// imdbImport performs the IMDb data import within the provided transaction
// Caller controls transaction lifecycle (commit or rollback)
func imdbImport(tx *sql.Tx, titles []IMDbTitle, userEmail string) (*IMDbImportResult, error) {
    result := &IMDbImportResult{
        TotalTitles: len(titles),
    }

    // 1. Get or create user
    var userID string
    err := tx.QueryRow(`...`).Scan(&userID)
    if err != nil {
        return nil, err
    }

    // 2. Create group for import
    // 3. Create tags
    // 4. Insert content
    // ... all business logic here

    return result, nil
}
```

**Step 2: Validation Test (Rollback Mode)**
```go
func TestIMDbIntegration(t *testing.T) {
    t.Log("🎬 Starting IMDb Integration Test (VALIDATION MODE - ROLLBACK)...")

    // Setup database connection
    db, err := sql.Open("postgres", dbURL)
    // ... connection setup

    // Load test data
    titles, err := loadAndProcessIMDbData(20)

    // Start transaction
    tx, err := db.Begin()
    defer tx.Rollback() // ALWAYS ROLLBACK - validation only

    // Execute shared function
    result, err := imdbImport(tx, titles, "user@example.com")
    if err != nil {
        t.Fatalf("Failed to import: %v", err)
    }

    // Validate results
    var groupCount int
    err = tx.QueryRow("SELECT COUNT(*) FROM groups WHERE id = $1", result.GroupID).Scan(&groupCount)
    if groupCount != 1 {
        t.Fatalf("Expected 1 group, got %d", groupCount)
    }

    t.Log("✅ Database validation passed - all data will be rolled back")
}
```

**Step 3: Execution Test (Commit Mode)**
```go
func TestIMDbImport_Commit(t *testing.T) {
    t.Log("🎬 Starting IMDb Import (EXECUTION MODE - COMMIT)...")

    // Setup database connection
    db, err := sql.Open("postgres", dbURL)
    // ... connection setup

    // Load data
    titles, err := loadAndProcessIMDbData(20)

    // Start transaction
    tx, err := db.Begin()
    // NO defer rollback

    // Execute shared function
    result, err := imdbImport(tx, titles, "user@example.com")
    if err != nil {
        tx.Rollback()
        t.Fatalf("Failed to import: %v", err)
    }

    // Commit transaction - KEY DIFFERENCE
    if err := tx.Commit(); err != nil {
        t.Fatalf("Failed to commit: %v", err)
    }

    t.Log("✅ Transaction committed - data persisted to database")
}
```

### Benefits

- **Zero code duplication** - Business logic written once
- **Safe development** - Validate behavior before committing
- **Script flexibility** - Run commit test to actually execute operations
- **Continuous validation** - Rollback test ensures logic stays correct over time
- **REPL-like workflow** - Iterate on logic, validate instantly, commit when ready

### Code Evolution Path

1. **Initial Script** - Write throwaway code to solve immediate problem
2. **Extract Function** - Move logic to reusable function with transaction parameter
3. **Add Validation Test** - Create rollback test to verify behavior
4. **Add Execution Test** - Create commit test to run as script
5. **Iterate** - Modify shared function, validation test ensures correctness

### Key Principles

- **Transaction as abstraction** - Caller controls commit/rollback, not the function
- **Minimal duplication** - Test setup code is acceptable to duplicate, business logic is not
- **Clear naming** - Use `_Commit` suffix to indicate execution tests
- **Rollback by default** - Always use `defer tx.Rollback()` in validation tests
- **Error handling** - Rollback on error in commit tests before returning

## Go Testing Best Practices

**CRITICAL**: Always use Go tests for validation and integration testing

### When to Use Go Tests

Use Go tests (`*_test.go` files) for:
- **API integration tests** - Testing live external services (Lambda, Libgen, TMDb, etc.)
- **Data validation** - Testing parsing, transformation, and validation logic
- **Multi-step workflows** - Testing complex operations that span multiple systems
- **Regression testing** - Ensuring existing functionality continues to work

Do NOT use TypeScript/JavaScript for integration testing - keep those for unit tests only.

### Test Structure

Follow the established patterns in `imdb_integration_test.go`:

1. **Table-Driven Tests** - Use struct slices for test cases with expected inputs/outputs
2. **Shared Helper Functions** - Extract HTTP clients, parsers, and common setup into reusable functions
3. **Integration Tests** - Test against live APIs with real data
4. **Validation Tests** - Unit tests for parsing and transformation logic using known inputs

### Table-Driven Testing Pattern

Always prefer table-driven tests over individual test functions:

```go
func TestLibgenURLBuilding(t *testing.T) {
    testCases := []struct {
        request       LibgenSearchRequest
        expectedQuery string
        expectedCols  []string
        desc          string
    }{
        {
            request:       LibgenSearchRequest{Query: "python", SearchType: "title"},
            expectedQuery: "python",
            expectedCols:  []string{"title"},
            desc:          "single word title search",
        },
        {
            request:       LibgenSearchRequest{Query: "designing interfaces", SearchType: "default"},
            expectedQuery: "designing interfaces",
            expectedCols:  []string{"title", "author"},
            desc:          "multi-word default search",
        },
    }

    for _, tc := range testCases {
        t.Run(tc.desc, func(t *testing.T) {
            // Test logic here
            t.Logf("✓ Validated: %s", tc.desc)
        })
    }
}
```

### Integration Test Pattern

For testing live external services:

```go
func TestLibgenIntegration(t *testing.T) {
    t.Log("🧪 Testing Libgen search integration...")

    testCases := []struct {
        query          string
        searchType     string
        expectedMinMax struct{ min, max int }
        desc           string
    }{
        {
            query:          "python",
            searchType:     "title",
            expectedMinMax: struct{ min, max int }{1, 100},
            desc:           "single-word search",
        },
    }

    for _, tc := range testCases {
        t.Run(tc.desc, func(t *testing.T) {
            result := callExternalAPI(t, tc.query)
            // Validate result
            t.Logf("✓ Completed: %s", tc.desc)
        })
    }
}
```

### Test Organization

- **Location**: Place tests in `lambda/function/*_test.go` for Lambda-related code, or in root directory for general utilities
- **Naming**: Use `TestFunctionName` for individual tests, `TestFeatureIntegration` for integration tests
- **Grouping**: Group related tests in the same file (e.g., `libgen_test.go` for all Libgen-related tests)
- **Helpers**: Extract shared logic into helper functions within the same file or in a `testing_helpers.go` file

### Best Practices

- **Clear test names**: Use descriptive `desc` fields in table-driven tests
- **Logging**: Use `t.Log()` for progress, `t.Logf()` for formatted output
- **Validation**: Use `t.Error()` for non-fatal failures, `t.Fatal()` for fatal failures
- **Subtests**: Always use `t.Run()` for table-driven tests to get isolated results
- **Timeouts**: Set reasonable timeouts for external API calls (e.g., 30 seconds)
- **Test data**: Use realistic test data that covers edge cases

### Example: Libgen Search Tests

See `lambda/function/libgen_test.go` for a complete example that includes:
- URL building validation tests
- Title extraction validation tests
- Live integration tests with multiple query types
- Multi-word query handling tests
- Shared HTTP client and result parsing logic

### Running Tests

```bash
# Run all tests
go test -v

# Run specific test file
go test -v ./lambda/function/libgen_test.go

# Run specific test function
go test -v -run TestLibgenIntegration

# Run with timeout
go test -v -timeout 5m
```
