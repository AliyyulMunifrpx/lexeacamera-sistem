import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import { generateToken, hashToken } from "../../utils/secret.js";
import {
  createDeviceValidation,
  idValidation,
  updateDeviceValidation,
} from "../../validation/owner/attendance-validation.js";
import { validate } from "../../validation/validation.js";

const MAX_DEVICES = 3;

const SELECT = {
  id: true,
  label: true,
  is_active: true,
  ip_v4: true,
  ip_v6: true,
  last_seen_at: true,
  ip_changed_at: true,
  created_at: true,
};

const getAllDevice = async () => {
  const devices = await prisma.attendanceDevice.findMany({
    select: SELECT,
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
  });

  return { data: devices };
};

const createDevice = async (request) => {
  const req = validate(createDeviceValidation, request);

  const total = await prisma.attendanceDevice.count();
  if (total >= MAX_DEVICES) {
    throw new ResponseError(409, "DEVICE_LIMIT_REACHED");
  }

  const token = generateToken();
  const device = await prisma.attendanceDevice.create({
    data: { label: req.label, token_hash: hashToken(token) },
    select: SELECT,
  });

  return { ...device, token };
};

const updateDevice = async (request) => {
  const { id, ...fields } = validate(updateDeviceValidation, request);

  const data = {};
  if (fields.label !== undefined) data.label = fields.label;
  if (fields.is_active !== undefined) data.is_active = fields.is_active;

  try {
    return await prisma.attendanceDevice.update({
      where: { id },
      data,
      select: SELECT,
    });
  } catch (error) {
    if (error.code === "P2025") {
      throw new ResponseError(404, "DEVICE_NOT_FOUND");
    }

    throw error;
  }
};

const deleteDevice = async (request) => {
  const req = validate(idValidation, request);

  const { count } = await prisma.attendanceDevice.deleteMany({
    where: { id: req.id },
  });

  if (count === 0) {
    throw new ResponseError(404, "DEVICE_NOT_FOUND");
  }
};

export default { getAllDevice, createDevice, updateDevice, deleteDevice };
