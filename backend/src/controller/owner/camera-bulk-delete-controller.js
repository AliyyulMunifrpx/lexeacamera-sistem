import cameraBulkDeleteService from "../../services/owner/camera-bulk-delete-service.js";

const deleteMany = async (req, res, next) => {
  try {
    const result = await cameraBulkDeleteService.deleteCameras(req.body ?? {});

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default { deleteMany };
