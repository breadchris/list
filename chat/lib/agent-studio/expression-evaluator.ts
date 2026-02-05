/**
 * Safe expression evaluator for workflow input mappings
 *
 * Supports:
 * - {{trigger.input}} - The workflow trigger input
 * - {{nodeId.output}} - Output from a previous step
 * - {{nodeId.output.field}} - Nested field access
 * - JSON object syntax with template placeholders
 */

import type { WorkflowExecutionContext } from "@/types/agent-studio";

/**
 * Resolve a dot-notation path against the execution context
 * @example "trigger.input" -> context.trigger.input
 * @example "agent-1.output" -> context.steps['agent-1'].output
 * @example "agent-1.output.message" -> context.steps['agent-1'].output.message
 */
function resolvePath(
  path: string,
  context: WorkflowExecutionContext
): unknown {
  const parts = path.split(".");

  if (parts[0] === "trigger") {
    // Access trigger data
    let value: unknown = context.trigger;
    for (let i = 1; i < parts.length; i++) {
      if (value && typeof value === "object") {
        value = (value as Record<string, unknown>)[parts[i]];
      } else {
        return undefined;
      }
    }
    return value;
  }

  // Access step output
  const nodeId = parts[0];
  const stepResult = context.steps[nodeId];
  if (!stepResult) return undefined;

  let value: unknown = stepResult;
  for (let i = 1; i < parts.length; i++) {
    if (value && typeof value === "object") {
      value = (value as Record<string, unknown>)[parts[i]];
    } else {
      return undefined;
    }
  }
  return value;
}

/**
 * Safely evaluate input mapping expressions
 *
 * @example
 * evaluateInputMapping('{{trigger.input}}', context)
 * // Returns the trigger input string
 *
 * @example
 * evaluateInputMapping('{"message": "{{agent-1.output}}"}', context)
 * // Returns parsed JSON object with resolved template
 */
export function evaluateInputMapping(
  template: string | undefined,
  context: WorkflowExecutionContext
): unknown {
  if (!template) {
    // Default: pass trigger input
    return context.trigger.input;
  }

  const trimmed = template.trim();

  // Handle JSON object templates
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    // Replace all {{...}} placeholders in the JSON string
    const resolved = trimmed.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
      const value = resolvePath(path.trim(), context);
      // If value is a string, escape it for JSON
      if (typeof value === "string") {
        return JSON.stringify(value).slice(1, -1); // Remove surrounding quotes
      }
      return JSON.stringify(value);
    });
    try {
      return JSON.parse(resolved);
    } catch {
      return resolved; // Return as string if not valid JSON
    }
  }

  // Handle simple template like "{{trigger.input}}"
  const simpleMatch = trimmed.match(/^\{\{([^}]+)\}\}$/);
  if (simpleMatch) {
    return resolvePath(simpleMatch[1].trim(), context);
  }

  // Mixed template - resolve all placeholders and return string
  return trimmed.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const value = resolvePath(path.trim(), context);
    return String(value ?? "");
  });
}

/**
 * Parse a literal value from a condition expression
 */
function parseValue(str: string): unknown {
  const trimmed = str.trim();

  // Boolean
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  // Null
  if (trimmed === "null") return null;

  // Number
  const num = Number(trimmed);
  if (!isNaN(num) && trimmed !== "") return num;

  // String (with or without quotes)
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

/**
 * Compare two values with an operator
 */
function compareValues(left: unknown, right: unknown, op: string): boolean {
  switch (op) {
    case "===":
    case "==":
      return left === right;
    case "!==":
    case "!=":
      return left !== right;
    case ">":
      return Number(left) > Number(right);
    case "<":
      return Number(left) < Number(right);
    case ">=":
      return Number(left) >= Number(right);
    case "<=":
      return Number(left) <= Number(right);
    default:
      return false;
  }
}

/**
 * Evaluate a branch condition expression
 *
 * Supports:
 * - {{nodeId.output}} === "value"
 * - {{nodeId.output}} !== "value"
 * - {{nodeId.output.field}} > 5
 * - {{nodeId.output.field}} < 10
 * - {{nodeId.output.success}} === true
 * - {{nodeId.output}} (truthy check)
 *
 * @returns true if condition matches, false otherwise
 */
export function evaluateBranchCondition(
  expression: string,
  context: WorkflowExecutionContext
): boolean {
  if (!expression.trim()) return false;

  // Parse the expression (simple pattern matching, not full JS eval)
  // Pattern: {{path}} operator value
  const operators = ["===", "!==", ">=", "<=", ">", "<", "==", "!="];

  for (const op of operators) {
    const opIndex = expression.indexOf(op);
    if (opIndex === -1) continue;

    const leftPart = expression.slice(0, opIndex).trim();
    const rightPart = expression.slice(opIndex + op.length).trim();

    // Resolve left side (should be a template like {{nodeId.output}})
    const leftMatch = leftPart.match(/^\{\{([^}]+)\}\}$/);
    if (!leftMatch) continue;

    const leftValue = resolvePath(leftMatch[1].trim(), context);
    const rightValue = parseValue(rightPart);

    return compareValues(leftValue, rightValue, op);
  }

  // If no operator found, evaluate as truthy check
  const match = expression.match(/^\{\{([^}]+)\}\}$/);
  if (match) {
    const value = resolvePath(match[1].trim(), context);
    return Boolean(value);
  }

  return false;
}
