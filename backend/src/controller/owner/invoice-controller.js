import invoiceService from "../../services/owner/invoice-service.js";

const createInvoice = async (req, res, next) => {
  try {
    const result = await invoiceService.createInvoice(req.body ?? {});

    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const getAllInvoice = async (req, res, next) => {
  try {
    const result = await invoiceService.getAllInvoice(req.query);

    res.status(200).json({ data: result.data, paging: result.paging });
  } catch (error) {
    next(error);
  }
};

const getInvoice = async (req, res, next) => {
  try {
    const result = await invoiceService.getInvoice({ id: req.params.id });

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const updateInvoice = async (req, res, next) => {
  try {
    const result = await invoiceService.updateInvoice({
      ...(req.body ?? {}),
      id: req.params.id, // id dari path selalu menang atas id di body
    });

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const deleteInvoice = async (req, res, next) => {
  try {
    const result = await invoiceService.deleteInvoice({ id: req.params.id });

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default {
  createInvoice,
  getAllInvoice,
  getInvoice,
  updateInvoice,
  deleteInvoice,
};
