import employeeService from "../../services/owner/employee-service.js";

const create = async (req, res, next) => {
  try {
    const result = await employeeService.createEmployee(req.body ?? {});
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const result = await employeeService.getAllEmployee(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const result = await employeeService.getEmployee({ id: req.params.id });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const result = await employeeService.updateEmployee({
      ...req.body,
      id: req.params.id,
    });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const resendVerification = async (req, res, next) => {
  try {
    const result = await employeeService.resendVerification({
      id: req.params.id,
    });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await employeeService.deleteEmployee({ id: req.params.id });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default { create, getAll, get, update, resendVerification, remove };
