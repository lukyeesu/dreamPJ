import { staffFormSchema, staffPayloadSchema } from './staffSchema.js';
import { locationFormSchema, locationPayloadSchema } from './locationSchema.js';
import { customerFormSchema, customerPayloadSchema } from './customerSchema.js';
import { artistFormSchema, artistPayloadSchema } from './artistSchema.js';
import { inventoryItemFormSchema, inventoryItemPayloadSchema } from './inventorySchema.js';
import { quotationFormSchema, quotationPayloadSchema } from './quotationSchema.js';
import { projectPayloadSchema } from './projectSchema.js';

export {
  staffFormSchema,
  staffPayloadSchema,
  locationFormSchema,
  locationPayloadSchema,
  customerFormSchema,
  customerPayloadSchema,
  artistFormSchema,
  artistPayloadSchema,
  inventoryItemFormSchema,
  inventoryItemPayloadSchema,
  quotationFormSchema,
  quotationPayloadSchema,
  projectPayloadSchema
};

/**
 * Validates and transforms a payload using a Zod schema.
 * Throws a clean, readable Error if validation fails.
 * Returns the sanitized and coerced data.
 *
 * @param {import('zod').ZodSchema} schema
 * @param {any} data
 * @param {string} entityName
 * @returns {any}
 */
export function validatePayload(schema, data, entityName = 'Data') {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map(err => `${err.path.join('.') || 'root'}: ${err.message}`)
      .join('; ');
    console.error(`[Zod Validation Error] [${entityName}]:`, errorDetails, data);
    throw new Error(`ข้อมูล ${entityName} ไม่ถูกต้อง: ${errorDetails}`);
  }
  return result.data;
}
