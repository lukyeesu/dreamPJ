import { z } from 'zod';

/**
 * Schema for Inventory Item UI Form (React Hook Form)
 */
export const inventoryItemFormSchema = z.object({
  id: z.string().optional(),
  code: z.string().trim().optional().default(''),
  name: z.string().trim().min(1, 'กรุณาระบุชื่อสิ่งของ/อุปกรณ์'),
  category_id: z.string().nullable().optional(),
  item_type: z.enum(['consumable', 'asset', 'reusable', 'task', 'banknote', 'reusable_material']).default('consumable'),
  unit: z.string().trim().min(1, 'กรุณาระบุหน่วยนับ').default('ชิ้น'),
  current_stock: z.coerce.number().min(0, 'จำนวนสต็อกต้องไม่ติดลบ').default(0),
  min_alert_threshold: z.coerce.number().min(0, 'จุดเตือนสต็อกขั้นต่ำต้องไม่ติดลบ').default(5),
  average_cost: z.coerce.number().min(0, 'ต้นทุนเฉลี่ยต้องไม่ติดลบ').default(0),
  storage_location: z.string().trim().optional().default(''),
  color: z.string().trim().optional().default(''),
  size: z.string().trim().optional().default(''),
  status: z.string().trim().default('in_service')
});

/**
 * Schema for Inventory Database Payload (syncService)
 */
export const inventoryItemPayloadSchema = z.object({
  id: z.string().optional(),
  code: z.string().optional(),
  name: z.string().trim().min(1, 'ชื่อสิ่งของไม่สามารถเว้นว่างได้'),
  category_id: z.string().nullable().optional(),
  item_type: z.string().default('consumable'),
  unit: z.string().default('ชิ้น'),
  current_stock: z.coerce.number().min(0).default(0),
  min_alert_threshold: z.coerce.number().min(0).default(5),
  average_cost: z.coerce.number().min(0).default(0),
  storage_location: z.string().nullable().optional().default(''),
  color: z.string().nullable().optional().default(''),
  size: z.string().nullable().optional().default(''),
  status: z.string().default('in_service'),
  is_active: z.boolean().default(true)
}).passthrough();
