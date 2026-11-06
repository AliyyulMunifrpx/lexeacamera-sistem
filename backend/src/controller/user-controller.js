import logger from "../application/logging.js";
import userService from "../services/user-service.js";
import { clearAuthCookies, setAuthCookies } from "../utils/auth-cookies.js";

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
    const { user, session } = await userService.login(req.body);
    // Token hanya lewat cookie httpOnly, tidak pernah ada di body response.
    setAuthCookies(res, session);
    res.status(200).json({
      data: user,
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
const setPin = async function (req, res, next) {
  try {
    await userService.setPin({
      id: req.user.id,
      pin: req.body.pin,
      current_password: req.body.current_password,
    });
    res.status(200).json({ message: "PIN_UPDATED" });
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
    // Cookie dihapus lebih dulu: walaupun pencabutan sesi di Supabase gagal,
    // browser tetap bersih dan user tidak terjebak.
    clearAuthCookies(res);
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
  setPin,
  updateName,
  logout,
  updateEmail,
};
