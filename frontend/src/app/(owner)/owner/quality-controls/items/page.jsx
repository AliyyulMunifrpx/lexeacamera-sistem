"use client";

import { useState } from "react";
import Link from "next/link.js";
import { FiArrowLeft, FiLoader, FiPlus } from "react-icons/fi";

import {
  useCreateQcItem,
  useDeleteQcItem,
  useGetQcItems,
  useUpdateQcItem,
} from "../../../../features/qc/hooks.js";
import {
  BTN_BASE,
  BTN_OUTLINE,
  BTN_PRIMARY,
  ErrorText,
  FOCUS_RING,
  QC_PATH,
  SECTIONS,
  Tag,
  describeQcError,
  inputClass,
} from "../../../../../components/owner/qc-shared.jsx";
import notify from "../../../../../lib/notify.js";

function ItemRow({ item }) {
  const updateMutation = useUpdateQcItem();
  const deleteMutation = useDeleteQcItem();
  const busy = updateMutation.isPending || deleteMutation.isPending;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [confirming, setConfirming] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === item.name) {
      setEditing(false);
      setName(item.name);
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: item.id,
        data: { name: trimmed },
      });
      notify.success("Nama item diubah.");
      setEditing(false);
    } catch (err) {
      notify.error(describeQcError(err));
    }
  }

  async function toggleActive() {
    try {
      await updateMutation.mutateAsync({
        id: item.id,
        data: { is_active: !item.is_active },
      });
    } catch (err) {
      notify.error(describeQcError(err));
    }
  }

  async function remove() {
    try {
      await deleteMutation.mutateAsync(item.id);
      notify.success("Item dihapus.");
    } catch (err) {
      notify.error(describeQcError(err));
      setConfirming(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-4">
        {editing ? (
          <input
            type="text"
            value={name}
            maxLength={100}
            autoFocus
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") save();
              if (event.key === "Escape") {
                setEditing(false);
                setName(item.name);
              }
            }}
            aria-label="Nama item"
            className={inputClass(false)}
          />
        ) : (
          <p
            className={`min-w-0 break-words text-sm font-semibold ${item.is_active ? "text-second" : "text-second/40 line-through"}`}
          >
            {item.name}
          </p>
        )}

        <button
          type="button"
          role="switch"
          aria-checked={item.is_active}
          aria-label={`Aktifkan ${item.name}`}
          disabled={busy}
          onClick={toggleActive}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            item.is_active ? "bg-grad" : "bg-second/20"
          } ${FOCUS_RING}`}
        >
          <span
            aria-hidden="true"
            className={`inline-block size-5 rounded-full bg-primary shadow transition-transform ${
              item.is_active ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {confirming ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2">
          <span className="text-xs text-second2">
            Hapus item? QC lama tetap menyimpan namanya.
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className={`${BTN_BASE} border border-second/30 !px-2 !py-1 text-xs text-second ${FOCUS_RING}`}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className={`${BTN_BASE} bg-second2 !px-2 !py-1 text-xs text-primary disabled:opacity-60 ${FOCUS_RING}`}
            >
              Hapus
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {editing ? (
            <>
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className={`${BTN_BASE} bg-grad !px-2 !py-1 text-xs text-primary disabled:opacity-60 ${FOCUS_RING}`}
              >
                Simpan
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setName(item.name);
                }}
                disabled={busy}
                className={`${BTN_BASE} border border-second/30 !px-2 !py-1 text-xs text-second ${FOCUS_RING}`}
              >
                Batal
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className={`${BTN_BASE} border border-second/30 !px-2 !py-1 text-xs text-second hover:border-second4 hover:text-second4 ${FOCUS_RING}`}
              >
                Ubah nama
              </button>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className={`${BTN_BASE} border border-second2/30 !px-2 !py-1 text-xs text-second2 hover:bg-second2/5 ${FOCUS_RING}`}
              >
                Hapus
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

function SectionCard({ section, items }) {
  const createMutation = useCreateQcItem();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function add(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Isi nama item.");
      return;
    }
    try {
      await createMutation.mutateAsync({
        section: section.value,
        name: trimmed,
      });
      setName("");
      setError("");
    } catch (err) {
      setError(describeQcError(err));
    }
  }

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-second">{section.label}</h2>
          <p className="mt-2 text-sm text-second/60">{section.description}</p>
        </div>
        <Tag tone="soft">{items.length} item</Tag>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-second/60">Belum ada item.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-second/10 rounded-xl border border-second/30">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </ul>
      )}

      <form onSubmit={add} noValidate>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            maxLength={100}
            autoComplete="off"
            disabled={createMutation.isPending}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
            placeholder="Nama item baru"
            aria-label={`Item baru ${section.label}`}
            aria-invalid={error ? "true" : undefined}
            className={inputClass(Boolean(error))}
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className={`${BTN_OUTLINE} shrink-0`}
          >
            {createMutation.isPending ? (
              <FiLoader
                className="animate-spin motion-reduce:animate-none"
                size={16}
                aria-hidden="true"
              />
            ) : (
              <FiPlus size={16} aria-hidden="true" />
            )}
            Tambah
          </button>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
      </form>
    </section>
  );
}

export default function QcItemsPage() {
  const query = useGetQcItems({});
  const items = query.data ?? [];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        <Link
          href={QC_PATH}
          className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke daftar QC
        </Link>
        <div className="min-w-0">
          <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
            Item <span className="text-grad">checklist</span>
          </h1>
          <p className="mt-2 text-pretty text-sm text-second/60">
            Daftar pilihan di form QC. Perubahan hanya berlaku untuk QC
            berikutnya. QC lama tetap menyimpan nama aslinya. Untuk sekadar
            menyembunyikan item dari form, matikan saklarnya.
          </p>
        </div>
      </header>

      {query.isPending ? (
        <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
      ) : query.isError ? (
        <div className="flex flex-col items-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
          <p className="text-lg font-bold text-second">Gagal memuat item</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className={`${BTN_PRIMARY} mt-4`}
          >
            Coba lagi
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-2">
          {SECTIONS.map((section) => (
            <SectionCard
              key={section.value}
              section={section}
              items={items.filter((item) => item.section === section.value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
