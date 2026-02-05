/**
 * JSON Schema to Zod Converter
 *
 * Converts JSON Schema (from the agent editor's schema builder) to Zod schemas
 * at runtime for use with Vercel AI SDK's streamObject().
 *
 * Supports: object, array, string, number, boolean, enum
 */

import { z, ZodTypeAny } from "zod";

interface JSONSchemaProperty {
  type?: string;
  description?: string;
  enum?: unknown[];
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  format?: string;
}

/**
 * Convert a JSON Schema to a Zod schema
 *
 * @param schema - JSON Schema object
 * @returns Zod schema that can be used with streamObject()
 */
export function jsonSchemaToZod(schema: Record<string, unknown>): ZodTypeAny {
  const schemaObj = schema as JSONSchemaProperty;
  return convertProperty(schemaObj, new Set());
}

function convertProperty(
  prop: JSONSchemaProperty,
  requiredFields: Set<string>,
  fieldName?: string
): ZodTypeAny {
  let zodSchema: ZodTypeAny;

  switch (prop.type) {
    case "object": {
      const shape: Record<string, ZodTypeAny> = {};
      const required = new Set(prop.required || []);

      for (const [key, propSchema] of Object.entries(prop.properties || {})) {
        shape[key] = convertProperty(propSchema as JSONSchemaProperty, required, key);
      }

      zodSchema = z.object(shape);
      break;
    }

    case "array": {
      const itemSchema = prop.items
        ? convertProperty(prop.items, new Set())
        : z.unknown();
      zodSchema = z.array(itemSchema);
      break;
    }

    case "string": {
      if (prop.enum && Array.isArray(prop.enum)) {
        // Enum type
        const enumValues = prop.enum as [string, ...string[]];
        zodSchema = z.enum(enumValues);
      } else {
        let stringSchema = z.string();

        // Apply constraints
        if (prop.minLength !== undefined) {
          stringSchema = stringSchema.min(prop.minLength);
        }
        if (prop.maxLength !== undefined) {
          stringSchema = stringSchema.max(prop.maxLength);
        }

        // Apply format validations
        if (prop.format === "email") {
          stringSchema = stringSchema.email();
        } else if (prop.format === "url") {
          stringSchema = stringSchema.url();
        }

        zodSchema = stringSchema;
      }
      break;
    }

    case "number":
    case "integer": {
      let numberSchema = z.number();

      if (prop.type === "integer") {
        numberSchema = numberSchema.int();
      }
      if (prop.minimum !== undefined) {
        numberSchema = numberSchema.min(prop.minimum);
      }
      if (prop.maximum !== undefined) {
        numberSchema = numberSchema.max(prop.maximum);
      }

      zodSchema = numberSchema;
      break;
    }

    case "boolean": {
      zodSchema = z.boolean();
      break;
    }

    case "null": {
      zodSchema = z.null();
      break;
    }

    default: {
      // Unknown or missing type - allow any value
      zodSchema = z.unknown();
    }
  }

  // Add description if present
  if (prop.description) {
    zodSchema = zodSchema.describe(prop.description);
  }

  // Make optional if not in required set
  if (fieldName && !requiredFields.has(fieldName)) {
    zodSchema = zodSchema.optional();
  }

  // Apply default if present
  if (prop.default !== undefined) {
    zodSchema = zodSchema.default(prop.default);
  }

  return zodSchema;
}

/**
 * Validate that a schema can be converted to Zod
 * Returns an array of validation errors, or empty array if valid
 */
export function validateSchema(schema: Record<string, unknown>): string[] {
  const errors: string[] = [];

  try {
    const schemaObj = schema as JSONSchemaProperty;

    if (!schemaObj.type) {
      errors.push("Schema must have a 'type' property");
    }

    if (schemaObj.type === "object" && !schemaObj.properties) {
      errors.push("Object schema must have 'properties'");
    }

    if (schemaObj.type === "array" && !schemaObj.items) {
      errors.push("Array schema should have 'items' definition");
    }

    // Try to convert it
    jsonSchemaToZod(schema);
  } catch (error) {
    errors.push(
      `Schema conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  return errors;
}
