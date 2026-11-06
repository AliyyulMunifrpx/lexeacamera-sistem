import Joi from "joi";

// Endpoint ini tidak menerima parameter. Schema kosong membuat query yang
// tidak dikenal ditolak dengan 400, sama seperti endpoint lain.
export const getDashboardValidation = Joi.object({});
