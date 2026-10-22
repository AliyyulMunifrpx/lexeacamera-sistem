import bannerService from "../services/banner-service.js";

const createBanner = async (req, res, next) => {
  try {
    const result = await bannerService.createBanner({ file: req.file });

    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const getAllBanner = async (req, res, next) => {
  try {
    const result = await bannerService.getAllBanner();

    // Endpoint publik dan jarang berubah, cache singkat meringankan server
    res.set("Cache-Control", "public, max-age=60");
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const getBanner = async (req, res, next) => {
  try {
    const result = await bannerService.getBanner({ id: req.params.id });

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const updateBanner = async (req, res, next) => {
  try {
    const result = await bannerService.updateBanner({
      id: req.params.id,
      file: req.file,
    });

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const deleteBanner = async (req, res, next) => {
  try {
    const result = await bannerService.deleteBanner({ id: req.params.id });

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default {
  createBanner,
  getAllBanner,
  getBanner,
  updateBanner,
  deleteBanner,
};
