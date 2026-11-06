import reportService from "../../services/owner/report-service.js";

const summary = async (req, res, next) => {
  try {
    const result = await reportService.getSummary(req.query);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const trend = async (req, res, next) => {
  try {
    const result = await reportService.getTrend(req.query);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const products = async (req, res, next) => {
  try {
    const result = await reportService.getProducts(req.query);
    res
      .status(200)
      .json({
        data: result.data,
        paging: result.paging,
        period: result.period,
        sort: result.sort,
      });
  } catch (error) {
    next(error);
  }
};

const categories = async (req, res, next) => {
  try {
    const result = await reportService.getCategories(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const customers = async (req, res, next) => {
  try {
    const result = await reportService.getCustomers(req.query);
    res
      .status(200)
      .json({
        data: result.data,
        paging: result.paging,
        period: result.period,
        sort: result.sort,
      });
  } catch (error) {
    next(error);
  }
};

const customerSegments = async (req, res, next) => {
  try {
    const result = await reportService.getCustomerSegments(req.query);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const transactions = async (req, res, next) => {
  try {
    const result = await reportService.getTransactions(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const stockValue = async (req, res, next) => {
  try {
    const result = await reportService.getStockValue();
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default {
  summary,
  trend,
  products,
  categories,
  customers,
  customerSegments,
  transactions,
  stockValue,
};
