import refundService from "../../services/admin/refund-service.js";

const create = async (req, res, next) => {
  try {
    const result = await refundService.createRefund({
      ...req.body,
      id: req.params.id,
    });
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const getByOrder = async (req, res, next) => {
  try {
    const result = await refundService.getOrderRefunds({ id: req.params.id });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await refundService.removeRefund({ id: req.params.id });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export default { create, getByOrder, remove };
