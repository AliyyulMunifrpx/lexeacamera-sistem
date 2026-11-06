import { supabase } from "../../application/supabase.js";
import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import { getAllowedOrigins } from "../../utils/auth-cookies.js";
import {
  adminIdValidation,
  createAdminValidation,
  getAllAdminValidation,
  updateAdminValidation,
} from "../../validation/owner/admin-validation.js";
import { validate } from "../../validation/validation.js";

const PER_PAGE = 20;

const SELECT = {
  id: true,
  name: true,
  email: true,
  is_active: true,
  employee: { select: { id: true, is_active: true, pin_hash: true } },
};

const serialize = ({ employee, ...admin }) => ({
  ...admin,
  attendance: {
    enabled: employee !== null && employee.is_active,
    pin_set: employee !== null && employee.pin_hash !== null,
  },
});

const redirectUrl = () => {
  const origin = getAllowedOrigins()[0];

  if (!origin) {
    throw new ResponseError(500, "FRONTEND_URL_NOT_CONFIGURED");
  }

  return `${origin}/auth/set-password`;
};

const inviteError = (error, alreadyCode) => {
  const text = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();

  if (error.status === 429 || text.includes("rate limit")) {
    return new ResponseError(429, "INVITE_RATE_LIMITED");
  }
  if (text.includes("already") || text.includes("email_exists")) {
    return new ResponseError(409, alreadyCode);
  }

  console.error("Supabase invite failed:", error.message);
  return new ResponseError(502, "INVITE_FAILED");
};

const sendInvite = async (admin, alreadyCode) => {
  const redirectTo = redirectUrl();
  let result;

  try {
    result = await supabase.auth.admin.inviteUserByEmail(admin.email, {
      redirectTo,
      data: { name: admin.name },
    });
  } catch (error) {
    console.error("Supabase invite threw:", error);
    throw new ResponseError(502, "INVITE_FAILED");
  }

  if (result.error) throw inviteError(result.error, alreadyCode);
  if (!result.data?.user?.id) throw new ResponseError(502, "INVITE_FAILED");

  return result.data.user.id;
};

const isInviteAccepted = async (supabaseId) => {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(supabaseId);
    if (error || !data?.user) return null;

    return Boolean(data.user.email_confirmed_at ?? data.user.confirmed_at);
  } catch {
    return null;
  }
};

const dropSupabaseUser = async (supabaseId) => {
  try {
    await supabase.auth.admin.deleteUser(supabaseId);
  } catch (error) {
    console.error("Supabase cleanup failed:", error);
  }
};

// Hubungkan admin ke data karyawan: pakai karyawan lama dengan email sama
// (kalau belum terhubung ke akun lain), kalau tidak ada buat baru.
const enableAttendance = async (tx, admin) => {
  const existing = await tx.employee.findUnique({
    where: { email: admin.email },
    select: { id: true, user_id: true },
  });

  if (existing && existing.user_id !== null && existing.user_id !== admin.id) {
    throw new ResponseError(409, "EMAIL_ALREADY_USED");
  }

  if (existing) {
    await tx.employee.update({
      where: { id: existing.id },
      data: {
        name: admin.name,
        user_id: admin.id,
        is_active: true,
        verify_token_hash: null,
        verify_expires_at: null,
      },
    });
    return;
  }

  await tx.employee.create({
    data: { name: admin.name, email: admin.email, user_id: admin.id },
    select: { id: true },
  });
};

const createAdmin = async (request) => {
  const req = validate(createAdminValidation, request);

  const [user, employee] = await Promise.all([
    prisma.user.findUnique({ where: { email: req.email }, select: { id: true } }),
    prisma.employee.findUnique({
      where: { email: req.email },
      select: { user_id: true },
    }),
  ]);

  if (user || employee?.user_id) {
    throw new ResponseError(409, "EMAIL_ALREADY_USED");
  }

  const supabaseId = await sendInvite(req, "EMAIL_ALREADY_USED");

  try {
    const id = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          supabase_id: supabaseId,
          name: req.name,
          email: req.email,
          role: "ADMIN",
        },
        select: { id: true },
      });

      if (req.attendance) {
        await enableAttendance(tx, { ...req, id: created.id });
      }

      return created.id;
    });

    const admin = await prisma.user.findUnique({ where: { id }, select: SELECT });

    return serialize(admin);
  } catch (error) {
    await dropSupabaseUser(supabaseId);

    if (error.code === "P2002") {
      throw new ResponseError(409, "EMAIL_ALREADY_USED");
    }

    throw error;
  }
};

