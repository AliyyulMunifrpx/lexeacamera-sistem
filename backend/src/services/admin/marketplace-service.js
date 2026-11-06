import { prisma } from "../../lib/database.js";

// Hanya marketplace aktif: itu satu-satunya yang boleh dipilih saat mengubah
// link marketplace kamera.
const getAllMarketplace = async () =>
  prisma.marketplace.findMany({
    where: { is_active: true },
    select: { id: true, name: true, logo_url: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

export default { getAllMarketplace };
