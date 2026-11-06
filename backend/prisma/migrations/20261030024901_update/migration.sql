/*
  Warnings:

  - You are about to alter the column `price` on the `Camera` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - The `store_discount` column on the `Invoice` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `customer_discount` column on the `Invoice` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `logo_url` on the `User` table. All the data in the column will be lost.
  - Added the required column `modal` to the `Camera` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `total_amount` on the `Invoice` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `total_amount` on the `Order` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `camera_modal` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `camera_price` on the `OrderItem` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OWNER');

-- CreateEnum
CREATE TYPE "PaymentStatuses" AS ENUM ('PAID', 'UNPAID');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('SALE', 'REFUND');

-- AlterTable
ALTER TABLE "Camera" ADD COLUMN     "modal" INTEGER NOT NULL,
ADD COLUMN     "strikethrough_price" INTEGER,
ALTER COLUMN "price" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "total_amount",
ADD COLUMN     "total_amount" INTEGER NOT NULL,
DROP COLUMN "store_discount",
ADD COLUMN     "store_discount" INTEGER,
DROP COLUMN "customer_discount",
ADD COLUMN     "customer_discount" INTEGER;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customer_id" TEXT,
ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "payment_status" "PaymentStatuses" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "refund_of_id" TEXT,
ADD COLUMN     "type" "OrderType" NOT NULL DEFAULT 'SALE',
DROP COLUMN "total_amount",
ADD COLUMN     "total_amount" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "camera_modal" INTEGER NOT NULL,
ADD COLUMN     "restocked" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "camera_price",
ADD COLUMN     "camera_price" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "attendance_require_network" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "logo_url",
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'ADMIN';

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pin_hash" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "email_verified_at" TIMESTAMP(3),
    "verify_token_hash" TEXT,
    "verify_expires_at" TIMESTAMP(3),
    "verify_sent_at" TIMESTAMP(3),
    "verify_attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "check_in_at" TIMESTAMP(3) NOT NULL,
    "check_out_at" TIMESTAMP(3),
    "missed_checkout" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceNetwork" (
    "id" TEXT NOT NULL,
    "cidr" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceNetwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "instagram" TEXT,
    "address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_user_id_key" ON "Employee"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "Attendance_employee_id_check_in_at_idx" ON "Attendance"("employee_id", "check_in_at");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceNetwork_cidr_key" ON "AttendanceNetwork"("cidr");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_whatsapp_key" ON "Customer"("whatsapp");

-- CreateIndex
CREATE INDEX "Order_customer_id_idx" ON "Order"("customer_id");

-- CreateIndex
CREATE INDEX "Order_refund_of_id_idx" ON "Order"("refund_of_id");

-- CreateIndex
CREATE INDEX "Order_type_payment_status_paid_at_idx" ON "Order"("type", "payment_status", "paid_at");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_refund_of_id_fkey" FOREIGN KEY ("refund_of_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
