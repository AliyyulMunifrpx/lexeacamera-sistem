import cameraImportService from "../../services/owner/camera-import-service.js";

const importCameras = async (req, res, next) => {
  try {
    const result = await cameraImportService.importCameras(req.body ?? {});

    res.status(result.dry_run ? 200 : 201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default { importCameras };
