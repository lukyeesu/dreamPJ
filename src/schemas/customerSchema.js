import { z } from 'zod';

/**
 * Schema for Customer UI Form (React Hook Form)
 */
export const customerFormSchema = z.object({
  name: z.string().trim().min(1, 'กรุณาระบุชื่อลูกค้า'),
  phone: z.string().trim().optional().default(''),
  line_id: z.string().trim().optional().default(''),
  social_account: z.string().trim().optional().default(''),
  email: z.string().trim().email('รูปแบบอีเมลไม่ถูกต้อง').optional().or(z.literal('')).default(''),
  tax_id: z.string().trim().optional().default(''),
  billing_address: z.string().trim().optional().default(''),
  vip_tier: z.enum(['general', 'silver', 'gold', 'vip_fandom']).default('general')
});

/**
 * Schema for Customer Database Payload
 */
export const customerPayloadSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'ชื่อลูกค้าไม่สามารถเว้นว่างได้'),
  phone: z.string().nullable().optional(),
  line_id: z.string().nullable().optional(),
  line: z.string().nullable().optional(),
  social_account: z.string().nullable().optional(),
  social: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  tax_id: z.string().nullable().optional(),
  taxId: z.string().nullable().optional(),
  billing_address: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  vip_tier: z.string().default('general'),
  tier: z.string().optional()
}).passthrough();
