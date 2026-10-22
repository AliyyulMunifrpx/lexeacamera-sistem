import { ResponseError } from "../error/response-error.js";
import { prisma } from "../lib/database.js";
import {
  createCategoryValidation,
  deleteCategoryValidation,
  editCategoryValidation,
} from "../validation/category-validation.js";
import { validate } from "../validation/validation.js";

const create = async function (request) {
  const req = validate(createCategoryValidation, request);

  try {
    const category = await prisma.category.create({
      data: {
        name: req.name,
      },
    });

    return category;
  } catch (e) {
    if (e.code === "P2002") {
      throw new ResponseError(409, "CATEGORY_ALREADY_EXIST");
    }

    throw e;
  }
};
const getAllCategory = async function () {
  return await prisma.category.findMany({
    select: { id: true, name: true, created_at: true },
    orderBy: { created_at: "desc" },
  });
};
const updateCategory = async function (request) {
  const req = validate(editCategoryValidation, request);
  const existingCategory = await prisma.category.findFirst({
    where: {
      id: req.id,
    },
  });
  if (!existingCategory) {
    throw new ResponseError(404, "CATEGORY_NOT_FOUND");
  }
  try {
    const category = await prisma.category.update({
      where: {
        id: req.id,
      },
      data: {
        name: req.name,
      },
    });

    return category;
  } catch (e) {
    if (e.code === "P2002") {
      throw new ResponseError(409, "CATEGORY_ALREADY_EXIST");
    }

    throw e;
  }
};
const deleteCategory = async function (request) {
  const req = validate(deleteCategoryValidation, request);

  const category = await prisma.category.findUnique({
    where: { id: req.id },
    select: {
      id: true,
      _count: {
        select: {
          cameras: {
            where: { is_deleted: false },
          },
        },
      },
    },
  });

  // 1. Cek apakah kategori ditemukan
  if (!category) {
    throw new ResponseError(404, "CATEGORY_NOT_FOUND");
  }

  // 2. Cek apakah masih ada kamera aktif yang pakai kategori ini
  if (category._count.cameras > 0) {
    throw new ResponseError(400, "CATEGORY_STILL_IN_USE");
  }

  // 3. Hapus kategori (Hard delete atau Soft delete disesuaikan)
  return await prisma.category.delete({
    where: { id: req.id },
  });
};
export default {
  create,
  getAllCategory,
  updateCategory,
  deleteCategory,
};
