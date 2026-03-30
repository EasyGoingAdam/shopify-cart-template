import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import { generateUniqueSlug } from "../utils/slug.server";
import TemplateForm from "../components/TemplateForm";
import type { TemplateFormData } from "../components/TemplateForm";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({ appUrl: process.env.SHOPIFY_APP_URL || "" });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();

  const title = (formData.get("title") as string)?.trim();

  if (!title) {
    return json({ errors: { title: "Title is required" } }, { status: 400 });
  }

  const lineItemsRaw = formData.get("lineItems") as string;
  const customAttributesRaw = formData.get("customAttributes") as string;

  let lineItems = [];
  let customAttributes = [];

  try {
    lineItems = JSON.parse(lineItemsRaw || "[]");
  } catch {
    return json(
      { errors: { lineItems: "Invalid line items data" } },
      { status: 400 }
    );
  }

  try {
    customAttributes = JSON.parse(customAttributesRaw || "[]");
  } catch {
    return json(
      { errors: { customAttributes: "Invalid custom attributes data" } },
      { status: 400 }
    );
  }

  const discountType = formData.get("discountType") as string;
  const discountValue = formData.get("discountValue") as string;
  const discountTitle = formData.get("discountTitle") as string;

  const discount =
    discountType !== "none" && discountValue
      ? JSON.stringify({
          type: discountType,
          value: parseFloat(discountValue),
          title: discountTitle || "Discount",
        })
      : null;

  const customerEmail = formData.get("customerEmail") as string;
  const customerFirstName = formData.get("customerFirstName") as string;
  const customerLastName = formData.get("customerLastName") as string;
  const customerPhone = formData.get("customerPhone") as string;

  const customer =
    customerEmail || customerFirstName || customerLastName || customerPhone
      ? JSON.stringify({
          email: customerEmail || null,
          firstName: customerFirstName || null,
          lastName: customerLastName || null,
          phone: customerPhone || null,
        })
      : null;

  const shippingFields = [
    "shippingFirstName",
    "shippingLastName",
    "shippingCompany",
    "shippingAddress1",
    "shippingAddress2",
    "shippingCity",
    "shippingProvince",
    "shippingZip",
    "shippingCountry",
    "shippingPhone",
  ];
  const shippingData: Record<string, string> = {};
  shippingFields.forEach((field) => {
    shippingData[field.replace("shipping", "").toLowerCase().replace(/^\w/, (c) => c)] =
      (formData.get(field) as string) || "";
  });
  const hasShipping = Object.values(shippingData).some((v) => v);

  const shippingAddress = hasShipping ? JSON.stringify(shippingData) : null;

  const paymentTermsName = formData.get("paymentTermsName") as string;
  const paymentTermsDueInDays = formData.get("paymentTermsDueInDays") as string;
  const paymentTerms =
    paymentTermsName
      ? JSON.stringify({
          paymentTermsName,
          ...(paymentTermsDueInDays
            ? { dueInDays: parseInt(paymentTermsDueInDays, 10) }
            : {}),
        })
      : null;

  const slug = await generateUniqueSlug();

  await db.cartTemplate.create({
    data: {
      shop,
      slug,
      title,
      description: (formData.get("description") as string) || null,
      lineItems: JSON.stringify(lineItems),
      discount,
      customer,
      shippingAddress,
      shippingLine: (formData.get("shippingLine") as string) || null,
      note: (formData.get("note") as string) || null,
      tags: (formData.get("tags") as string) || null,
      taxExempt: formData.get("taxExempt") === "true",
      customAttributes: JSON.stringify(customAttributes),
      paymentTerms,
      currency: (formData.get("currency") as string) || "USD",
      isActive: formData.get("isActive") === "true",
    },
  });

  return redirect("/app?created=1");
};

export default function NewTemplate() {
  const { appUrl } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <TemplateForm
      isNew
      appUrl={appUrl}
      errors={(actionData as { errors?: Record<string, string> })?.errors}
    />
  );
}
