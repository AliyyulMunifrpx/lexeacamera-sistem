"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  FiAlertCircle,
  FiCheck,
  FiLoader,
  FiTrash2,
  FiUploadCloud,
} from "react-icons/fi";

import {
  registerQcMedia,
  requestQcMediaUpload,
} from "../../app/features/qc/api.js";
import { useDeleteQcMedia } from "../../app/features/qc/hooks.js";
import { supabase } from "../../lib/supabase.js";
import { compressVideo } from "../../lib/compress-video.js";
import notify from "../../lib/notify.js";
import { BTN_BASE, FOCUS_RING, Tag, describeQcError } from "./qc-shared.jsx";

const MB = 1024 * 1024;
const LIMITS = {
  PHOTO: { maxSize: 10 * MB, maxCount: 20 },
  VIDEO: { maxSize: 50 * MB, maxCount: 5 },
};
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const EXTENSION_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

/* Beberapa browser mengosongkan file.type (misalnya HEIC), jadi cek ekstensi juga. */
function detectType(file) {
  if (file.type) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[extension] ?? "";
}

/* Kompres video dulu. Kalau gagal atau hasilnya tidak lebih kecil, pakai file asli.
   Asumsi: compressVideo(file) mengembalikan File atau Blob. Ubah di sini kalau berbeda. */
async function prepareVideo(file) {
  try {
    const result = await compressVideo(file);
    if (!(result instanceof Blob) || result.size >= file.size) return file;

    const type = VIDEO_TYPES.includes(result.type) ? result.type : file.type;
    return new File([result], file.name, { type });
  } catch (error) {
    console.warn("Kompres video gagal, memakai file asli.", error);
    return file;
  }
}

const STAGE_LABEL = {
  compress: "Mengompres video…",
  upload: "Mengunggah…",
  save: "Menyimpan…",
  done: "Selesai",
};

let jobCounter = 0;

