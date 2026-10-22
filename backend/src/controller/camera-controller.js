import cameraService from "../services/camera-service.js";

const createCamera = async (req, res, next) => {
  try {
    const result = await cameraService.createCamera({
      user: req.user,
      body: req.body,
      files: req.files,
    });

    res.status(201).json({
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
const getAllCamera = async (req, res, next) => {
  try {
    const result = await cameraService.getAllCamera(req.query);
    res.status(200).json({
      data: result.data,
      paging: result.paging,
    });
  } catch (e) {
    next(e);
  }
};
const getCamera = async (req, res, next) => {
  try {
    const result = await cameraService.getCamera({ id: req.params.id });
    res.status(200).json({
      data: result,
    });
  } catch (e) {
    next(e);
  }
};
const updateCamera = async (req, res, next) => {
  try {
    const result = await cameraService.updateCamera({
      ...(req.body ?? {}), // di Express 5, body bisa undefined kalau tidak ada body
      id: req.params.id, // id dari path selalu menang atas id di body
    });

    res.status(200).json({
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
const deleteCamera = async (req, res, next) => {
  try {
    const result = await cameraService.deleteCamera({ id: req.params.id });

    res.status(200).json({
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
const updateCameraImages = async (req, res, next) => {
  try {
    const result = await cameraService.updateCameraImages({
      id: req.params.id,
      body: req.body ?? {},
      files: req.files ?? [],
    });

    res.status(200).json({
      data: result, // array gambar, foto utama di urutan pertama
    });
  } catch (error) {
    next(error);
  }
};
export default {
  createCamera,
  updateCameraImages,
  getAllCamera,
  updateCamera,
  getCamera,
  deleteCamera,
};
