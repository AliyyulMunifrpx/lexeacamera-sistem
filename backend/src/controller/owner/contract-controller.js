import contractService from "../../services/owner/contract-service.js";

const getAll = async (req, res, next) => {
  try {
    const result = await contractService.getContracts({
      employee_id: req.params.id,
    });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const result = await contractService.createContract({
      ...(req.body ?? {}),
      employee_id: req.params.id,
    });
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const result = await contractService.updateContract({
      ...(req.body ?? {}),
      employee_id: req.params.id,
      contract_id: req.params.contract_id,
    });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await contractService.deleteContract({
      employee_id: req.params.id,
      contract_id: req.params.contract_id,
    });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default { getAll, create, update, remove };
