import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, payload } = await authenticate.webhook(request);

  switch (topic) {
    case "APP_UNINSTALLED":
      // Clean up sessions for this shop when the app is uninstalled
      if (session) {
        await db.session.deleteMany({ where: { shop } });
      }
      break;

    case "CUSTOMERS_DATA_REQUEST": {
      // GDPR: Customer requested their data. Look up any usage records tied to their email.
      const dataPayload = payload as { customer?: { email?: string }; orders_requested?: string[] };
      const email = dataPayload?.customer?.email;
      if (email && shop) {
        const usages = await db.templateUsage.findMany({
          where: { template: { shop } },
          select: { id: true, draftOrderId: true, draftOrderName: true, createdAt: true },
        });
        console.log(`[GDPR] Data request for ${email} on ${shop}: ${usages.length} usage records`);
      }
      break;
    }

    case "CUSTOMERS_REDACT": {
      // GDPR: Delete any personally identifiable data for this customer.
      // This app stores visitor IPs in templateUsage — redact them.
      const redactPayload = payload as { customer?: { email?: string } };
      const redactEmail = redactPayload?.customer?.email;
      if (redactEmail && shop) {
        // We don't store email on usages, but clear any IP addresses tied to this shop's templates
        await db.templateUsage.updateMany({
          where: { template: { shop } },
          data: { visitorIp: null },
        });
        console.log(`[GDPR] Customer redact for ${redactEmail} on ${shop}: visitor IPs cleared`);
      }
      break;
    }

    case "SHOP_REDACT":
      // GDPR: Shop requested data deletion — remove all their templates
      await db.cartTemplate.deleteMany({ where: { shop } });
      await db.session.deleteMany({ where: { shop } });
      console.log("Shop data redacted for:", shop);
      break;

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  return new Response(null, { status: 200 });
};
