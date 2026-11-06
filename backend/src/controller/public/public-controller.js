import publicService from "../../services/public/public-service.js";

const getStore = async (req, res, next) => {
  try {
    const result = await publicService.getPublicStore(req.query);

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const getHome = async (req, res, next) => {
  try {
    const result = await publicService.getPublicHome(req.query);

    // Endpoint paling sering dibuka dan jarang berubah, cache singkat meringankan server
    res.set("Cache-Control", "public, max-age=60");
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

export default { getStore, getHome, getAllCamera, getCamera };
