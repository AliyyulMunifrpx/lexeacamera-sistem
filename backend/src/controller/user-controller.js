import logger from "../application/logging.js";
import userService from "../services/user-service.js";

const register = async function (req, res, next) {
  try {
    const result = await userService.register(req.body);
    res.status(201).json({
      data: result,
    });
  } catch (e) {
    next(e);
  }
};
const login = async function (req, res, next) {
  try {
    const result = await userService.login(req.body);
    res.status(200).json({
      data: result,
    });
  } catch (e) {
    next(e);
  }
};
const get = async function (req, res, next) {
  try {
    const result = await userService.get({ id: req.user.id });
    res.status(200).json({
      data: result,
    });
  } catch (e) {
    next(e);
  }
};

const updatePassword = async function (req, res, next) {
  try {
    await userService.updatePassword(
      {
        id: req.user.id,
        new_password: req.body.new_password,
        current_password: req.body.current_password,
      },
      req.access_token,
    );
    res.status(200).json({
      message: "PASSWORD_UPDATED",
    });
  } catch (e) {
    next(e);
  }
};
const updateName = async function (req, res, next) {
  try {
    const result = await userService.updateName({
      id: req.user.id,
      name: req.body.name,
    });
    res.status(200).json({
      data: result,
    });
  } catch (e) {
    next(e);
  }
};
const updateEmail = async function (req, res, next) {
  try {
    const result = await userService.updateEmail(
      {
        id: req.user.id,
        email: req.body.email,
      },
      req.access_token,
    );
    res.status(200).json({
      message: result.message,
    });
  } catch (e) {
    next(e);
  }
};
const logout = async function (req, res, next) {
  try {
    const result = await userService.logout(req.access_token);
    res.status(200).json({
      data: result,
    });
  } catch (e) {
    next(e);
  }
};
export default {
  register,
  login,
  get,
  updatePassword,
  updateName,
  logout,
  updateEmail,
};