const getAllAdmin = async (request) => {
  const req = validate(getAllAdminValidation, request);

  const where = { role: "ADMIN" };
  if (req.status === "ACTIVE") where.is_active = true;
  if (req.status === "INACTIVE") where.is_active = false;
  if (req.search) {
    where.OR = [
      { name: { contains: req.search, mode: "insensitive" } },
      { email: { contains: req.search, mode: "insensitive" } },
    ];
  }

  const [admins, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: SELECT,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (req.page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: admins.map(serialize),
    paging: {
      page: req.page,
      per_page: PER_PAGE,
      total,
      total_pages: Math.ceil(total / PER_PAGE),
    },
  };
};

const getAdmin = async (request) => {
  const req = validate(adminIdValidation, request);

  const admin = await prisma.user.findFirst({
    where: { id: req.id, role: "ADMIN" },
    select: { ...SELECT, supabase_id: true },
  });

  if (!admin) {
    throw new ResponseError(404, "ADMIN_NOT_FOUND");
  }

  const { supabase_id, ...rest } = admin;

  return {
    ...serialize(rest),
    invite_accepted: await isInviteAccepted(supabase_id),
  };
};

const updateAdmin = async (request) => {
  const { id, ...fields } = validate(updateAdminValidation, request);

  const current = await prisma.user.findFirst({
    where: { id, role: "ADMIN" },
    select: { id: true, name: true, email: true, is_active: true, employee: { select: { id: true } } },
  });

  if (!current) {
    throw new ResponseError(404, "ADMIN_NOT_FOUND");
  }

  const nextActive = fields.is_active ?? current.is_active;
  if (fields.attendance === true && !nextActive) {
    throw new ResponseError(409, "ADMIN_INACTIVE");
  }

  const nextName = fields.name ?? current.name;

  try {
    await prisma.$transaction(async (tx) => {
      const data = {};
      if (fields.name !== undefined) data.name = fields.name;
      if (fields.is_active !== undefined) data.is_active = fields.is_active;
      if (Object.keys(data).length > 0) {
        await tx.user.update({ where: { id }, data, select: { id: true } });
      }

      if (fields.attendance === true) {
        if (current.employee) {
          await tx.employee.update({
            where: { id: current.employee.id },
            data: { name: nextName, is_active: true },
            select: { id: true },
          });
        } else {
          await enableAttendance(tx, { id, email: current.email, name: nextName });
        }
        return;
      }

      if (!current.employee) return;

      const employeeData = {};
      if (fields.name !== undefined) employeeData.name = fields.name;
      if (fields.attendance === false || fields.is_active === false) {
        employeeData.is_active = false;
      }
      if (Object.keys(employeeData).length > 0) {
        await tx.employee.update({
          where: { id: current.employee.id },
          data: employeeData,
          select: { id: true },
        });
      }
    });
  } catch (error) {
    if (error.code === "P2025") {
      throw new ResponseError(404, "ADMIN_NOT_FOUND");
    }
    if (error.code === "P2002") {
      throw new ResponseError(409, "EMAIL_ALREADY_USED");
    }

    throw error;
  }

  const admin = await prisma.user.findUnique({ where: { id }, select: SELECT });

  return serialize(admin);
};

const resendInvite = async (request) => {
  const req = validate(adminIdValidation, request);

  const admin = await prisma.user.findFirst({
    where: { id: req.id, role: "ADMIN" },
    select: { id: true, name: true, email: true, is_active: true, supabase_id: true },
  });

  if (!admin) {
    throw new ResponseError(404, "ADMIN_NOT_FOUND");
  }
  if (!admin.is_active) {
    throw new ResponseError(409, "ADMIN_INACTIVE");
  }
  if ((await isInviteAccepted(admin.supabase_id)) === true) {
    throw new ResponseError(409, "INVITE_ALREADY_ACCEPTED");
  }

  await sendInvite(admin, "INVITE_ALREADY_ACCEPTED");

  return { id: admin.id, email: admin.email, email_sent: true };
};

export default { createAdmin, getAllAdmin, getAdmin, updateAdmin, resendInvite };
