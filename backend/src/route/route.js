import express from "express";
import userController from "../controller/user-controller.js";
import cameraController from "../controller/camera-controller.js";
import categoryController from "../controller/category-controller.js";
import {
  uploadBanner,
  uploadImages,
  uploadLogo,
  uploadStoreImages,
} from "../middleware/upload-image-middleware.js";
import marketplaceController from "../controller/marketplace-controller.js";
import bannerController from "../controller/banner-controller.js";
import storeController from "../controller/store-controller.js";
import invoiceController from "../controller/invoice-controller.js";
import dashboardController from "../controller/dashboard-controller.js";
import termsController from "../controller/terms-controller.js";

const privateRouter = express.Router();
privateRouter.get("/users/current", userController.get);
privateRouter.patch("/users/current/password", userController.updatePassword);
privateRouter.patch("/users/current/name", userController.updateName);
privateRouter.patch("/users/current/email", userController.updateEmail);
privateRouter.post("/users/current/logout", userController.logout);
privateRouter.post("/category", categoryController.create);
privateRouter.get("/category", categoryController.getAllCategory);
privateRouter.patch("/category/:id", categoryController.updateCategory);
privateRouter.delete("/category/:id", categoryController.deleteCategory);

privateRouter.post(
  "/cameras",
  uploadImages("images"),
  cameraController.createCamera,
);
privateRouter.get("/cameras", cameraController.getAllCamera);
privateRouter.get("/cameras/:id", cameraController.getCamera);
privateRouter.patch("/cameras/:id", cameraController.updateCamera);
privateRouter.delete("/cameras/:id", cameraController.deleteCamera);
privateRouter.patch(
  "/cameras/:id/images",
  uploadImages(),
  cameraController.updateCameraImages,
);
privateRouter.get("/marketplaces", marketplaceController.getAllMarketplace);
privateRouter.get("/marketplaces/:id", marketplaceController.getMarketplace);
privateRouter.post(
  "/marketplaces",
  uploadLogo(),
  marketplaceController.createMarketplace,
);
privateRouter.patch(
  "/marketplaces/:id",
  uploadLogo(),
  marketplaceController.updateMarketplace,
);
privateRouter.delete(
  "/marketplaces/:id",
  marketplaceController.deleteMarketplace,
);
privateRouter.get("/banners/:id", bannerController.getBanner);
privateRouter.post("/banners", uploadBanner(), bannerController.createBanner);
privateRouter.patch(
  "/banners/:id",
  uploadBanner(),
  bannerController.updateBanner,
);
privateRouter.delete("/banners/:id", bannerController.deleteBanner);
privateRouter.post("/store", uploadStoreImages(), storeController.createStore);
privateRouter.get("/store", storeController.getStore);
privateRouter.patch("/store", uploadStoreImages(), storeController.updateStore);
privateRouter.post("/invoices", invoiceController.createInvoice);
privateRouter.get("/invoices", invoiceController.getAllInvoice);
privateRouter.get("/invoices/:id", invoiceController.getInvoice);
privateRouter.patch("/invoices/:id", invoiceController.updateInvoice);
privateRouter.delete("/invoices/:id", invoiceController.deleteInvoice);
privateRouter.get("/dashboard", dashboardController.getDashboard);
privateRouter.get("/terms", termsController.getTerms);
privateRouter.put("/terms", termsController.updateTerms);
export default privateRouter;
