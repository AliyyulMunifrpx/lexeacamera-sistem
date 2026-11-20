import deviceService from "../../services/owner/attendance-device-service.js";

const getAll = async (req, res, next) => {
  try {
    const result = await deviceService.getAllDevice();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const result = await deviceService.createDevice(req.body ?? {});
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const result = await deviceService.updateDevice({
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
    await deviceService.deleteDevice({ id: req.params.id });
    res.status(200).json({ data: { message: "DEVICE_DELETED" } });
  } catch (error) {
    next(error);
  }
};

export default { getAll, create, update, remove };
