-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "dp_amount" INTEGER,
ADD COLUMN "dp_paid_at" TIMESTAMP(3);

ALTER TABLE "Order"
ADD CONSTRAINT "Order_dp_amount_chk" CHECK (
    "dp_amount" IS NULL
    OR "dp_amount" > 0
),
ADD CONSTRAINT "Order_dp_status_chk" CHECK (
    (
        "payment_status" <> 'DP'
        OR "dp_amount" IS NOT NULL
    )
    AND (
        "payment_status" <> 'UNPAID'
        OR "dp_amount" IS NULL
    )
),
ADD CONSTRAINT "Order_dp_sale_chk" CHECK (
    "type" = 'SALE'
    OR "dp_amount" IS NULL
),
ADD CONSTRAINT "Order_dp_paid_chk" CHECK (
    (
        "dp_paid_at" IS NULL
        OR "dp_amount" IS NOT NULL
    )
    AND (
        "payment_status" <> 'UNPAID'
        OR "dp_paid_at" IS NULL
    )
);