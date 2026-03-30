import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { unauthenticated } from "../shopify.server";
import { db } from "../db.server";
import { createDraftOrder } from "../utils/draft-order.server";
import type {
  LineItem,
  TemplateDiscount,
  CustomerInfo,
  ShippingAddress,
  CustomAttribute,
} from "../utils/draft-order.server";

/**
 * Public route — no Shopify session required from the visitor.
 * Looks up the template, uses the shop's stored offline access token
 * to create a Draft Order, then redirects to the invoice URL.
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const slug = params.slug as string;

  // 1. Find the template
  const template = await db.cartTemplate.findUnique({ where: { slug } });

  if (!template) {
    return json(
      { error: "This cart link is invalid or has been removed.", code: 404 },
      { status: 404 }
    );
  }

  if (!template.isActive) {
    return json(
      {
        error: "This cart link has been deactivated by the store owner.",
        code: 410,
      },
      { status: 410 }
    );
  }

  // 2. Get an admin API client using the shop's stored offline access token
  let admin: { graphql: (query: string, options?: { variables?: unknown }) => Promise<{ json: () => Promise<unknown> }> };
  try {
    const result = await unauthenticated.admin(template.shop);
    admin = result.admin;
  } catch (err) {
    console.error("Failed to get admin client for shop:", template.shop, err);
    return json(
      {
        error:
          "Unable to connect to the store. The app may need to be re-installed.",
        code: 500,
      },
      { status: 500 }
    );
  }

  // 3. Parse template data
  let lineItems: LineItem[] = [];
  let discount: TemplateDiscount | null = null;
  let customer: CustomerInfo | null = null;
  let shippingAddress: ShippingAddress | null = null;
  let customAttributes: CustomAttribute[] = [];
  let paymentTerms: { paymentTermsName?: string; dueInDays?: number } | null = null;

  try {
    lineItems = JSON.parse(template.lineItems || "[]");
  } catch {
    /* use empty array */
  }
  try {
    discount = template.discount ? JSON.parse(template.discount) : null;
  } catch {
    /* ignore */
  }
  try {
    customer = template.customer ? JSON.parse(template.customer) : null;
  } catch {
    /* ignore */
  }
  try {
    shippingAddress = template.shippingAddress
      ? JSON.parse(template.shippingAddress)
      : null;
  } catch {
    /* ignore */
  }
  try {
    customAttributes = JSON.parse(template.customAttributes || "[]");
  } catch {
    /* ignore */
  }
  try {
    paymentTerms = template.paymentTerms
      ? JSON.parse(template.paymentTerms)
      : null;
  } catch {
    /* ignore */
  }

  // 4. Create the Draft Order
  let draftOrder: { id: string; name: string; invoiceUrl: string };
  try {
    draftOrder = await createDraftOrder(admin, {
      lineItems,
      discount,
      customer,
      shippingAddress,
      shippingLine: template.shippingLine,
      note: template.note,
      tags: template.tags,
      taxExempt: template.taxExempt,
      customAttributes,
      currency: template.currency,
      paymentTerms,
    });
  } catch (err) {
    console.error("Failed to create draft order:", err);
    const message =
      err instanceof Error ? err.message : "Unknown error occurred";
    return json(
      {
        error: `Failed to create the draft order: ${message}`,
        code: 500,
      },
      { status: 500 }
    );
  }

  // 5. Record the usage
  const visitorIp =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    null;

  await db.$transaction([
    db.templateUsage.create({
      data: {
        templateId: template.id,
        draftOrderId: draftOrder.id,
        draftOrderName: draftOrder.name,
        draftOrderUrl: draftOrder.invoiceUrl,
        visitorIp,
      },
    }),
    db.cartTemplate.update({
      where: { id: template.id },
      data: { usageCount: { increment: 1 } },
    }),
  ]);

  // 6. Redirect to the Shopify invoice URL
  return redirect(draftOrder.invoiceUrl);
};

/**
 * Fallback render — shown only if the redirect doesn't happen
 * (i.e., an error occurred and we returned JSON instead of redirecting).
 */
export default function CartSlug() {
  const data = useLoaderData<{ error: string; code: number }>();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Cart Link Error</title>
        <style>{`
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #f6f6f7;
          }
          .card {
            background: white;
            border-radius: 12px;
            padding: 2rem 2.5rem;
            max-width: 480px;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.08);
          }
          h1 { color: #202223; font-size: 1.25rem; margin-bottom: 0.5rem; }
          p { color: #6d7175; font-size: 0.9rem; }
          .code { color: #bf0711; font-size: 0.75rem; margin-top: 1rem; }
        `}</style>
      </head>
      <body>
        <div className="card">
          <h1>
            {data?.code === 404
              ? "Link not found"
              : data?.code === 410
                ? "Link deactivated"
                : "Something went wrong"}
          </h1>
          <p>{data?.error || "An unexpected error occurred."}</p>
          <p className="code">Error {data?.code}</p>
        </div>
      </body>
    </html>
  );
}
