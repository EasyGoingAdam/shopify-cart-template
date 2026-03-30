import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import { generateUniqueSlug } from "../utils/slug.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const id = params.id as string;

  const original = await db.cartTemplate.findFirst({ where: { id, shop } });
  if (!original) {
    throw new Response("Template not found", { status: 404 });
  }

  const slug = await generateUniqueSlug();

  const duplicate = await db.cartTemplate.create({
    data: {
      shop,
      slug,
      title: `${original.title} (copy)`,
      description: original.description,
      lineItems: original.lineItems,
      discount: original.discount,
      customer: original.customer,
      shippingAddress: original.shippingAddress,
      shippingLine: original.shippingLine,
      note: original.note,
      tags: original.tags,
      taxExempt: original.taxExempt,
      customAttributes: original.customAttributes,
      paymentTerms: original.paymentTerms,
      currency: original.currency,
      isActive: false, // duplicates start inactive
    },
  });

  return redirect(`/app/templates/${duplicate.id}/edit`);
};

export default function DuplicateTemplate() {
  return null;
}
