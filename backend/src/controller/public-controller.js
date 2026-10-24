import publicService from "../services/public-service.js";

const getStore = async (req, res, next) => {
  try {
    const result = await publicService.getPublicStore(req.query);

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const getAllCamera = async (req, res, next) => {
  try {
    const result = await publicService.getAllPublicCamera(req.query);

    res.status(200).json({ data: result.data, paging: result.paging });
  } catch (error) {
    next(error);
  }
};

const getCamera = async (req, res, next) => {
  try {
    const result = await publicService.getPublicCamera({ id: req.params.id });

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default { getStore, getAllCamera, getCamera };
