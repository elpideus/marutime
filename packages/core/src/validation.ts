import { LIMITS, RESERVED_USERNAMES, SOCIAL_PLATFORMS, USERNAME_REGEX } from '@marutime/config';
import { z } from 'zod';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_REGEX, 'Use 3-24 lowercase letters, numbers or underscores')
  .refine((v) => !RESERVED_USERNAMES.has(v), 'This username is reserved');

export const emailSchema = z.email('Enter a valid email address').trim().toLowerCase().max(254);

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(200, 'That password is too long')
  .refine((v) => !/^(.)\1+$/.test(v), 'Choose a less repetitive password');

export const displayNameSchema = z.string().trim().min(1, 'Add a display name').max(LIMITS.displayNameMax);

export const bioSchema = z.string().trim().max(LIMITS.bioMax).nullable();

export const socialLinkSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS.map((p) => p.id) as [string, ...string[]]),
  url: z.url().max(300),
  label: z.string().trim().max(40).optional(),
});

export const socialLinksSchema = z.array(socialLinkSchema).max(LIMITS.socialLinksMax);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
