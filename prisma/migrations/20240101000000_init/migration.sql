-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartTemplate" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lineItems" TEXT NOT NULL DEFAULT '[]',
    "discount" TEXT,
    "customer" TEXT,
    "shippingAddress" TEXT,
    "shippingLine" TEXT,
    "note" TEXT,
    "tags" TEXT,
    "taxExempt" BOOLEAN NOT NULL DEFAULT false,
    "customAttributes" TEXT NOT NULL DEFAULT '[]',
    "paymentTerms" TEXT,
    "currency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateUsage" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "draftOrderId" TEXT,
    "draftOrderName" TEXT,
    "draftOrderUrl" TEXT,
    "visitorIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CartTemplate_slug_key" ON "CartTemplate"("slug");

-- CreateIndex
CREATE INDEX "CartTemplate_shop_idx" ON "CartTemplate"("shop");

-- CreateIndex
CREATE INDEX "CartTemplate_slug_idx" ON "CartTemplate"("slug");

-- CreateIndex
CREATE INDEX "TemplateUsage_templateId_idx" ON "TemplateUsage"("templateId");

-- AddForeignKey
ALTER TABLE "TemplateUsage" ADD CONSTRAINT "TemplateUsage_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "CartTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
