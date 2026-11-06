import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import { getAllowedOrigins } from "../../utils/auth-cookies.js";
import { sendMail } from "../../utils/mailer.js";
import { generateToken, hashToken } from "../../utils/secret.js";
import {
  createEmployeeValidation,
  employeeIdValidation,
  getAllEmployeeValidation,
  updateEmployeeValidation,
} from "../../validation/owner/employee-validation.js";
import { validate } from "../../validation/validation.js";

const PER_PAGE = 20;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_GAP_MS = 60 * 1000;

const SELECT = {
  id: true,
  name: true,
  email: true,
  is_active: true,
  user_id: true,
  pin_hash: true,
  email_verified_at: true,
  verify_sent_at: true,
  created_at: true,
};

const serialize = ({ pin_hash, user_id, ...employee }) => {
  const pinSet = pin_hash !== null;
  const ready = pinSet && (employee.email_verified_at !== null || user_id !== null);

  return {
    ...employee,
    pin_set: pinSet,
    linked_to_user: user_id !== null,
    status: !employee.is_active ? "INACTIVE" : ready ? "READY" : "PENDING",
  };
};

const issueToken = () => {
  const token = generateToken();
  const now = new Date();

  return {
    token,
    fields: {
      verify_token_hash: hashToken(token),
      verify_expires_at: new Date(now.getTime() + TOKEN_TTL_MS),
      verify_sent_at: now,
    },
  };
};

const deliverLink = async (employee, token) => {
  const origin = getAllowedOrigins()[0];

  if (!origin) {
    throw new ResponseError(500, "FRONTEND_URL_NOT_CONFIGURED");
  }

  const link = `${origin}/employee/set-pin?token=${token}`;

  try {
    await sendMail({
      to: employee.email,
      subject: "Atur PIN absen WAV Camera",
      text: [
        `Halo ${employee.name},`,
        "",
        "Klik tautan berikut untuk memverifikasi email dan membuat PIN absen Anda.",
        "Tautan berlaku 24 jam dan hanya bisa dipakai sekali.",
        "",
        link,
        "",
        "Kalau Anda tidak merasa mendaftar, abaikan email ini.",
      ].join("\n"),
    });
  } catch (error) {
    if (error instanceof ResponseError) throw error;

    console.error("Failed to send employee email:", error);
    throw new ResponseError(502, "MAIL_SEND_FAILED");
  }
};

const createEmployee = async (request) => {
  const req = validate(createEmployeeValidation, request);
  const { token, fields } = issueToken();

  let employee;
  try {
    employee = await prisma.employee.create({
      data: { name: req.name, email: req.email, ...fields },
      select: SELECT,
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw new ResponseError(409, "EMAIL_ALREADY_USED");
    }

    throw error;
  }

  let emailSent = true;
  try {
    await deliverLink(employee, token);
  } catch (error) {
    console.error("Employee created but email not sent:", error.message);
    emailSent = false;
  }

  return { ...serialize(employee), email_sent: emailSent };
};

const getAllEmployee = async (request) => {
  const req = validate(getAllEmployeeValidation, request);

  const where = {};
  if (req.status === "ACTIVE") where.is_active = true;
  if (req.status === "INACTIVE") where.is_active = false;
  if (req.search) {
    where.OR = [
      { name: { contains: req.search, mode: "insensitive" } },
      { email: { contains: req.search, mode: "insensitive" } },
    ];
  }

  const [employees, total] = await prisma.$transaction([
    prisma.employee.findMany({
      where,
      select: SELECT,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      skip: (req.page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.employee.count({ where }),
  ]);

  return {
    data: employees.map(serialize),
    paging: {
      page: req.page,
      per_page: PER_PAGE,
      total,
      total_pages: Math.ceil(total / PER_PAGE),
    },
  };
};

const getEmployee = async (request) => {
  const req = validate(employeeIdValidation, request);

  const employee = await prisma.employee.findUnique({
    where: { id: req.id },
    select: SELECT,
  });

  if (!employee) {
    throw new ResponseError(404, "EMPLOYEE_NOT_FOUND");
  }

  return serialize(employee);
};

const updateEmployee = async (request) => {
  const { id, ...fields } = validate(updateEmployeeValidation, request);

  const current = await prisma.employee.findUnique({
    where: { id },
    select: { id: true, email: true, user_id: true },
  });

  if (!current) {
    throw new ResponseError(404, "EMPLOYEE_NOT_FOUND");
  }

  const data = {};
  if (fields.name !== undefined) data.name = fields.name;
  if (fields.is_active !== undefined) data.is_active = fields.is_active;

  let token = null;
  if (fields.email !== undefined && fields.email !== current.email) {
    if (current.user_id) {
      throw new ResponseError(400, "EMPLOYEE_LINKED_TO_USER");
    }

    const issued = issueToken();
    token = issued.token;
    Object.assign(data, issued.fields, {
      email: fields.email,
      email_verified_at: null,
      pin_hash: null,
    });
  }

  let employee;
  try {
    employee = await prisma.employee.update({
      where: { id },
      data,
      select: SELECT,
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw new ResponseError(409, "EMAIL_ALREADY_USED");
    }
    if (error.code === "P2025") {
      throw new ResponseError(404, "EMPLOYEE_NOT_FOUND");
    }

    throw error;
  }

  if (!token) return serialize(employee);

  let emailSent = true;
  try {
    await deliverLink(employee, token);
  } catch (error) {
    console.error("Employee updated but email not sent:", error.message);
    emailSent = false;
  }

  return { ...serialize(employee), email_sent: emailSent };
};

const resendVerification = async (request) => {
  const req = validate(employeeIdValidation, request);

  const current = await prisma.employee.findUnique({
    where: { id: req.id },
    select: { id: true, name: true, email: true, user_id: true, is_active: true },
  });

  if (!current) {
    throw new ResponseError(404, "EMPLOYEE_NOT_FOUND");
  }
  if (current.user_id) {
    throw new ResponseError(400, "EMPLOYEE_LINKED_TO_USER");
  }
  if (!current.is_active) {
    throw new ResponseError(409, "EMPLOYEE_INACTIVE");
  }

  const { token, fields } = issueToken();

  const { count } = await prisma.employee.updateMany({
    where: {
      id: req.id,
      OR: [
        { verify_sent_at: null },
        { verify_sent_at: { lt: new Date(Date.now() - RESEND_GAP_MS) } },
      ],
    },
    data: fields,
  });

  if (count === 0) {
    throw new ResponseError(429, "VERIFICATION_RECENTLY_SENT");
  }

  await deliverLink(current, token);

  return { id: current.id, email: current.email, email_sent: true };
};

export default {
  createEmployee,
  getAllEmployee,
  getEmployee,
  updateEmployee,
  resendVerification,
};
