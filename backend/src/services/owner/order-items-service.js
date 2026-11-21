import { Prisma } from "@prisma/client";

import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import { calculateTotal } from "../../utils/order-invoice.js";
import { updateOrderItemsValidation } from "../../validation/owner/order-items-validation.js";
import { validate } from "../../validation/validation.js";
import orderService from "./order-service.js";

const sum = (lines, fn) => lines.reduce((total, line) => total + fn(line), 0);

const updateOrderItems = async (request) => {
  const req = validate(updateOrderItemsValidation, request);

  await prisma.$transaction(
    async (tx) => {
      const locked = await tx.$queryRaw`
        SELECT id FROM "Order" WHERE id = ${req.id} FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new ResponseError(404, "ORDER_NOT_FOUND");
      }

      const order = await tx.order.findUnique({
        where: { id: req.id },
        select: {
          type: true,
          payment_status: true,
          order_items: {
            select: {
              id: true,
              camera_id: true,
              camera_price: true,
              quantity: true,
            },
          },
          invoice: {
            select: { store_discount: true, customer_discount: true },
          },
        },
      });

      if (order.type !== "SALE") {
        throw new ResponseError(409, "ORDER_NOT_SALE");
      }

      if (order.payment_status === "PAID") {
        throw new ResponseError(409, "ORDER_ALREADY_PAID");
      }

      if (order.payment_status === "DP") {
        throw new ResponseError(409, "ORDER_HAS_DP");
      }

      const existing = new Map();
      const duplicates = [];

      for (const item of order.order_items) {
        if (existing.has(item.camera_id)) duplicates.push(item.id);
        else existing.set(item.camera_id, item);
      }

      const wanted = new Map(req.items.map((item) => [item.camera_id, item]));
      const newIds = req.items
        .map((item) => item.camera_id)
        .filter((cameraId) => !existing.has(cameraId));

      let fresh = new Map();

      if (newIds.length > 0) {
        await tx.$queryRaw`
          SELECT id
          FROM "Camera"
          WHERE id IN (${Prisma.join(newIds)}) AND is_deleted = false
          ORDER BY id
          FOR SHARE
        `;

        const cameras = await tx.camera.findMany({
          where: { id: { in: newIds }, is_deleted: false },
          select: { id: true, name: true, price: true, capital: true },
        });
        fresh = new Map(cameras.map((camera) => [camera.id, camera]));

        const missing = newIds.filter((cameraId) => !fresh.has(cameraId));
        if (missing.length > 0) {
          throw new ResponseError(404, "CAMERA_NOT_FOUND", {
            camera_ids: missing,
          });
        }

        for (const camera of cameras) {
          if (
            !Number.isSafeInteger(camera.price) ||
            camera.price < 0 ||
            !Number.isSafeInteger(camera.capital) ||
            camera.capital < 0
          ) {
            throw new ResponseError(500, "CAMERA_PRICE_INVALID");
          }
        }
      }

      // Barang yang sudah ada tetap memakai harga dan modal saat order dibuat.
      const lines = req.items.map((item) => {
        const current = existing.get(item.camera_id);
        const price = current
          ? current.camera_price
          : fresh.get(item.camera_id).price;

        return { camera_id: item.camera_id, quantity: item.quantity, price };
      });

      const subtotal = sum(lines, (line) => line.price * line.quantity);
      const total = calculateTotal(
        subtotal,
        order.invoice?.store_discount,
        order.invoice?.customer_discount,
      );

      const removeIds = [
        ...duplicates,
        ...[...existing.values()]
          .filter((item) => !wanted.has(item.camera_id))
          .map((item) => item.id),
      ];

      if (removeIds.length > 0) {
        await tx.orderItem.deleteMany({
          where: { order_id: req.id, id: { in: removeIds } },
        });
      }

      for (const item of req.items) {
        const current = existing.get(item.camera_id);

        if (current && current.quantity !== item.quantity) {
          await tx.orderItem.update({
            where: { id: current.id },
            data: { quantity: item.quantity },
            select: { id: true },
          });
        }
      }

      if (newIds.length > 0) {
        await tx.orderItem.createMany({
          data: newIds.map((cameraId) => {
            const camera = fresh.get(cameraId);

            return {
              order_id: req.id,
              camera_id: cameraId,
              camera_name: camera.name,
              camera_price: camera.price,
              camera_modal: camera.capital,
              quantity: wanted.get(cameraId).quantity,
            };
          }),
        });
      }

      await tx.order.update({
        where: { id: req.id },
        data: { total_amount: total },
        select: { id: true },
      });

      if (order.invoice) {
        await tx.invoice.update({
          where: { order_id: req.id },
          data: { total_amount: total },
          select: { id: true },
        });
      }
    },
    { timeout: 15000 },
  );

  return orderService.getOrder({ id: req.id });
};

export default { updateOrderItems };
