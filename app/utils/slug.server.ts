import { nanoid } from "nanoid";
import { db } from "../db.server";

/**
 * Generate a unique slug for a cart template.
 * Uses nanoid for URL-safe random strings.
 */
export async function generateUniqueSlug(): Promise<string> {
  let slug: string;
  let exists = true;

  // Loop until we find a slug that doesn't exist
  while (exists) {
    slug = nanoid(10); // 10-char URL-safe slug
    const existing = await db.cartTemplate.findUnique({ where: { slug } });
    exists = !!existing;
  }

  return slug!;
}
