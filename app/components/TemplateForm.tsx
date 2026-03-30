import { useState, useCallback } from "react";
import { useSubmit, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  Button,
  Banner,
  Text,
  InlineStack,
  BlockStack,
  Box,
} from "@shopify/polaris";
import { PlusIcon, DeleteIcon } from "@shopify/polaris-icons";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LineItem {
  _key: string; // client-side unique key
  variantId?: string;
  variantTitle?: string;
  productTitle?: string;
  title?: string; // custom title (when no variantId)
  quantity: number;
  price?: string; // price override
  sku?: string;
  taxable?: boolean;
  requiresShipping?: boolean;
  customAttributes: Array<{ key: string; value: string }>;
}

export interface TemplateFormData {
  title: string;
  description: string;
  lineItems: LineItem[];
  discountType: "none" | "percentage" | "fixed_amount";
  discountValue: string;
  discountTitle: string;
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  shippingFirstName: string;
  shippingLastName: string;
  shippingCompany: string;
  shippingAddress1: string;
  shippingAddress2: string;
  shippingCity: string;
  shippingProvince: string;
  shippingZip: string;
  shippingCountry: string;
  shippingPhone: string;
  shippingLine: string;
  note: string;
  tags: string;
  taxExempt: boolean;
  customAttributes: Array<{ key: string; value: string }>;
  paymentTermsName: string;
  paymentTermsDueInDays: string;
  currency: string;
  isActive: boolean;
}

