import dailyReportService from "../../services/admin/daily-report-service.js";

const getAll = async (req, res, next) => {
  try {
    const result = await dailyReportService.getAllReports(req.query, req.user);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const get = async (req, res, next) => {
  try {
    const result = await dailyReportService.getReport(
      { id: req.params.id },
      req.user,
    );

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const result = await dailyReportService.createReport(
      req.body ?? {},
      req.user,
    );

    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const result = await dailyReportService.updateReport(
      { ...req.body, id: req.params.id },
      req.user,
    );

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await dailyReportService.deleteReport(
      { id: req.params.id },
      req.user,
    );

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const createEntry = async (req, res, next) => {
  try {
    const result = await dailyReportService.createEntry(
      { ...req.body, id: req.params.id },
      req.user,
    );

    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const updateEntry = async (req, res, next) => {
  try {
    const result = await dailyReportService.updateEntry(
      { ...req.body, id: req.params.id, entry_id: req.params.entry_id },
      req.user,
    );

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const removeEntry = async (req, res, next) => {
  try {
    const result = await dailyReportService.deleteEntry(
      { id: req.params.id, entry_id: req.params.entry_id },
      req.user,
    );

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const createProofUploadUrl = async (req, res, next) => {
  try {
    const result = await dailyReportService.createProofUploadUrl(
      { ...req.body, id: req.params.id },
      req.user,
    );

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const setProof = async (req, res, next) => {
  try {
    const result = await dailyReportService.setProof(
      { ...req.body, id: req.params.id },
      req.user,
    );

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const removeProof = async (req, res, next) => {
  try {
    const result = await dailyReportService.deleteProof(
      { id: req.params.id },
      req.user,
    );

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default {
  getAll,
  get,
  create,
  update,
  remove,
  createEntry,
  updateEntry,
  removeEntry,
  createProofUploadUrl,
  setProof,
  removeProof,
};
