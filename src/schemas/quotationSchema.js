import { z } from 'zod';

/**
 * Item schema for backdrop or floral items
 */
export const quotationItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().default(''),
  category: z.string().optional().default(''),
  quantity: z.coerce.number().min(0).default(1),
  unit: z.string().optional().default('ชิ้น'),
  unit_price: z.coerce.number().min(0).default(0),
  cost: z.coerce.number().min(0).default(0),
  subtotal: z.coerce.number().min(0).default(0)
}).passthrough();

/**
 * Schema for Quotation UI Form
 */
export const quotationFormSchema = z.object({
  quote_no: z.string().trim().optional(),
  title: z.string().trim().min(1, 'กรุณาระบุชื่องาน / ศิลปิน'),
  client_name: z.string().trim().optional().default(''),
  project_code: z.string().trim().nullable().optional(),
  backdrop_items: z.array(quotationItemSchema).default([]),
  floral_items: z.array(quotationItemSchema).default([]),
  backdrop_cost: z.coerce.number().min(0).default(0),
  floral_cost: z.coerce.number().min(0).default(0),
  total_cost: z.coerce.number().min(0).default(0),
  markup_percent: z.coerce.number().min(0).default(30),
  final_price: z.coerce.number().min(0).default(0),
  note: z.string().trim().optional().default('')
});

/**
 * Schema for Quotation Database Payload (syncService)
 */
export const quotationPayloadSchema = z.object({
  id: z.string().optional(),
  quote_no: z.string().trim().min(1, 'รหัสใบเสนอราคาไม่ถูกต้อง'),
  title: z.string().trim().min(1, 'ต้องระบุชื่องาน/ใบเสนอราคา'),
  client_name: z.string().nullable().optional().default(''),
  project_code: z.string().nullable().optional(),
  backdrop_items: z.array(z.any()).default([]),
  floral_items: z.array(z.any()).default([]),
  backdrop_cost: z.coerce.number().min(0).default(0),
  floral_cost: z.coerce.number().min(0).default(0),
  total_cost: z.coerce.number().min(0).default(0),
  markup_percent: z.coerce.number().default(30),
  final_price: z.coerce.number().min(0).default(0),
  note: z.string().nullable().optional().default(''),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
}).passthrough();
