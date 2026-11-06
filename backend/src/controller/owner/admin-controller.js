import adminService from "../../services/owner/admin-service.js";

const create = async (req, res, next) => {
  try {
    const result = await adminService.createAdmin(req.body ?? {});
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const result = await adminService.getAllAdmin(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const result = await adminService.getAdmin({ id: req.params.id });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const result = await adminService.updateAdmin({
      ...req.body,
      id: req.params.id,
    });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const resendInvite = async (req, res, next) => {
  try {
    const result = await adminService.resendInvite({ id: req.params.id });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default { create, getAll, get, update, resendInvite };
