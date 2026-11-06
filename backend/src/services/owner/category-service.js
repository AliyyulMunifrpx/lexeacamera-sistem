import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import {
  createCategoryValidation,
  deleteCategoryValidation,
  editCategoryValidation,
} from "../../validation/owner/category-validation.js";
import { validate } from "../../validation/validation.js";

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

  try {
    return await prisma.$transaction(async (tx) => {
      const category = await tx.category.findUnique({
        where: { id: req.id },
        select: {
          id: true,
          _count: {
            select: { cameras: { where: { is_deleted: false } } },
          },
        },
      });

      if (!category) {
        throw new ResponseError(404, "CATEGORY_NOT_FOUND");
      }

      if (category._count.cameras > 0) {
        throw new ResponseError(400, "CATEGORY_STILL_IN_USE");
      }

      // Kamera yang sudah soft delete dilepas dari kategori ini
      await tx.camera.updateMany({
        where: { category_id: req.id, is_deleted: true },
        data: { category_id: null },
      });

      return await tx.category.delete({ where: { id: req.id } });
    });
  } catch (error) {
    // Jaring pengaman: ada kamera aktif yang baru masuk saat proses berjalan
    if (error.code === "P2003") {
      throw new ResponseError(400, "CATEGORY_STILL_IN_USE");
    }
    throw error;
  }
};
export default {
  create,
  getAllCategory,
  updateCategory,
  deleteCategory,
};
