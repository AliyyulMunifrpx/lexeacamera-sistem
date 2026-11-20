import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import { describeIp } from "../../utils/network.js";
import { hashToken } from "../../utils/secret.js";

const TOKEN_FORMAT = /^[0-9a-f]{64}$/;

const heartbeat = async (request) => {
  const { ip, token } = request;

  if (typeof token !== "string" || !TOKEN_FORMAT.test(token)) {
    throw new ResponseError(401, "DEVICE_TOKEN_INVALID");
  }

  const info = describeIp(ip);
  if (!info) {
    throw new ResponseError(500, "IP_NOT_DETECTED");
  }

  const device = await prisma.attendanceDevice.findUnique({
    where: { token_hash: hashToken(token) },
    select: { id: true, is_active: true, ip_v4: true, ip_v6: true },
  });

  if (!device || !device.is_active) {
    throw new ResponseError(401, "DEVICE_TOKEN_INVALID");
  }

  const field = info.family === 4 ? "ip_v4" : "ip_v6";
  const value = info.family === 4 ? info.ip : info.suggested_cidr;
  const now = new Date();
  const data = { last_seen_at: now };

  if (device[field] !== value) {
    data[field] = value;
    data.ip_changed_at = now;
  }

  const { count } = await prisma.attendanceDevice.updateMany({
    where: { id: device.id, is_active: true },
    data,
  });

  if (count === 0) {
    throw new ResponseError(401, "DEVICE_TOKEN_INVALID");
  }

  return { ip: info.ip, family: info.family, changed: field in data };
};

export default { heartbeat };
