import { z } from 'zod';

/**
 * Schema for Location UI Form (React Hook Form)
 */
export const locationFormSchema = z.object({
  name: z.string().trim().min(1, 'กรุณาระบุชื่อสถานที่จัดส่ง'),
  zone: z.string().trim().default('ทั่วไป'),
  default_map_link: z.string().trim().optional().default(''),
  loading_dock_map_link: z.string().trim().optional().default(''),
  gate_info: z.string().trim().optional().default(''),
  parking_height_limit: z.string().trim().optional().default(''),
  dock_contact_phone: z.string().trim().optional().default(''),
  delivery_tips: z.string().trim().optional().default('')
});

/**
 * Schema for Location Database Payload
 */
export const locationPayloadSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'ชื่อสถานที่ไม่สามารถเว้นว่างได้'),
  zone: z.string().default('ทั่วไป'),
  default_map_link: z.string().nullable().optional(),
  loading_dock_map_link: z.string().nullable().optional(),
  gate_info: z.string().nullable().optional(),
  parking_height_limit: z.string().nullable().optional(),
  dock_contact_phone: z.string().nullable().optional(),
  delivery_tips: z.string().nullable().optional(),
  aliases: z.array(z.string()).default([]),
  coords: z.array(z.number()).optional()
}).passthrough();
