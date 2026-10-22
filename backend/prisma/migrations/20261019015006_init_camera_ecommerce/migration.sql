-- CreateEnum
CREATE TYPE "Condition" AS ENUM ('NEW', 'SECOND');

-- CreateTable
CREATE TABLE "Camera" (
    "id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "condition" "Condition" NOT NULL DEFAULT 'NEW',
    "stock" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "inclusions" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "promo" BOOLEAN,
    "best_selling" BOOLEAN,

    CONSTRAINT "Camera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marketplace" (
    "id" TEXT NOT NULL,
    "logo_url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL,

    CONSTRAINT "Marketplace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CameraMarketplaceLink" (
    "id" TEXT NOT NULL,
    "camera_id" TEXT NOT NULL,
    "marketplace_id" TEXT NOT NULL,
    "product_url" TEXT NOT NULL,

    CONSTRAINT "CameraMarketplaceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "logo_url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instagram" TEXT,
    "whatsapp" TEXT,
    "tiktok" TEXT,
    "facebook" TEXT,
    "address" TEXT,
    "main_banner_url" TEXT,
    "about_us" TEXT NOT NULL,
    "terms_and_condition" TEXT NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banner" (
    "id" TEXT NOT NULL,
    "banner_url" TEXT NOT NULL,
    "store_id" TEXT,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "total_amount" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "address" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "instagram" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "camera_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "camera_name" TEXT NOT NULL,
    "camera_price" TEXT NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "no_invoice" TEXT NOT NULL,
    "store_name" TEXT NOT NULL,
    "store_address" TEXT,
    "whatsapp_store" TEXT,
    "instagram_store" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_method" TEXT,
    "ship" TEXT,
    "customer_name" TEXT NOT NULL,
    "customer_address" TEXT NOT NULL,
    "customer_whatsapp" TEXT NOT NULL,
    "customer_instagram" TEXT,
    "total_amount" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "store_discount" TEXT,
    "customer_discount" TEXT,
    "is_final" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CameraMarketplaceLink_camera_id_marketplace_id_key" ON "CameraMarketplaceLink"("camera_id", "marketplace_id");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_no_invoice_key" ON "Invoice"("no_invoice");

-- AddForeignKey
ALTER TABLE "Camera" ADD CONSTRAINT "Camera_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CameraMarketplaceLink" ADD CONSTRAINT "CameraMarketplaceLink_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "Camera"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CameraMarketplaceLink" ADD CONSTRAINT "CameraMarketplaceLink_marketplace_id_fkey" FOREIGN KEY ("marketplace_id") REFERENCES "Marketplace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "Camera"("id") ON DELETE CASCADE ON UPDATE CASCADE;
