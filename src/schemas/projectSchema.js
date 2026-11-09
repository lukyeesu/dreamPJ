import { z } from 'zod';

/**
 * Schema for Project Expense Item
 */
export const projectExpenseItemSchema = z.object({
  id: z.any().optional(),
  name: z.string().default(''),
  price: z.coerce.number().min(0).default(0),
  paidBy: z.string().optional().default('')
}).passthrough();

/**
 * Schema for Project Quotation Item
 */
export const projectQuotationItemSchema = z.object({
  id: z.any().optional(),
  name: z.string().default(''),
  price: z.coerce.number().min(0).default(0),
  quantity: z.coerce.number().min(0).default(1)
}).passthrough();

/**
 * Schema for Project Customer Support Item
 */
export const projectCustomerSupportItemSchema = z.object({
  id: z.any().optional(),
  name: z.string().default(''),
  denomination: z.coerce.number().min(0).default(0),
  quantity: z.coerce.number().min(0).default(0),
  price: z.coerce.number().min(0).default(0)
}).passthrough();

/**
 * Schema for Project Database Payload (syncService)
 */
export const projectPayloadSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(v => String(v)),
  code: z.string().optional().default(''),
  client: z.string().optional().default(''),
  artist: z.string().optional().default(''),
  wage: z.coerce.number().min(0, 'ค่าแรง/ค่าสินค้าต้องไม่ติดลบ').default(0),
  deliveryFee: z.coerce.number().min(0, 'ค่าส่งต้องไม่ติดลบ').default(0),
  depositAmount: z.coerce.number().min(0, 'เงินมัดจำต้องไม่ติดลบ').default(0),
  paymentStatus: z.string().optional().default('unpaid'),
  status: z.string().optional().default('pending'),
  date: z.string().optional().default(''),
  rawDateTime: z.string().optional().default(''),
  expenses: z.array(projectExpenseItemSchema).optional().default([]),
  quotationItems: z.array(projectQuotationItemSchema).optional().default([]),
  customerSupport: z.array(projectCustomerSupportItemSchema).optional().default([])
}).passthrough();