interface Props {
  initialData?: Partial<TemplateFormData>;
  templateId?: string;
  appUrl?: string;
  slug?: string;
  usageCount?: number;
  isNew?: boolean;
  errors?: Record<string, string>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function newLineItem(): LineItem {
  return {
    _key: crypto.randomUUID(),
    quantity: 1,
    customAttributes: [],
  };
}

function newCustomAttribute() {
  return { key: "", value: "" };
}

const CURRENCIES = [
  "USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "HKD", "SGD", "SEK",
  "NOK", "DKK", "NZD", "MXN", "BRL", "INR", "ZAR", "AED", "SAR",
];

const PAYMENT_TERMS = [
  { label: "None", value: "" },
  { label: "Net 7", value: "NET_7" },
  { label: "Net 15", value: "NET_15" },
  { label: "Net 30", value: "NET_30" },
  { label: "Net 45", value: "NET_45" },
  { label: "Net 60", value: "NET_60" },
  { label: "Fixed date", value: "FIXED" },
  { label: "Due on receipt", value: "RECEIPT" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function TemplateForm({
  initialData,
  templateId,
  appUrl,
  slug,
  usageCount,
  isNew = true,
  errors = {},
}: Props) {
  const submit = useSubmit();
  const navigate = useNavigate();

  const defaultData: TemplateFormData = {
    title: "",
    description: "",
    lineItems: [newLineItem()],
    discountType: "none",
    discountValue: "",
    discountTitle: "",
    customerEmail: "",
    customerFirstName: "",
    customerLastName: "",
    customerPhone: "",
    shippingFirstName: "",
    shippingLastName: "",
    shippingCompany: "",
    shippingAddress1: "",
    shippingAddress2: "",
    shippingCity: "",
    shippingProvince: "",
    shippingZip: "",
    shippingCountry: "",
    shippingPhone: "",
    shippingLine: "",
    note: "",
    tags: "",
    taxExempt: false,
    customAttributes: [],
    paymentTermsName: "",
    paymentTermsDueInDays: "",
    currency: "USD",
    isActive: true,
    ...initialData,
  };

  const [form, setForm] = useState<TemplateFormData>(defaultData);
  const [pickingForIndex, setPickingForIndex] = useState<number | null>(null);

  const set = useCallback(
    <K extends keyof TemplateFormData>(key: K, value: TemplateFormData[K]) =>
      setForm((f) => ({ ...f, [key]: value })),
    []
  );

  // ── Line Items ──────────────────────────────────────────────────────────

  const updateLineItem = (index: number, patch: Partial<LineItem>) =>
    setForm((f) => {
      const items = [...f.lineItems];
      items[index] = { ...items[index], ...patch };
      return { ...f, lineItems: items };
    });

  const removeLineItem = (index: number) =>
    setForm((f) => ({
      ...f,
      lineItems: f.lineItems.filter((_, i) => i !== index),
    }));

  const addLineItem = () =>
    setForm((f) => ({ ...f, lineItems: [...f.lineItems, newLineItem()] }));

  const openProductPicker = async (index: number) => {
    setPickingForIndex(index);
    try {
      // App Bridge v4 imperative resource picker API
      const selected = await (shopify as unknown as {
        resourcePicker: (opts: {
          type: string;
          action: string;
          multiple: boolean;
          selectionIds?: Array<{ id: string }>;
        }) => Promise<Array<{ variants: Array<{ id: string; title: string; price: string; sku: string }>; title: string }> | undefined>;
      }).resourcePicker({ type: "variant", action: "select", multiple: false });
      if (!selected || !selected.length) { setPickingForIndex(null); return; }
      const variant = selected[0].variants ? selected[0].variants[0] : (selected[0] as unknown as { id: string; title: string; price: string; sku: string; product: { title: string } });
      const productTitle = selected[0].variants ? selected[0].title : (selected[0] as unknown as { product: { title: string } }).product?.title || "";
      updateLineItem(index, {
        variantId: (variant as { id: string }).id,
        variantTitle: (variant as { title: string }).title,
        productTitle,
        price: (variant as { price: string }).price,
        sku: (variant as { sku?: string }).sku || "",
      });
    } catch {
      // user cancelled or error
    }
    setPickingForIndex(null);
  };

  // ── Custom attributes on line item ────────────────────────────────────

  const addLineItemAttribute = (lineIndex: number) =>
    updateLineItem(lineIndex, {
      customAttributes: [
        ...form.lineItems[lineIndex].customAttributes,
        { key: "", value: "" },
      ],
    });

  const updateLineItemAttribute = (
    lineIndex: number,
    attrIndex: number,
    patch: { key?: string; value?: string }
  ) => {
    const attrs = [...form.lineItems[lineIndex].customAttributes];
    attrs[attrIndex] = { ...attrs[attrIndex], ...patch };
    updateLineItem(lineIndex, { customAttributes: attrs });
  };

  const removeLineItemAttribute = (lineIndex: number, attrIndex: number) => {
    const attrs = form.lineItems[lineIndex].customAttributes.filter(
      (_, i) => i !== attrIndex
    );
    updateLineItem(lineIndex, { customAttributes: attrs });
  };

  // ── Order-level custom attributes ────────────────────────────────────

  const addOrderAttribute = () =>
    set("customAttributes", [...form.customAttributes, newCustomAttribute()]);

  const updateOrderAttribute = (
    index: number,
    patch: { key?: string; value?: string }
  ) => {
    const attrs = [...form.customAttributes];
    attrs[index] = { ...attrs[index], ...patch };
    set("customAttributes", attrs);
  };

  const removeOrderAttribute = (index: number) =>
    set(
      "customAttributes",
      form.customAttributes.filter((_, i) => i !== index)
    );

  // ── Submit ────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append("title", form.title);
    formData.append("description", form.description);
    formData.append("lineItems", JSON.stringify(form.lineItems));
    formData.append("discountType", form.discountType);
    formData.append("discountValue", form.discountValue);
    formData.append("discountTitle", form.discountTitle);
    formData.append("customerEmail", form.customerEmail);
    formData.append("customerFirstName", form.customerFirstName);
    formData.append("customerLastName", form.customerLastName);
    formData.append("customerPhone", form.customerPhone);
    formData.append("shippingFirstName", form.shippingFirstName);
    formData.append("shippingLastName", form.shippingLastName);
    formData.append("shippingCompany", form.shippingCompany);
    formData.append("shippingAddress1", form.shippingAddress1);
    formData.append("shippingAddress2", form.shippingAddress2);
    formData.append("shippingCity", form.shippingCity);
    formData.append("shippingProvince", form.shippingProvince);
    formData.append("shippingZip", form.shippingZip);
    formData.append("shippingCountry", form.shippingCountry);
    formData.append("shippingPhone", form.shippingPhone);
    formData.append("shippingLine", form.shippingLine);
    formData.append("note", form.note);
    formData.append("tags", form.tags);
    formData.append("taxExempt", form.taxExempt ? "true" : "false");
    formData.append("customAttributes", JSON.stringify(form.customAttributes));
    formData.append("paymentTermsName", form.paymentTermsName);
    formData.append("paymentTermsDueInDays", form.paymentTermsDueInDays);
    formData.append("currency", form.currency);
    formData.append("isActive", form.isActive ? "true" : "false");
    submit(formData, { method: "post" });
  };

  const shareUrl = slug ? `${appUrl}/cart/${slug}` : null;

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <Page
        title={isNew ? "New Cart Template" : form.title || "Edit Template"}
        backAction={{ content: "Templates", onAction: () => navigate("/app") }}
        primaryAction={{
          content: isNew ? "Create template" : "Save changes",
          onAction: handleSubmit,
        }}
        secondaryActions={
          !isNew && shareUrl
            ? [
                {
                  content: "Copy share link",
                  onAction: () => {
                    navigator.clipboard.writeText(shareUrl).then(() =>
                      shopify.toast.show("Link copied!")
                    );
                  },
                  disabled: !form.isActive,
                },
              ]
            : undefined
        }
      >
        <Layout>
          {/* Errors */}
          {Object.keys(errors).length > 0 && (
            <Layout.Section>
              <Banner tone="critical" title="Please fix the following errors:">
                <ul>
                  {Object.entries(errors).map(([k, v]) => (
                    <li key={k}>{v}</li>
                  ))}
                </ul>
              </Banner>
            </Layout.Section>
          )}

          {/* Share link preview (edit mode) */}
          {!isNew && shareUrl && (
            <Layout.Section>
              <Banner
                tone={form.isActive ? "success" : "warning"}
                title={
                  form.isActive
                    ? "This template is active"
                    : "This template is inactive"
                }
              >
                <BlockStack gap="100">
                  <Text as="p">
                    Shareable link:{" "}
                    <strong>
                      <code>{shareUrl}</code>
                    </strong>
                  </Text>
                  <Text as="p" tone="subdued">
                    Used {usageCount ?? 0} time{usageCount !== 1 ? "s" : ""}
                  </Text>
                </BlockStack>
              </Banner>
            </Layout.Section>
          )}

          {/* ── Basic Info ──────────────────────────────────────────── */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Template details
                </Text>
                <FormLayout>
                  <TextField
                    label="Title"
                    value={form.title}
                    onChange={(v) => set("title", v)}
                    autoComplete="off"
                    error={errors.title}
                    requiredIndicator
                    placeholder="e.g. VIP Welcome Package"
                  />
                  <TextField
                    label="Description"
                    value={form.description}
                    onChange={(v) => set("description", v)}
                    autoComplete="off"
                    multiline={2}
                    placeholder="Internal description (not shown to customers)"
                  />
                  <InlineStack gap="400">
                    <Select
                      label="Currency"
                      options={CURRENCIES.map((c) => ({ label: c, value: c }))}
                      value={form.currency}
                      onChange={(v) => set("currency", v)}
                    />
                    <Checkbox
                      label="Template is active (shareable link works)"
                      checked={form.isActive}
                      onChange={(v) => set("isActive", v)}
                    />
                  </InlineStack>
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* ── Line Items ──────────────────────────────────────────── */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h2">
                    Line items
                  </Text>
                  <Button icon={PlusIcon} onClick={addLineItem}>
                    Add item
                  </Button>
                </InlineStack>

                {form.lineItems.length === 0 ? (
                  <Banner>
                    <p>Add at least one line item to your template.</p>
                  </Banner>
                ) : (
                  <BlockStack gap="400">
                    {form.lineItems.map((item, idx) => (
                      <Box
                        key={item._key}
                        padding="400"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <BlockStack gap="300">
                          <InlineStack align="space-between" blockAlign="center">
                            <Text variant="bodyMd" fontWeight="semibold" as="span">
                              Item {idx + 1}
                              {item.productTitle
                                ? ` — ${item.productTitle}${item.variantTitle && item.variantTitle !== "Default Title" ? ` / ${item.variantTitle}` : ""}`
                                : ""}
                            </Text>
                            <Button
                              icon={DeleteIcon}
                              tone="critical"
                              variant="plain"
                              onClick={() => removeLineItem(idx)}
                              accessibilityLabel="Remove item"
                            />
                          </InlineStack>

                          <FormLayout>
                            <FormLayout.Group>
                              {/* Product picker OR custom title */}
                              <TextField
                                label="Product / Variant ID"
                                value={item.variantId || ""}
                                onChange={(v) =>
                                  updateLineItem(idx, { variantId: v })
                                }
                                autoComplete="off"
                                placeholder="gid://shopify/ProductVariant/123..."
                                connectedRight={
                                  <Button
                                    onClick={() => openProductPicker(idx)}
                                  >
                                    Browse
                                  </Button>
                                }
                              />
                              <TextField
                                label="Custom title (if no variant)"
                                value={item.title || ""}
                                onChange={(v) =>
                                  updateLineItem(idx, { title: v })
                                }
                                autoComplete="off"
                                placeholder="e.g. Custom Service Fee"
                                helpText="Only used when no variant ID is set"
                              />
                            </FormLayout.Group>

                            <FormLayout.Group>
                              <TextField
                                label="Quantity"
                                type="number"
                                value={String(item.quantity)}
                                onChange={(v) =>
                                  updateLineItem(idx, {
                                    quantity: parseInt(v, 10) || 1,
                                  })
                                }
                                autoComplete="off"
                                min={1}
                              />
                              <TextField
                                label="Price override"
                                type="number"
                                value={item.price || ""}
                                onChange={(v) =>
                                  updateLineItem(idx, { price: v })
                                }
                                autoComplete="off"
                                placeholder="Leave blank to use product price"
                                prefix={form.currency}
                              />
                              <TextField
                                label="SKU"
                                value={item.sku || ""}
                                onChange={(v) =>
                                  updateLineItem(idx, { sku: v })
                                }
                                autoComplete="off"
                              />
                            </FormLayout.Group>

                            <FormLayout.Group>
                              <Checkbox
                                label="Taxable"
                                checked={item.taxable ?? true}
                                onChange={(v) =>
                                  updateLineItem(idx, { taxable: v })
                                }
                              />
                              <Checkbox
                                label="Requires shipping"
                                checked={item.requiresShipping ?? true}
                                onChange={(v) =>
                                  updateLineItem(idx, {
                                    requiresShipping: v,
                                  })
                                }
                              />
                            </FormLayout.Group>
                          </FormLayout>

                          {/* Per-line custom attributes */}
                          <BlockStack gap="200">
                            <InlineStack align="space-between">
                              <Text variant="bodySm" fontWeight="semibold" as="span">
                                Line item custom attributes
                              </Text>
                              <Button
                                variant="plain"
                                size="slim"
                                onClick={() => addLineItemAttribute(idx)}
                              >
                                + Add attribute
                              </Button>
                            </InlineStack>
                            {item.customAttributes.map((attr, aIdx) => (
                              <InlineStack key={aIdx} gap="200" blockAlign="end">
                                <Box width="40%">
                                  <TextField
                                    label="Key"
                                    labelHidden
                                    value={attr.key}
                                    onChange={(v) =>
                                      updateLineItemAttribute(idx, aIdx, {
                                        key: v,
                                      })
                                    }
                                    autoComplete="off"
                                    placeholder="Key"
                                  />
                                </Box>
                                <Box width="40%">
                                  <TextField
                                    label="Value"
                                    labelHidden
                                    value={attr.value}
                                    onChange={(v) =>
                                      updateLineItemAttribute(idx, aIdx, {
                                        value: v,
                                      })
                                    }
                                    autoComplete="off"
                                    placeholder="Value"
                                  />
                                </Box>
                                <Button
                                  icon={DeleteIcon}
                                  variant="plain"
                                  tone="critical"
                                  onClick={() =>
                                    removeLineItemAttribute(idx, aIdx)
                                  }
                                  accessibilityLabel="Remove attribute"
                                />
                              </InlineStack>
                            ))}
                          </BlockStack>
                        </BlockStack>
                      </Box>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* ── Discount ────────────────────────────────────────────── */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Discount
                </Text>
                <FormLayout>
                  <Select
                    label="Discount type"
                    options={[
                      { label: "No discount", value: "none" },
                      { label: "Percentage off", value: "percentage" },
                      { label: "Fixed amount off", value: "fixed_amount" },
                    ]}
                    value={form.discountType}
                    onChange={(v) =>
                      set("discountType", v as TemplateFormData["discountType"])
                    }
                  />
                  {form.discountType !== "none" && (
                    <FormLayout.Group>
                      <TextField
                        label={
                          form.discountType === "percentage"
                            ? "Discount (%)"
                            : `Discount amount (${form.currency})`
                        }
                        type="number"
                        value={form.discountValue}
                        onChange={(v) => set("discountValue", v)}
                        autoComplete="off"
                        suffix={form.discountType === "percentage" ? "%" : ""}
                        min={0}
                      />
                      <TextField
                        label="Discount title"
                        value={form.discountTitle}
                        onChange={(v) => set("discountTitle", v)}
                        autoComplete="off"
                        placeholder="e.g. VIP discount"
                      />
                    </FormLayout.Group>
                  )}
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* ── Customer Info ────────────────────────────────────────── */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Customer info (optional pre-fill)
                </Text>
                <FormLayout>
                  <TextField
                    label="Email"
                    type="email"
                    value={form.customerEmail}
                    onChange={(v) => set("customerEmail", v)}
                    autoComplete="email"
                    placeholder="customer@example.com"
                  />
                  <FormLayout.Group>
                    <TextField
                      label="First name"
                      value={form.customerFirstName}
                      onChange={(v) => set("customerFirstName", v)}
                      autoComplete="given-name"
                    />
                    <TextField
                      label="Last name"
                      value={form.customerLastName}
                      onChange={(v) => set("customerLastName", v)}
                      autoComplete="family-name"
                    />
                    <TextField
                      label="Phone"
                      type="tel"
                      value={form.customerPhone}
                      onChange={(v) => set("customerPhone", v)}
                      autoComplete="tel"
                    />
                  </FormLayout.Group>
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* ── Shipping ─────────────────────────────────────────────── */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Shipping
                </Text>
                <FormLayout>
                  <FormLayout.Group>
                    <TextField
                      label="First name"
                      value={form.shippingFirstName}
                      onChange={(v) => set("shippingFirstName", v)}
                      autoComplete="shipping given-name"
                    />
                    <TextField
                      label="Last name"
                      value={form.shippingLastName}
                      onChange={(v) => set("shippingLastName", v)}
                      autoComplete="shipping family-name"
                    />
                  </FormLayout.Group>
                  <TextField
                    label="Company"
                    value={form.shippingCompany}
                    onChange={(v) => set("shippingCompany", v)}
                    autoComplete="shipping organization"
                  />
                  <TextField
                    label="Address line 1"
                    value={form.shippingAddress1}
                    onChange={(v) => set("shippingAddress1", v)}
                    autoComplete="shipping address-line1"
                  />
                  <TextField
                    label="Address line 2"
                    value={form.shippingAddress2}
                    onChange={(v) => set("shippingAddress2", v)}
                    autoComplete="shipping address-line2"
                  />
                  <FormLayout.Group>
                    <TextField
                      label="City"
                      value={form.shippingCity}
                      onChange={(v) => set("shippingCity", v)}
                      autoComplete="shipping address-level2"
                    />
                    <TextField
                      label="State / Province"
                      value={form.shippingProvince}
                      onChange={(v) => set("shippingProvince", v)}
                      autoComplete="shipping address-level1"
                    />
                    <TextField
                      label="ZIP / Postal code"
                      value={form.shippingZip}
                      onChange={(v) => set("shippingZip", v)}
                      autoComplete="shipping postal-code"
                    />
                  </FormLayout.Group>
                  <FormLayout.Group>
                    <TextField
                      label="Country code"
                      value={form.shippingCountry}
                      onChange={(v) => set("shippingCountry", v)}
                      autoComplete="shipping country"
                      placeholder="US"
                      helpText="2-letter ISO country code"
                    />
                    <TextField
                      label="Phone"
                      type="tel"
                      value={form.shippingPhone}
                      onChange={(v) => set("shippingPhone", v)}
                      autoComplete="shipping tel"
                    />
                  </FormLayout.Group>
                  <TextField
                    label="Preferred shipping method"
                    value={form.shippingLine}
                    onChange={(v) => set("shippingLine", v)}
                    autoComplete="off"
                    placeholder="e.g. Standard Shipping"
                    helpText="Informational only — actual shipping rate is determined at checkout"
                  />
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* ── Order Details ────────────────────────────────────────── */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Order details
                </Text>
                <FormLayout>
                  <TextField
                    label="Order note"
                    value={form.note}
                    onChange={(v) => set("note", v)}
                    autoComplete="off"
                    multiline={3}
                    placeholder="Internal order notes"
                  />
                  <TextField
                    label="Tags"
                    value={form.tags}
                    onChange={(v) => set("tags", v)}
                    autoComplete="off"
                    placeholder="vip, wholesale, promo (comma-separated)"
                  />
                  <Checkbox
                    label="Tax exempt order"
                    checked={form.taxExempt}
                    onChange={(v) => set("taxExempt", v)}
                  />
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* ── Custom Attributes ────────────────────────────────────── */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h2">
                    Order custom attributes
                  </Text>
                  <Button variant="plain" onClick={addOrderAttribute}>
                    + Add attribute
                  </Button>
                </InlineStack>
                {form.customAttributes.length === 0 ? (
                  <Text as="p" tone="subdued">
                    No custom attributes. Click "+ Add attribute" to add
                    key-value metadata to the draft order.
                  </Text>
                ) : (
                  <BlockStack gap="200">
                    {form.customAttributes.map((attr, idx) => (
                      <InlineStack key={idx} gap="200" blockAlign="end">
                        <Box width="40%">
                          <TextField
                            label="Key"
                            labelHidden
                            value={attr.key}
                            onChange={(v) =>
                              updateOrderAttribute(idx, { key: v })
                            }
                            autoComplete="off"
                            placeholder="Key"
                          />
                        </Box>
                        <Box width="40%">
                          <TextField
                            label="Value"
                            labelHidden
                            value={attr.value}
                            onChange={(v) =>
                              updateOrderAttribute(idx, { value: v })
                            }
                            autoComplete="off"
                            placeholder="Value"
                          />
                        </Box>
                        <Button
                          icon={DeleteIcon}
                          variant="plain"
                          tone="critical"
                          onClick={() => removeOrderAttribute(idx)}
                          accessibilityLabel="Remove"
                        />
                      </InlineStack>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* ── Payment Terms ────────────────────────────────────────── */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Payment terms
                </Text>
                <FormLayout>
                  <FormLayout.Group>
                    <Select
                      label="Payment terms"
                      options={PAYMENT_TERMS}
                      value={form.paymentTermsName}
                      onChange={(v) => set("paymentTermsName", v)}
                    />
                    {(form.paymentTermsName === "NET_7" ||
                      form.paymentTermsName === "NET_15" ||
                      form.paymentTermsName === "NET_30" ||
                      form.paymentTermsName === "NET_45" ||
                      form.paymentTermsName === "NET_60" ||
                      form.paymentTermsName === "FIXED") && (
                      <TextField
                        label="Due in days"
                        type="number"
                        value={form.paymentTermsDueInDays}
                        onChange={(v) => set("paymentTermsDueInDays", v)}
                        autoComplete="off"
                        min={0}
                      />
                    )}
                  </FormLayout.Group>
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </>
  );
}
