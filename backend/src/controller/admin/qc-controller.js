import qcService from "../../services/admin/qc-service.js";

const getAll = async (req, res, next) => {
  try {
    const result = await qcService.getAllQc(req.query, req.user?.role);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const result = await qcService.getQc({ id: req.params.id }, req.user?.role);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const result = await qcService.createQc(req.body);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const result = await qcService.updateQc(
      { ...req.body, id: req.params.id },
      req.user?.role,
    );
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const setStatus = async (req, res, next) => {
  try {
    const result = await qcService.setStatus(
      { ...req.body, id: req.params.id },
      req.user?.role,
    );
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await qcService.deleteQc(
      { id: req.params.id },
      req.user?.role,
    );
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const createUploadUrl = async (req, res, next) => {
  try {
    const result = await qcService.createUploadUrl(
      { ...req.body, id: req.params.id },
      req.user?.role,
    );
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const addMedia = async (req, res, next) => {
  try {
    const result = await qcService.addMedia(
      { ...req.body, id: req.params.id },
      req.user?.role,
    );
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const removeMedia = async (req, res, next) => {
  try {
    const result = await qcService.deleteMedia(
      { id: req.params.id, media_id: req.params.media_id },
      req.user?.role,
    );
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default {
  getAll,
  get,
  create,
  update,
  setStatus,
  remove,
  createUploadUrl,
  addMedia,
  removeMedia,
};
