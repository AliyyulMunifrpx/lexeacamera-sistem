import cameraService from "../../services/owner/camera-service.js";
import adminCameraService from "../../services/admin/camera-service.js";
import updateCameraImagesService from "../../services/shared/update-camera-images-service.js";

const getAll = async function (req, res, next) {
  try {
    const result = await adminCameraService.getAllCamera(req.query);
    res.status(200).json(result);
  } catch (e) {
    next(e);
  }
};

const get = async function (req, res, next) {
  try {
    const result = await adminCameraService.getCamera({ id: req.params.id });
    res.status(200).json({
      data: result,
    });
  } catch (e) {
    next(e);
  }
};

// Memakai service edit gambar yang sama dengan owner. Service itu hanya
// mengembalikan gambar, jadi tidak ada modal yang ikut keluar.
const updateImages = async function (req, res, next) {
  try {
    const result = await updateCameraImagesService.updateCameraImages({
      id: req.params.id,
      body: req.body,
      files: req.files,
    });
    res.status(200).json({
      data: result,
    });
  } catch (e) {
    next(e);
  }
};

const updateMarketplace = async function (req, res, next) {
  try {
    // id SESUDAH spread: id di body tidak boleh menimpa id di URL.
    // Field lain selain `marketplace` ditolak oleh validasi.
    const result = await adminCameraService.updateCameraMarketplace({
      ...req.body,
      id: req.params.id,
    });
    res.status(200).json({
      data: result,
    });
  } catch (e) {
    next(e);
  }
};

export default {
  getAll,
  get,
  updateImages,
  updateMarketplace,
};
