import marketplaceService from "../../services/admin/marketplace-service.js";

const getAllMarketplace = async (req, res, next) => {
  try {
    const result = await marketplaceService.getAllMarketplace();
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default { getAllMarketplace };
