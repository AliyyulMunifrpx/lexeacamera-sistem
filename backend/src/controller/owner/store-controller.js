import storeService from "../../services/owner/store-service.js";

const createStore = async (req, res, next) => {
  try {
    const result = await storeService.createStore({
      body: req.body ?? {},
      files: req.files ?? {},
    });

    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const getStore = async (req, res, next) => {
  try {
    const result = await storeService.getStore();

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const updateStore = async (req, res, next) => {
  try {
    const result = await storeService.updateStore({
      body: req.body ?? {},
      files: req.files ?? {},
    });

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default {
  createStore,
  getStore,
  updateStore,
};
