import authService from "../../services/public/auth-service.js";

const setPassword = async (req, res, next) => {
  try {
    const result = await authService.setPassword(req.body ?? {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const result = await authService.forgotPassword(req.body ?? {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export default { setPassword, forgotPassword };
