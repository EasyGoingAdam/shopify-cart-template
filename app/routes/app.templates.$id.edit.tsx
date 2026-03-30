import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";
import TemplateForm from "../components/TemplateForm";
import type { TemplateFormData } from "../components/TemplateForm";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const id = params.id as string;

  const template = await db.cartTemplate.findFirst({
    where: { id, shop },
  });

  if (!template) {
    throw new Response("Template not found", { status: 404 });
  }

  return json({
    template,
    appUrl: process.env.SHOPIFY_APP_URL || "",
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const id = params.id as string;

  const existing = await db.cartTemplate.findFirst({ where: { id, shop } });
  if (!existing) {
    throw new Response("Template not found", { status: 404 });
  }

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
    return json({ errors: { lineItems: "Invalid line items data" } }, { status: 400 });
  }

  try {
    customAttributes = JSON.parse(customAttributesRaw || "[]");
  } catch {
    return json({ errors: { customAttributes: "Invalid custom attributes data" } }, { status: 400 });
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

  const shippingAddress = buildShippingAddress(formData);

  const paymentTermsName = formData.get("paymentTermsName") as string;
  const paymentTermsDueInDays = formData.get("paymentTermsDueInDays") as string;
  const paymentTerms = paymentTermsName
    ? JSON.stringify({
        paymentTermsName,
        ...(paymentTermsDueInDays
          ? { dueInDays: parseInt(paymentTermsDueInDays, 10) }
          : {}),
      })
    : null;

  await db.cartTemplate.update({
    where: { id },
    data: {
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

  return redirect("/app");
};

function buildShippingAddress(formData: FormData): string | null {
  const fields: Record<string, string> = {
    firstName: (formData.get("shippingFirstName") as string) || "",
    lastName: (formData.get("shippingLastName") as string) || "",
    company: (formData.get("shippingCompany") as string) || "",
    address1: (formData.get("shippingAddress1") as string) || "",
    address2: (formData.get("shippingAddress2") as string) || "",
    city: (formData.get("shippingCity") as string) || "",
    province: (formData.get("shippingProvince") as string) || "",
    zip: (formData.get("shippingZip") as string) || "",
    country: (formData.get("shippingCountry") as string) || "",
    phone: (formData.get("shippingPhone") as string) || "",
  };
  return Object.values(fields).some((v) => v)
    ? JSON.stringify(fields)
    : null;
}

export default function EditTemplate() {
  const { template, appUrl } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  // Parse JSON fields back to objects for the form
  const lineItems = (() => {
    try {
      return JSON.parse(template.lineItems || "[]");
    } catch {
      return [];
    }
  })();

  const customer = (() => {
    try {
      return template.customer ? JSON.parse(template.customer) : null;
    } catch {
      return null;
    }
  })();

  const shipping = (() => {
    try {
      return template.shippingAddress ? JSON.parse(template.shippingAddress) : null;
    } catch {
      return null;
    }
  })();

  const discount = (() => {
    try {
      return template.discount ? JSON.parse(template.discount) : null;
    } catch {
      return null;
    }
  })();

  const customAttributes = (() => {
    try {
      return JSON.parse(template.customAttributes || "[]");
    } catch {
      return [];
    }
  })();

  const paymentTerms = (() => {
    try {
      return template.paymentTerms ? JSON.parse(template.paymentTerms) : null;
    } catch {
      return null;
    }
  })();

  const initialData: Partial<TemplateFormData> = {
    title: template.title,
    description: template.description || "",
    lineItems: lineItems.map((item: Record<string, unknown>) => ({
      _key: crypto.randomUUID(),
      ...item,
    })),
    discountType: discount ? (discount.type as TemplateFormData["discountType"]) : "none",
    discountValue: discount ? String(discount.value) : "",
    discountTitle: discount?.title || "",
    customerEmail: customer?.email || "",
    customerFirstName: customer?.firstName || "",
    customerLastName: customer?.lastName || "",
    customerPhone: customer?.phone || "",
    shippingFirstName: shipping?.firstName || "",
    shippingLastName: shipping?.lastName || "",
    shippingCompany: shipping?.company || "",
    shippingAddress1: shipping?.address1 || "",
    shippingAddress2: shipping?.address2 || "",
    shippingCity: shipping?.city || "",
    shippingProvince: shipping?.province || "",
    shippingZip: shipping?.zip || "",
    shippingCountry: shipping?.country || "",
    shippingPhone: shipping?.phone || "",
    shippingLine: template.shippingLine || "",
    note: template.note || "",
    tags: template.tags || "",
    taxExempt: template.taxExempt,
    customAttributes,
    paymentTermsName: paymentTerms?.paymentTermsName || "",
    paymentTermsDueInDays: paymentTerms?.dueInDays ? String(paymentTerms.dueInDays) : "",
    currency: template.currency || "USD",
    isActive: template.isActive,
  };

  return (
    <TemplateForm
      isNew={false}
      templateId={template.id}
      slug={template.slug}
      appUrl={appUrl}
      usageCount={template.usageCount}
      initialData={initialData}
      errors={(actionData as { errors?: Record<string, string> })?.errors}
    />
  );
}
