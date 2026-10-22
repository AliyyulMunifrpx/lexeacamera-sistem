import categoryService from "../services/category-service.js";

const create = async function (req, res, next) {
  try {
    const result = await categoryService.create(req.body);
    res.status(201).json({
      data: result,
    });
  } catch (e) {
    next(e);
  }
};
const getAllCategory = async function (req, res, next) {
  try {
    const result = await categoryService.getAllCategory();
    res.status(200).json({
      data: result,
    });
  } catch (e) {
    next(e);
  }
};
const updateCategory = async function (req, res, next) {
  try {
    const result = await categoryService.updateCategory({
      id: req.params.id,
      name: req.body.name,
    });
    res.status(200).json({
      data: result,
    });
  } catch (e) {
    next(e);
  }
};
const deleteCategory = async function (req, res, next) {
  try {
    await categoryService.deleteCategory({ id: req.params.id });
    res.status(200).json({
      message: "CATEGORY_DELETED",
    });
  } catch (e) {
    next(e);
  }
};
export default { create, getAllCategory, updateCategory, deleteCategory };
