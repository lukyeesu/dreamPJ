import { z } from 'zod';

/**
 * Schema for Staff UI Form (React Hook Form)
 */
export const staffFormSchema = z.object({
  username: z.string().trim().min(2, 'ชื่อผู้ใช้ต้องมีอย่างน้อย 2 ตัวอักษร'),
  password: z.string().min(1, 'กรุณาระบุรหัสผ่าน'),
  confirmPassword: z.string().min(1, 'กรุณายืนยันรหัสผ่าน'),
  staff_code: z.string().trim().optional().default(''),
  role: z.string().default('technician'),
  citizen_id: z.string().trim().optional().default(''),
  birth_date: z.string().optional().default(''),
  phone: z.string().trim().optional().default(''),
  name: z.string().trim().optional().default(''),
  nickname: z.string().trim().optional().default(''),
  email: z.string().trim().email('รูปแบบอีเมลไม่ถูกต้อง').optional().or(z.literal('')).default(''),
  emergency_contact: z.string().trim().optional().default(''),
  address: z.string().trim().optional().default(''),
  avatar_url: z.string().trim().optional().default(''),
  is_active: z.boolean().default(true)
}).refine(data => data.password === data.confirmPassword, {
  message: 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน',
  path: ['confirmPassword']
});

/**
 * Schema for Staff Database / SyncService Payload
 */
export const staffPayloadSchema = z.object({
  id: z.string().optional(),
  staff_code: z.string().optional(),
  username: z.string().trim().min(1, 'ต้องระบุชื่อผู้ใช้ (Username)'),
  password: z.string().optional().default('1'),
  role: z.string().default('technician'),
  role_code: z.string().optional(),
  role_label: z.string().optional(),
  name: z.string().nullable().optional(),
  nickname: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  citizen_id: z.string().nullable().optional(),
  birth_date: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  emergency_contact: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  is_active: z.boolean().default(true)
}).passthrough();
