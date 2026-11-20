import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import { parseCidr } from "../../utils/network.js";
import {
  createNetworkValidation,
  idValidation,
  updateNetworkValidation,
  updateSettingValidation,
} from "../../validation/owner/attendance-validation.js";
import { validate } from "../../validation/validation.js";

const MAX_NETWORKS = 20;

const SELECT = { id: true, cidr: true, label: true, is_active: true, created_at: true };

const canonicalCidr = (input) => {
  const parsed = parseCidr(input);

  if (!parsed) {
    throw new ResponseError(400, "INVALID_CIDR");
  }
  if (parsed.tooBroad) {
    throw new ResponseError(400, "CIDR_TOO_BROAD");
  }

  return parsed.cidr;
};

const getAllNetwork = async () => {
  const networks = await prisma.attendanceNetwork.findMany({
    select: SELECT,
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
  });

  return { data: networks };
};

const createNetwork = async (request) => {
  const req = validate(createNetworkValidation, request);
  const cidr = canonicalCidr(req.cidr);

  const total = await prisma.attendanceNetwork.count();
  if (total >= MAX_NETWORKS) {
    throw new ResponseError(409, "NETWORK_LIMIT_REACHED");
  }

  try {
    return await prisma.attendanceNetwork.create({
      data: { cidr, label: req.label },
      select: SELECT,
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw new ResponseError(409, "NETWORK_ALREADY_EXISTS");
    }

    throw error;
  }
};

const updateNetwork = async (request) => {
  const { id, ...fields } = validate(updateNetworkValidation, request);

  const data = {};
  if (fields.label !== undefined) data.label = fields.label;
  if (fields.is_active !== undefined) data.is_active = fields.is_active;
  if (fields.cidr !== undefined) data.cidr = canonicalCidr(fields.cidr);

  try {
    return await prisma.attendanceNetwork.update({
      where: { id },
      data,
      select: SELECT,
    });
  } catch (error) {
    if (error.code === "P2025") {
      throw new ResponseError(404, "NETWORK_NOT_FOUND");
    }
    if (error.code === "P2002") {
      throw new ResponseError(409, "NETWORK_ALREADY_EXISTS");
    }

    throw error;
  }
};

const deleteNetwork = async (request) => {
  const req = validate(idValidation, request);

  const { count } = await prisma.attendanceNetwork.deleteMany({
    where: { id: req.id },
  });

  if (count === 0) {
    throw new ResponseError(404, "NETWORK_NOT_FOUND");
  }
};

const readSetting = async () => {
  const [store, activeNetworks, activeDevices] = await prisma.$transaction([
    prisma.store.findFirst({
      orderBy: { id: "asc" },
      select: { id: true, attendance_require_network: true },
    }),
    prisma.attendanceNetwork.count({ where: { is_active: true } }),
    prisma.attendanceDevice.count({ where: { is_active: true } }),
  ]);

  if (!store) {
    throw new ResponseError(503, "STORE_NOT_READY");
  }

  return { store, activeNetworks, activeDevices };
};

const getSetting = async () => {
  const { store, activeNetworks, activeDevices } = await readSetting();

  return {
    require_network: store.attendance_require_network,
    active_networks: activeNetworks,
    active_devices: activeDevices,
  };
};

const updateSetting = async (request) => {
  const req = validate(updateSettingValidation, request);
  const { store } = await readSetting();

  await prisma.store.update({
    where: { id: store.id },
    data: { attendance_require_network: req.require_network },
  });

  return getSetting();
};

export default {
  getAllNetwork,
  createNetwork,
  updateNetwork,
  deleteNetwork,
  getSetting,
  updateSetting,
};
