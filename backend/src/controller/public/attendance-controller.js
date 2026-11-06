import attendanceService from "../../services/public/attendance-service.js";

const getEmployees = async (req, res, next) => {
  try {
    const result = await attendanceService.getEmployees({ ip: req.ip });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const getToday = async (req, res, next) => {
  try {
    const result = await attendanceService.getToday({ ip: req.ip });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const getHistory = async (req, res, next) => {
  try {
    const result = await attendanceService.getHistory({
      ip: req.ip,
      body: req.body,
    });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const checkIn = async (req, res, next) => {
  try {
    const result = await attendanceService.checkIn({
      ip: req.ip,
      body: req.body,
    });
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const checkOut = async (req, res, next) => {
  try {
    const result = await attendanceService.checkOut({
      ip: req.ip,
      body: req.body,
    });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const myIp = (req, res, next) => {
  try {
    res.status(200).json({ data: attendanceService.myIp({ ip: req.ip }) });
  } catch (error) {
    next(error);
  }
};

export default {
  getEmployees,
  getToday,
  getHistory,
  checkIn,
  checkOut,
  myIp,
};
