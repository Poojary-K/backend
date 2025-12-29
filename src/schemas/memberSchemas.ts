import { z } from 'zod';

/**
 * Schema for updating a member with input sanitization.
 */
export const updateMemberSchema = z
  .object({
    name: z.string().min(1).trim().optional(),
    email: z
      .string()
      .trim()
      .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'Invalid email address' })
      .optional(),
    phone: z.string().max(15).trim().optional(),
    isAdmin: z.boolean().optional(),
    is_admin: z.boolean().optional(),
  })
  .transform((data) => {
    const base: {
      name?: string;
      email?: string;
      phone?: string;
      isAdmin?: boolean;
    } = {};
    if (data.name !== undefined) {
      base.name = data.name;
    }
    if (data.email !== undefined) {
      base.email = data.email;
    }
    if (data.phone !== undefined) {
      base.phone = data.phone;
    }
    const isAdmin = data.isAdmin ?? data.is_admin;
    if (isAdmin !== undefined) {
      base.isAdmin = isAdmin;
    }
    return base;
  });
