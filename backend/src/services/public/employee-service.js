import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import { hashPin, hashToken } from "../../utils/secret.js";
import {
  setPinValidation,
  tokenInfoValidation,
} from "../../validation/public/attendance-validation.js";
import { validate } from "../../validation/validation.js";

const invalidToken = () => new ResponseError(400, "INVALID_OR_EXPIRED_TOKEN");

const findByToken = (tokenHash) =>
  prisma.employee.findFirst({
    where: {
      verify_token_hash: tokenHash,
      verify_expires_at: { gt: new Date() },
      is_active: true,
    },
    select: { id: true, name: true, pin_hash: true, email_verified_at: true },
  });

const tokenInfo = async (request) => {
  const req = validate(tokenInfoValidation, request);

  const employee = await findByToken(hashToken(req.token));
  if (!employee) throw invalidToken();

  return { name: employee.name, pin_set: employee.pin_hash !== null };
};

const setPin = async (request) => {
  const req = validate(setPinValidation, request);
  const tokenHash = hashToken(req.token);

  const employee = await findByToken(tokenHash);
  if (!employee) throw invalidToken();

  const pinHash = await hashPin(req.pin);
  const now = new Date();

  const { count } = await prisma.employee.updateMany({
    where: {
      id: employee.id,
      verify_token_hash: tokenHash,
      verify_expires_at: { gt: now },
      is_active: true,
    },
    data: {
      pin_hash: pinHash,
      email_verified_at: employee.email_verified_at ?? now,
      verify_token_hash: null,
      verify_expires_at: null,
      pin_failed_count: 0,
      pin_locked_until: null,
    },
  });

  if (count === 0) throw invalidToken();

  return { name: employee.name };
};

export default { tokenInfo, setPin };
