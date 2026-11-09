import orderPaymentService from "../../services/admin/order-payment-service.js";

const updatePaymentStatus = async (req, res, next) => {
  try {
    const result = await orderPaymentService.updatePaymentStatus({
      ...req.body,
      id: req.params.id,
    });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default { updatePaymentStatus };
