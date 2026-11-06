import marketplaceService from "../../services/owner/marketplace-service.js";

const createMarketplace = async (req, res, next) => {
  try {
    const result = await marketplaceService.createMarketplace({
      body: req.body ?? {},
      file: req.file,
    });

    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const updateMarketplace = async (req, res, next) => {
  try {
    const result = await marketplaceService.updateMarketplace({
      id: req.params.id,
      body: req.body ?? {},
      file: req.file,
    });

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const getAllMarketplace = async (req, res, next) => {
  try {
    const result = await marketplaceService.getAllMarketplace(req.query);

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const getMarketplace = async (req, res, next) => {
  try {
    const result = await marketplaceService.getMarketplace({
      id: req.params.id,
    });

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const deleteMarketplace = async (req, res, next) => {
  try {
    const result = await marketplaceService.deleteMarketplace({
      id: req.params.id,
    });

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default {
  createMarketplace,
  getAllMarketplace,
  getMarketplace,
  updateMarketplace,
  deleteMarketplace,
};
