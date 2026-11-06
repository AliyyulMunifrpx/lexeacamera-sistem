import termsService from "../../services/owner/terms-service.js";

const getTerms = async (req, res, next) => {
  try {
    const result = await termsService.getTerms();

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const updateTerms = async (req, res, next) => {
  try {
    const result = await termsService.updateTerms(req.body ?? {});

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default { getTerms, updateTerms };
