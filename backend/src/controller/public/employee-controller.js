import employeeService from "../../services/public/employee-service.js";

const tokenInfo = async (req, res, next) => {
  try {
    const result = await employeeService.tokenInfo(req.body ?? {});
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const setPin = async (req, res, next) => {
  try {
    const result = await employeeService.setPin(req.body ?? {});
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default { tokenInfo, setPin };
