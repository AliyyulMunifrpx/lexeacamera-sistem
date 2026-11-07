import express from "express";
import userController from "../controller/user-controller.js";
import adminCameraController from "../controller/admin/camera-controller.js";
import customerController from "../controller/admin/customer-controller.js";
import { uploadImages } from "../middleware/upload-image-middleware.js";
import invoiceController from "../controller/admin/invoice-controller.js";
import adminMarketplaceController from "../controller/admin/marketplace-controller.js";

import dashboardController from "../controller/admin/dashboard-controller.js";
import refundController from "../controller/admin/refund-controller.js";
import storeController from "../controller/owner/store-controller.js";
import termsController from "../controller/owner/terms-controller.js";
const adminRouter = express.Router();
adminRouter.put("/users/pin", userController.setPin);
adminRouter.get("/users/current", userController.get);
adminRouter.patch("/users/current/password", userController.updatePassword);
adminRouter.patch("/users/current/name", userController.updateName);
adminRouter.patch("/users/current/email", userController.updateEmail);
adminRouter.post("/users/current/logout", userController.logout);
adminRouter.get("/admin/cameras", adminCameraController.getAll);
adminRouter.get("/admin/cameras/:id", adminCameraController.get);
adminRouter.put(
  "/admin/cameras/:id/images",
  uploadImages(),
  adminCameraController.updateImages,
);
adminRouter.put(
  "/admin/cameras/:id/marketplace",
  adminCameraController.updateMarketplace,
);
adminRouter.get("/admin/customers", customerController.getAll);
adminRouter.get("/admin/customers/summary", customerController.getSummary);
adminRouter.post("/admin/customers", customerController.create);
adminRouter.get("/admin/customers/:id", customerController.get);
adminRouter.put("/admin/customers/:id", customerController.update);
adminRouter.delete("/admin/customers/:id", customerController.remove);
adminRouter.post("/admin/invoices", invoiceController.createInvoice);
adminRouter.get("/admin/invoices", invoiceController.getAllInvoice);
adminRouter.get("/admin/invoices/:id", invoiceController.getInvoice);
adminRouter.patch("/admin/invoices/:id", invoiceController.updateInvoice);
adminRouter.delete("/admin/invoices/:id", invoiceController.deleteInvoice);
adminRouter.get("/admin/dashboard", dashboardController.getDashboard);
adminRouter.post("/admin/orders/:id/refunds", refundController.create);
adminRouter.get("/admin/orders/:id/refunds", refundController.getByOrder);
adminRouter.delete("/admin/refunds/:id", refundController.remove);
adminRouter.get(
  "/admin/marketplaces",
  adminMarketplaceController.getAllMarketplace,
);
adminRouter.get("/store", storeController.getStore);
adminRouter.get("/terms", termsController.getTerms);

export default adminRouter;
