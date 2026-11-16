import { supabase } from "../../application/supabase.js";
import { ResponseError } from "../../error/response-error.js";
import { prisma } from "../../lib/database.js";
import { bulkDeleteCameraValidation } from "../../validation/owner/camera-bulk-delete-validation.js";
import { validate } from "../../validation/validation.js";

const BUCKET = process.env.SUPABASE_CAMERA_BUCKET;
const CLEANUP_CONCURRENCY = 5;

const removeCameraFolder = async (cameraId) => {
  const folder = `cameras/${cameraId}`;

  try {
    const { data: files, error } = await supabase.storage
      .from(BUCKET)
      .list(folder, { limit: 100 });

    if (error) throw error;
    if (!files?.length) return;

    const paths = files.map((file) => `${folder}/${file.name}`);

    const { data: removed, error: removeError } = await supabase.storage
      .from(BUCKET)
      .remove(paths);

    if (removeError) throw removeError;

    if ((removed?.length ?? 0) !== paths.length) {
      console.error("Camera images not fully removed:", {
        cameraId,
        expected: paths.length,
        removed: removed?.length ?? 0,
      });
    }
  } catch (error) {
    console.error("Failed to clean up camera images:", { cameraId, error });
  }
};

const removeFolders = async (ids) => {
  for (let i = 0; i < ids.length; i += CLEANUP_CONCURRENCY) {
    await Promise.all(
      ids.slice(i, i + CLEANUP_CONCURRENCY).map(removeCameraFolder),
    );
  }
};

const deleteCameras = async (request) => {
  const req = validate(bulkDeleteCameraValidation, request);

  if (!BUCKET) {
    throw new ResponseError(500, "CAMERA_BUCKET_NOT_CONFIGURED");
  }

  const requested = [...new Set(req.ids)].sort();

  const deletedIds = await prisma.$transaction(
    async (tx) => {
      for (const id of requested) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}::text))`;
      }

      const found = await tx.camera.findMany({
        where: { id: { in: requested }, is_deleted: false },
        select: { id: true },
      });
      const ids = found.map((camera) => camera.id).sort();

      if (!ids.length) {
        throw new ResponseError(404, "CAMERA_NOT_FOUND", {
          camera_ids: requested,
        });
      }

      const { count } = await tx.camera.updateMany({
        where: { id: { in: ids }, is_deleted: false },
        data: { is_deleted: true },
      });
      if (count !== ids.length) {
        throw new ResponseError(409, "CAMERA_CHANGED");
      }

      await tx.cameraImage.deleteMany({ where: { camera_id: { in: ids } } });

      return ids;
    },
    { timeout: 30000 },
  );

  await removeFolders(deletedIds);

  const deleted = new Set(deletedIds);

  return {
    deleted: deletedIds.length,
    deleted_ids: deletedIds,
    not_found_ids: requested.filter((id) => !deleted.has(id)),
  };
};

export default { deleteCameras };
