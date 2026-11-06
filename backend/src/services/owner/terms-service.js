import { prisma } from "../../lib/database.js";
import { updateTermsValidation } from "../../validation/owner/terms-validation.js";
import { validate } from "../../validation/validation.js";

// Hanya ada satu baris terms (seperti Store)
const findTerms = (client) =>
  client.termsandcondition.findFirst({ orderBy: { id: "asc" } });

const getTerms = async () => {
  const terms = await findTerms(prisma);

  // Belum pernah diisi bukan error: value null
  return { value: terms?.value ?? null };
};

// Membuat kalau belum ada, mengganti kalau sudah ada
const updateTerms = async (request) => {
  const req = validate(updateTermsValidation, request);
  const value = req.value === "" ? null : req.value;

  const saved = await prisma.$transaction(
    async (tx) => {
      // Dua PUT bersamaan saat tabel masih kosong tidak boleh membuat dua baris.
      // Kunci advisory (khusus PostgreSQL) membuat keduanya antre.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('terms_and_condition'))`;

      const existing = await findTerms(tx);

      if (existing) {
        return await tx.termsandcondition.update({
          where: { id: existing.id },
          data: { value },
        });
      }

      return await tx.termsandcondition.create({ data: { value } });
    },
    { timeout: 15000 },
  );

  return { value: saved.value };
};

export default { getTerms, updateTerms };
