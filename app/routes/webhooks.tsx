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

    case "CUSTOMERS_DATA_REQUEST":
      // GDPR: Respond to customer data requests
      // In a production app, you would look up and return all customer data
      console.log("Customer data request for shop:", shop, "payload:", payload);
      break;

    case "CUSTOMERS_REDACT":
      // GDPR: Redact customer data
      console.log("Customer redact request for shop:", shop, "payload:", payload);
      break;

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