export default function QcMedia({ qc }) {
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteQcMedia();
  const inputRef = useRef(null);

  const [jobs, setJobs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  const media = qc.media ?? [];
  const photoCount = media.filter((item) => item.kind === "PHOTO").length;
  const videoCount = media.filter((item) => item.kind === "VIDEO").length;

  function patchJob(id, patch) {
    setJobs((current) =>
      current.map((job) => (job.id === id ? { ...job, ...patch } : job)),
    );
  }

  async function uploadOne(file, counts) {
    jobCounter += 1;
    const id = jobCounter;
    setJobs((current) => [
      ...current,
      { id, name: file.name, stage: "upload", error: "" },
    ]);

    try {
      const type = detectType(file);
      const kind = PHOTO_TYPES.includes(type)
        ? "PHOTO"
        : VIDEO_TYPES.includes(type)
          ? "VIDEO"
          : null;

      if (!kind) throw new Error("Format tidak didukung.");

      const limit = LIMITS[kind];
      const used = kind === "PHOTO" ? counts.photo : counts.video;
      if (used >= limit.maxCount) {
        throw new Error(
          `Batas ${limit.maxCount} ${kind === "PHOTO" ? "foto" : "video"} per QC sudah tercapai.`,
        );
      }

      let prepared = file;
      if (kind === "VIDEO") {
        patchJob(id, { stage: "compress" });
        prepared = await prepareVideo(file);
      } else if (!file.type) {
        prepared = new File([file], file.name, { type });
      }

      if (prepared.size > limit.maxSize) {
        throw new Error(
          `Ukuran file melebihi ${Math.round(limit.maxSize / MB)} MB${kind === "VIDEO" ? " walau sudah dikompres" : ""}.`,
        );
      }

      patchJob(id, { stage: "upload" });
      const ticket = await requestQcMediaUpload(qc.id, {
        kind,
        content_type: prepared.type || type,
      });

      const { error } = await supabase.storage
        .from(ticket.bucket)
        .uploadToSignedUrl(ticket.path, ticket.token, prepared);
      if (error) throw error;

      patchJob(id, { stage: "save" });
      await registerQcMedia(qc.id, { kind, path: ticket.path });

      if (kind === "PHOTO") counts.photo += 1;
      else counts.video += 1;

      patchJob(id, { stage: "done" });
      await queryClient.invalidateQueries({
        queryKey: ["quality control", qc.id],
      });
    } catch (err) {
      patchJob(id, {
        stage: "error",
        error: err?.response
          ? describeQcError(err)
          : err?.message || "Gagal mengunggah.",
      });
    }
  }

  async function handleFiles(event) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (files.length === 0 || uploading) return;

    setUploading(true);
    const counts = { photo: photoCount, video: videoCount };
    for (const file of files) {
      // Berurutan supaya kompres video tidak berebut memori.
      await uploadOne(file, counts);
    }
    queryClient.invalidateQueries({ queryKey: ["quality controls"] });
    setUploading(false);
  }

  async function handleDelete(item) {
    try {
      await deleteMutation.mutateAsync({ id: qc.id, mediaId: item.id });
      notify.success("File dihapus.");
    } catch (err) {
      notify.error(describeQcError(err));
    } finally {
      setConfirmId(null);
    }
  }

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-second">Foto dan video</h2>
          <p className="mt-2 text-sm text-second/60">
            Foto maks 10 MB (JPEG, PNG, WebP, HEIC), video maks 50 MB (MP4, MOV,
            WebM). Video dikompres otomatis sebelum diunggah.
          </p>
        </div>
        <div className="flex gap-2">
          <Tag tone="soft">
            {photoCount}/{LIMITS.PHOTO.maxCount} foto
          </Tag>
          <Tag tone="soft">
            {videoCount}/{LIMITS.VIDEO.maxCount} video
          </Tag>
        </div>
      </div>

      <label
        className={`${BTN_BASE} w-full cursor-pointer border border-second/30 text-second hover:border-second4 hover:text-second4 focus-within:ring-4 focus-within:ring-second4/15 sm:w-fit ${
          uploading ? "pointer-events-none opacity-50" : ""
        }`}
      >
        {uploading ? (
          <FiLoader
            className="animate-spin motion-reduce:animate-none"
            size={16}
            aria-hidden="true"
          />
        ) : (
          <FiUploadCloud size={16} aria-hidden="true" />
        )}
        {uploading ? "Memproses…" : "Pilih foto atau video"}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/heic,.heic,video/mp4,video/quicktime,video/webm"
          disabled={uploading}
          onChange={handleFiles}
          className="sr-only"
        />
      </label>

      {jobs.length > 0 && (
        <ul className="flex flex-col gap-2">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="flex items-start gap-2 rounded-xl border border-second/30 px-4 py-2 text-sm"
            >
              {job.stage === "error" ? (
                <FiAlertCircle
                  size={16}
                  className="mt-0.5 shrink-0 text-second2"
                  aria-hidden="true"
                />
              ) : job.stage === "done" ? (
                <FiCheck
                  size={16}
                  className="mt-0.5 shrink-0 text-second3"
                  aria-hidden="true"
                />
              ) : (
                <FiLoader
                  size={16}
                  className="mt-0.5 shrink-0 animate-spin text-second4 motion-reduce:animate-none"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0">
                <p className="break-all font-semibold text-second">
                  {job.name}
                </p>
                <p
                  className={`text-xs ${job.stage === "error" ? "text-second2" : "text-second/60"}`}
                >
                  {job.stage === "error" ? job.error : STAGE_LABEL[job.stage]}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {media.length === 0 ? (
        <p className="text-sm text-second/60">Belum ada foto atau video.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {media.map((item) => (
            <li
              key={item.id}
              className="flex min-w-0 flex-col gap-2 rounded-xl border border-second/30 p-2"
            >
              <div className="aspect-square w-full overflow-hidden rounded-lg bg-second/5">
                {item.kind === "VIDEO" ? (
                  <video
                    src={item.url}
                    controls
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt="Foto QC"
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </a>
                )}
              </div>

              {confirmId === item.id ? (
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className={`${BTN_BASE} border border-second/30 !px-2 !py-1 text-xs text-second ${FOCUS_RING}`}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    disabled={deleteMutation.isPending}
                    className={`${BTN_BASE} bg-second2 !px-2 !py-1 text-xs text-primary disabled:opacity-60 ${FOCUS_RING}`}
                  >
                    Hapus
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <Tag tone="muted">
                    {item.kind === "VIDEO" ? "Video" : "Foto"}
                  </Tag>
                  <button
                    type="button"
                    onClick={() => setConfirmId(item.id)}
                    aria-label="Hapus file"
                    className={`inline-flex size-8 items-center justify-center rounded-full text-second2 transition hover:bg-second2/10 ${FOCUS_RING}`}
                  >
                    <FiTrash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-second/50">
        Link file berlaku sekitar 1 jam. Kalau gambar tidak tampil lagi, muat
        ulang halaman.
      </p>
    </section>
  );
}
