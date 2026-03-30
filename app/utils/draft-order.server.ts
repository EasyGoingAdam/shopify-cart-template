/**
 * Draft Order creation utility.
 * Takes a CartTemplate's JSON data and creates a Shopify Draft Order
 * via the Admin GraphQL API, returning the invoice URL.
 */

export interface LineItem {
  variantId?: string;
  title?: string;
  quantity: number;
  price?: string;
  sku?: string;
  taxable?: boolean;
  requiresShipping?: boolean;
  customAttributes?: Array<{ key: string; value: string }>;
}

export interface TemplateDiscount {
  type: "percentage" | "fixed_amount";
  value: number;
  title?: string;
  description?: string;
}

export interface CustomerInfo {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface ShippingAddress {
  firstName?: string;
  lastName?: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  zip?: string;
  country?: string;
  phone?: string;
}

export interface CustomAttribute {
  key: string;
  value: string;
}

export interface CreateDraftOrderParams {
  lineItems: LineItem[];
  discount?: TemplateDiscount | null;
  customer?: CustomerInfo | null;
  shippingAddress?: ShippingAddress | null;
  shippingLine?: string | null;
  note?: string | null;
  tags?: string | null;
  taxExempt?: boolean;
  customAttributes?: CustomAttribute[];
  currency?: string | null;
  paymentTerms?: { paymentTermsName?: string; dueInDays?: number } | null;
}

export interface DraftOrderResult {
  id: string;
  name: string;
  invoiceUrl: string;
}

const DRAFT_ORDER_CREATE_MUTATION = /* GraphQL */ `
  mutation draftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        name
        invoiceUrl
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Build the DraftOrderInput object from template params.
 */
function buildDraftOrderInput(params: CreateDraftOrderParams) {
  const input: Record<string, unknown> = {};

  // Line items
  if (params.lineItems && params.lineItems.length > 0) {
    input.lineItems = params.lineItems.map((item) => {
      const lineItem: Record<string, unknown> = {
        quantity: item.quantity,
      };

      if (item.variantId) {
        lineItem.variantId = item.variantId;
      }

      if (item.title) {
        lineItem.title = item.title;
      }

      if (item.price != null && item.price !== "") {
        lineItem.originalUnitPrice = item.price;
      }

      if (item.sku) {
        lineItem.sku = item.sku;
      }

      if (item.taxable != null) {
        lineItem.taxable = item.taxable;
      }

      if (item.requiresShipping != null) {
        lineItem.requiresShipping = item.requiresShipping;
      }

      if (item.customAttributes && item.customAttributes.length > 0) {
        lineItem.customAttributes = item.customAttributes;
      }

      return lineItem;
    });
  }

  // Applied discount (whole-order discount)
  if (params.discount) {
    input.appliedDiscount = {
      valueType:
        params.discount.type === "percentage" ? "PERCENTAGE" : "FIXED_AMOUNT",
      value: params.discount.value,
      title: params.discount.title || "Discount",
      description: params.discount.description,
    };
  }

  // Customer email
  if (params.customer?.email) {
    input.email = params.customer.email;
  }

  // Billing / shipping address
  if (params.shippingAddress) {
    const addr = params.shippingAddress;
    const hasData = Object.values(addr).some((v) => v);
    if (hasData) {
      input.shippingAddress = {
        firstName: addr.firstName,
        lastName: addr.lastName,
        company: addr.company,
        address1: addr.address1,
        address2: addr.address2,
        city: addr.city,
        province: addr.province,
        zip: addr.zip,
        countryCode: addr.country,
        phone: addr.phone,
      };
    }
  }

  // Note
  if (params.note) {
    input.note = params.note;
  }

  // Tags — Draft Order API takes an array
  if (params.tags) {
    const tagArray = params.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tagArray.length > 0) {
      input.tags = tagArray;
    }
  }

  // Tax exempt
  if (params.taxExempt) {
    input.taxExempt = true;
  }

  // Custom attributes
  if (params.customAttributes && params.customAttributes.length > 0) {
    input.customAttributes = params.customAttributes.filter(
      (a) => a.key && a.value
    );
  }

  // Currency
  if (params.currency) {
    input.currency = params.currency;
  }

  // Payment terms
  if (params.paymentTerms?.paymentTermsName) {
    input.paymentTerms = {
      paymentTermsName: params.paymentTerms.paymentTermsName,
      ...(params.paymentTerms.dueInDays != null
        ? { dueInDays: params.paymentTerms.dueInDays }
        : {}),
    };
  }

  return input;
}

/**
 * Creates a Shopify Draft Order from template data using an authenticated admin GraphQL client.
 */
export async function createDraftOrder(
  admin: { graphql: (query: string, options?: { variables?: unknown }) => Promise<{ json: () => Promise<unknown> }> },
  params: CreateDraftOrderParams
): Promise<DraftOrderResult> {
  const input = buildDraftOrderInput(params);

  const response = await admin.graphql(DRAFT_ORDER_CREATE_MUTATION, {
    variables: { input },
  });

  const data = (await response.json()) as {
    data: {
      draftOrderCreate: {
        draftOrder: { id: string; name: string; invoiceUrl: string } | null;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    };
    errors?: Array<{ message: string }>;
  };

  if (data.errors && data.errors.length > 0) {
    throw new Error(
      `GraphQL errors: ${data.errors.map((e) => e.message).join(", ")}`
    );
  }

  const { draftOrder, userErrors } = data.data.draftOrderCreate;

  if (userErrors && userErrors.length > 0) {
    throw new Error(
      `Draft order errors: ${userErrors.map((e) => `${e.field.join(".")}: ${e.message}`).join(", ")}`
    );
  }

  if (!draftOrder) {
    throw new Error("Draft order was not created (no data returned)");
  }

  return draftOrder;
}
