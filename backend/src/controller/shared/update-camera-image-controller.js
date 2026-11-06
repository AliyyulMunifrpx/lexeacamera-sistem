import updateCameraImagesService from "../../services/shared/update-camera-images-service.js";

const updateCameraImages = async (req, res, next) => {
  try {
    const result = await updateCameraImagesService.updateCameraImages({
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
  updateCameraImages,
};
