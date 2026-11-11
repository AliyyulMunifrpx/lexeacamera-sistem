import payrollService from "../../services/owner/payroll-service.js";

const create = async (req, res, next) => {
  try {
    const result = await payrollService.createPayroll(req.body);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const result = await payrollService.getAllPayroll(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getByEmployee = async (req, res, next) => {
  try {
    const result = await payrollService.getEmployeePayroll({
      ...req.query,
      id: req.params.id,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const result = await payrollService.getPayroll({ id: req.params.id });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const result = await payrollService.updatePayroll({
      ...req.body,
      id: req.params.id,
    });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const result = await payrollService.updatePayrollStatus({
      ...req.body,
      id: req.params.id,
    });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const updateChecklist = async (req, res, next) => {
  try {
    const result = await payrollService.updatePayrollChecklist({
      ...req.body,
      id: req.params.id,
      item_id: req.params.item_id,
    });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await payrollService.deletePayroll({ id: req.params.id });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default {
  create,
  getAll,
  getByEmployee,
  get,
  update,
  updateStatus,
  updateChecklist,
  remove,
};
