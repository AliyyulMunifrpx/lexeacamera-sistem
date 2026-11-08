import salesService from "../../services/admin/sales-service.js";

const get = async (req, res, next) => {
  try {
    const result = await salesService.getSales(req.query);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default { get };
