import deviceService from "../../services/public/attendance-device-service.js";

const heartbeat = async (req, res, next) => {
  try {
    const result = await deviceService.heartbeat({
      ip: req.ip,
      token: req.get("x-device-token"),
    });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default { heartbeat };
