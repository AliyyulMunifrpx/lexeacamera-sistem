import customerService from "../../services/admin/customer-service.js";

const getAll = async (req, res, next) => {
  try {
    const result = await customerService.getAllCustomer(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getSummary = async (req, res, next) => {
  try {
    const result = await customerService.getCustomerSummary();
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const result = await customerService.getCustomer({ id: req.params.id });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const result = await customerService.createCustomer(req.body ?? {});
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const result = await customerService.updateCustomer({
      ...req.body,
      id: req.params.id,
    });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await customerService.deleteCustomer({ id: req.params.id });
    res.status(200).json({ data: { message: "CUSTOMER_DELETED" } });
  } catch (error) {
    next(error);
  }
};

export default { getAll, getSummary, get, create, update, remove };
