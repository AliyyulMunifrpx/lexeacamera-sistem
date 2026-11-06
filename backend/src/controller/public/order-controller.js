import orderService from "../../services/public/order-service.js";

const createOrder = async (req, res, next) => {
  try {
    const result = await orderService.createOrder(req.body ?? {});

    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default { createOrder };
