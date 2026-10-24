import dashboardService from "../services/dashboard-service.js";

const getDashboard = async (req, res, next) => {
  try {
    const result = await dashboardService.getDashboard(req.query);

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export default { getDashboard };
