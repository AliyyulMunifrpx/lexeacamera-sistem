import qcItemService from "../../services/admin/qc-item-service.js";

const getAll = async (req, res, next) => {
  try {
    const result = await qcItemService.getItems(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const result = await qcItemService.createItem(req.body);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const result = await qcItemService.updateItem({
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
    const result = await qcItemService.deleteItem({ id: req.params.id });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default { getAll, create, update, remove };
