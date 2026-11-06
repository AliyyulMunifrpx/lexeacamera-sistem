import networkService from "../../services/owner/attendance-network-service.js";

const getAll = async (req, res, next) => {
  try {
    const result = await networkService.getAllNetwork();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const result = await networkService.createNetwork(req.body ?? {});
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const result = await networkService.updateNetwork({
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
    await networkService.deleteNetwork({ id: req.params.id });
    res.status(200).json({ data: { message: "NETWORK_DELETED" } });
  } catch (error) {
    next(error);
  }
};

const getSetting = async (req, res, next) => {
  try {
    const result = await networkService.getSetting();
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const updateSetting = async (req, res, next) => {
  try {
    const result = await networkService.updateSetting(req.body ?? {});
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default { getAll, create, update, remove, getSetting, updateSetting };
