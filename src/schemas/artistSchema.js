import { z } from 'zod';

/**
 * Schema for Artist UI Form (React Hook Form)
 */
export const artistFormSchema = z.object({
  name: z.string().trim().min(1, 'กรุณาระบุชื่อศิลปิน'),
  agency: z.string().trim().optional().default(''),
  fandom_name: z.string().trim().optional().default(''),
  fandom_color: z.string().trim().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'รหัสสีไม่ถูกต้อง (เช่น #ec4899)').optional().or(z.literal('')).default('#ec4899'),
  birth_date: z.string().optional().default(''),
  debut_date: z.string().optional().default(''),
  bio: z.string().trim().optional().default(''),
  social_links: z.object({
    twitter: z.string().trim().optional().default(''),
    instagram: z.string().trim().optional().default(''),
    tiktok: z.string().trim().optional().default(''),
    weibo: z.string().trim().optional().default('')
  }).optional().default({}),
  favorite_flowers: z.string().trim().optional().default(''),
  avatar_url: z.string().trim().optional().default(''),
  notes: z.string().trim().optional().default('')
});

/**
 * Schema for Artist Database Payload (syncService)
 */
export const artistPayloadSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'ชื่อศิลปินต้องไม่เว้นว่าง'),
  agency: z.string().nullable().optional().default(''),
  fandom_name: z.string().nullable().optional().default(''),
  fandom_color: z.string().nullable().optional().default('#ec4899'),
  birth_date: z.string().nullable().optional(),
  debut_date: z.string().nullable().optional(),
  bio: z.string().nullable().optional().default(''),
  social_links: z.record(z.any()).nullable().optional().default({}),
  favorite_flowers: z.string().nullable().optional().default(''),
  avatar_url: z.string().nullable().optional().default(''),
  notes: z.string().nullable().optional().default('')
}).passthrough();
