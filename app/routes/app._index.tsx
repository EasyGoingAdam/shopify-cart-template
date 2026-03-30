import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  Badge,
  Button,
  ButtonGroup,
  EmptyState,
  Banner,
  InlineStack,
  BlockStack,
  Box,
  Tooltip,
} from "@shopify/polaris";
import { LinkIcon, EditIcon, DuplicateIcon, DeleteIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const appUrl = process.env.SHOPIFY_APP_URL || "";
  const url = new URL(request.url);
  const created = url.searchParams.get("created") === "1";

  const templates = await db.cartTemplate.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      slug: true,
      isActive: true,
      usageCount: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return json({ templates, appUrl, created });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const id = formData.get("id") as string;

  // Verify template belongs to this shop
  const template = await db.cartTemplate.findFirst({ where: { id, shop } });
  if (!template) {
    return json({ error: "Template not found" }, { status: 404 });
  }

  if (intent === "delete") {
    await db.cartTemplate.delete({ where: { id } });
    return json({ success: true });
  }

  if (intent === "toggle") {
    await db.cartTemplate.update({
      where: { id },
      data: { isActive: !template.isActive },
    });
    return json({ success: true });
  }

  return json({ error: "Unknown action" }, { status: 400 });
};

export default function TemplateIndex() {
  const { templates, appUrl, created } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigate = useNavigate();

  // Show toast when redirected back after create/save
  if (typeof shopify !== "undefined" && created) {
    shopify.toast.show("Template created successfully!");
  }

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Delete template "${title}"? This cannot be undone.`)) {
      submit({ intent: "delete", id }, { method: "post" });
    }
  };

  const handleToggle = (id: string) => {
    submit({ intent: "toggle", id }, { method: "post" });
  };

  const copyLink = (slug: string) => {
    const url = `${appUrl}/cart/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      shopify.toast.show("Link copied to clipboard!");
    });
  };

  const emptyState = (
    <EmptyState
      heading="Create your first cart template"
      action={{
        content: "Create template",
        onAction: () => navigate("/app/templates/new"),
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>
        Cart templates let you create reusable orders with pre-filled products,
        discounts, and customer info. Share a link to automatically create a
        Draft Order in Shopify.
      </p>
    </EmptyState>
  );

  return (
    <Page
      title="Cart Templates"
      primaryAction={{
        content: "Create template",
        onAction: () => navigate("/app/templates/new"),
      }}
    >
      <Layout>
        <Layout.Section>
          {templates.length === 0 ? (
            <Card>{emptyState}</Card>
          ) : (
            <Card padding="0">
              <ResourceList
                resourceName={{ singular: "template", plural: "templates" }}
                items={templates}
                renderItem={(template) => {
                  const shareUrl = `${appUrl}/cart/${template.slug}`;
                  return (
                    <ResourceItem
                      id={template.id}
                      onClick={() =>
                        navigate(`/app/templates/${template.id}/edit`)
                      }
                      name={template.title}
                    >
                      <InlineStack align="space-between" blockAlign="center" wrap={false}>
                        <BlockStack gap="100">
                          <InlineStack gap="200" blockAlign="center">
                            <Text variant="bodyMd" fontWeight="bold" as="span">
                              {template.title}
                            </Text>
                            <Badge tone={template.isActive ? "success" : "critical"}>
                              {template.isActive ? "Active" : "Inactive"}
                            </Badge>
                            {template.currency && (
                              <Badge>{template.currency}</Badge>
                            )}
                          </InlineStack>
                          {template.description && (
                            <Text variant="bodySm" tone="subdued" as="span">
                              {template.description}
                            </Text>
                          )}
                          <Text variant="bodySm" tone="subdued" as="span">
                            Used {template.usageCount} time
                            {template.usageCount !== 1 ? "s" : ""} ·{" "}
                            {new Date(template.createdAt).toLocaleDateString()}
                          </Text>
                        </BlockStack>
                        <Box onClick={(e) => e.stopPropagation()}>
                          <ButtonGroup>
                            <Tooltip content="Copy shareable link">
                              <Button
                                icon={LinkIcon}
                                onClick={() => copyLink(template.slug)}
                                disabled={!template.isActive}
                                accessibilityLabel="Copy link"
                              />
                            </Tooltip>
                            <Button
                              icon={EditIcon}
                              onClick={() =>
                                navigate(`/app/templates/${template.id}/edit`)
                              }
                              accessibilityLabel="Edit"
                            />
                            <Button
                              icon={DuplicateIcon}
                              url={`/app/templates/${template.id}/duplicate`}
                              accessibilityLabel="Duplicate"
                            />
                            <Button
                              tone={template.isActive ? "critical" : undefined}
                              onClick={() => handleToggle(template.id)}
                              accessibilityLabel={
                                template.isActive ? "Deactivate" : "Activate"
                              }
                            >
                              {template.isActive ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              tone="critical"
                              icon={DeleteIcon}
                              onClick={() =>
                                handleDelete(template.id, template.title)
                              }
                              accessibilityLabel="Delete"
                            />
                          </ButtonGroup>
                        </Box>
                      </InlineStack>
                    </ResourceItem>
                  );
                }}
              />
            </Card>
          )}
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">
                How it works
              </Text>
              <Text as="p" tone="subdued">
                1. Create a template with products, discounts, and customer info.
              </Text>
              <Text as="p" tone="subdued">
                2. Copy the shareable link and send it to your customer.
              </Text>
              <Text as="p" tone="subdued">
                3. When they open the link, a Draft Order is automatically
                created in your Shopify store and they're redirected to the
                invoice page to complete payment.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
