"use client";

import { useState } from "react";
import Link from "next/link.js";
import { FiLoader, FiPlus, FiSave, FiTrash2 } from "react-icons/fi";

import {
  BTN_OUTLINE,
  BTN_PRIMARY,
  ErrorText,
  FOCUS_RING,
  SECTIONS,
  STATUS_LABEL,
  Tag,
  TYPE_LABEL,
  formatRupiah,
  formatThousands,
  inputClass,
  labelClass,
  todayWib,
} from "./qc-shared.jsx";

const MAX_ENTRIES = 150;
const MAX_EXTRAS = 30;
const MAX_PRICE = 2147483647;

const SECTION_FIELD = {
  PHYSICAL: "physical",
  FUNCTION: "functions",
  ACCESSORY: "accessories",
  COMPLETENESS: "completeness",
};

/* Placeholder kolom "tambah item sekali pakai" di tiap bagian. */
const ADD_PLACEHOLDER = {
  PHYSICAL: "Kerusakan lain khusus unit ini, contoh: Terbakar",
  FUNCTION: "Fungsi lain khusus unit ini, contoh: Autofocus",
  ACCESSORY: "Komponen lain khusus unit ini, contoh: Grip",
  COMPLETENESS: "Kelengkapan lain khusus unit ini, contoh: Kartu garansi",
};

let keyCounter = 0;
const nextKey = (prefix) => {
  keyCounter += 1;
  return `${prefix}-${keyCounter}`;
};

/* ------------------------------ Baris checklist ---------------------------- */

function newRow(values = {}) {
  return {
    key: nextKey("row"),
    item_id: null,
    section: "PHYSICAL",
    name: "",
    custom: false,
    checked: false,
    classification: "NORMAL",
    origin: "",
    note: "",
    ...values,
  };
}

function rowFromEntry(section, entry) {
  return newRow({
    item_id: entry.item_id ?? null,
    section,
    name: entry.name,
    custom: !entry.item_id,
    checked: Boolean(entry.checked),
    classification: entry.classification ?? "NORMAL",
    origin: entry.origin ?? "",
    note: entry.note ?? "",
  });
}

/* Create: semua item master aktif. Edit: isi QC + item master aktif yang belum ada. */
function buildRows(items, qc) {
  if (!qc) {
    return items.map((item) =>
      newRow({ item_id: item.id, section: item.section, name: item.name }),
    );
  }

  const entries = SECTIONS.flatMap(({ value }) =>
    (qc[SECTION_FIELD[value]] ?? []).map((entry) => ({
      section: value,
      entry,
    })),
  );
  const byItem = new Map(
    entries.filter((x) => x.entry.item_id).map((x) => [x.entry.item_id, x]),
  );
  const used = new Set();
  const rows = [];

  for (const item of items) {
    const found = byItem.get(item.id);
    if (found) {
      used.add(item.id);
      rows.push(rowFromEntry(found.section, found.entry));
    } else {
      rows.push(
        newRow({ item_id: item.id, section: item.section, name: item.name }),
      );
    }
  }

  for (const { section, entry } of entries) {
    if (entry.item_id && used.has(entry.item_id)) continue;
    rows.push(rowFromEntry(section, entry));
  }

  return rows;
}

function toEntry(row) {
  const base = row.item_id
    ? { item_id: row.item_id }
    : { section: row.section, name: row.name.trim() };
  const note = row.note.trim();
  const withNote = { ...base, ...(note && { note }) };

  if (row.section === "PHYSICAL") {
    return { ...withNote, checked: row.checked };
  }
  if (row.section === "COMPLETENESS") {
    return {
      ...withNote,
      checked: row.checked,
      ...(row.checked && row.origin && { origin: row.origin }),
    };
  }
  return { ...withNote, classification: row.classification };
}

/* --------------------------------- Pieces --------------------------------- */

function Section({ title, description, aside, children }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h2 className="text-lg font-bold text-second">{title}</h2>
          {description && (
            <p className="mt-2 text-pretty text-sm text-second/60">
              {description}
            </p>
          )}
        </div>
        {aside}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Field({ id, label, required, error, hint, children }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>
        {label}
        {required ? (
          <span className="ml-2 text-second2" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ml-2 text-xs font-normal text-second/50">
            Opsional
          </span>
        )}
      </label>
      {children}
      {error ? (
        <ErrorText id={`${id}-error`}>{error}</ErrorText>
      ) : (
        hint && <p className="mt-2 text-xs text-second/60">{hint}</p>
      )}
    </div>
  );
}

function Pill({ active, onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`inline-flex h-8 items-center rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-50 ${FOCUS_RING} ${
        active
          ? "border-second4 bg-second4/5 text-second4"
          : "border-second/30 text-second hover:border-second4"
      }`}
    >
      {children}
    </button>
  );
}

function EntryRow({ row, onChange, onRemove, disabled }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-second/30 p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="flex min-w-0 flex-wrap items-center gap-2 break-words text-sm font-semibold text-second">
          {row.name}
          {row.custom && <Tag tone="muted">Sekali pakai</Tag>}
        </p>
        {row.custom && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label={`Hapus ${row.name}`}
            className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-second2 transition hover:bg-second2/10 disabled:opacity-50 ${FOCUS_RING}`}
          >
            <FiTrash2 size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {(row.section === "PHYSICAL" || row.section === "COMPLETENESS") && (
        <label className="flex cursor-pointer items-center gap-4">
          <input
            type="checkbox"
            checked={row.checked}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                checked: event.target.checked,
                ...(!event.target.checked && { origin: "" }),
              })
            }
            className={`size-4 shrink-0 cursor-pointer accent-second4 ${FOCUS_RING}`}
          />
          <span className="text-sm text-second">
            {row.section === "PHYSICAL" ? "Minor" : "Ada"}
          </span>
        </label>
      )}

      {(row.section === "FUNCTION" || row.section === "ACCESSORY") && (
        <div className="flex gap-2">
          <Pill
            active={row.classification === "NORMAL"}
            disabled={disabled}
            onClick={() => onChange({ classification: "NORMAL" })}
          >
            Normal
          </Pill>
          <Pill
            active={row.classification === "MINOR"}
            disabled={disabled}
            onClick={() => onChange({ classification: "MINOR" })}
          >
            Minor
          </Pill>
        </div>
      )}

      {row.section === "COMPLETENESS" && row.checked && (
        <div className="flex gap-2">
          {["ORIGINAL", "OEM"].map((origin) => (
            <Pill
              key={origin}
              active={row.origin === origin}
              disabled={disabled}
              onClick={() =>
                onChange({ origin: row.origin === origin ? "" : origin })
              }
            >
              {origin === "ORIGINAL" ? "Original" : "OEM"}
            </Pill>
          ))}
        </div>
      )}

      <input
        type="text"
        value={row.note}
        disabled={disabled}
        maxLength={255}
        autoComplete="off"
        onChange={(event) => onChange({ note: event.target.value })}
        placeholder="Catatan (opsional)"
        aria-label={`Catatan ${row.name}`}
        className={inputClass(false)}
      />
    </div>
  );
}

/* Tambah item sekali pakai (tidak masuk item master). */
function AddCustom({ onAdd, disabled, placeholder, label }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function submit() {
    const message = onAdd(name);
    setError(message);
    if (!message) setName("");
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          maxLength={100}
          disabled={disabled}
          autoComplete="off"
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          aria-label={`Tambah item ${label}`}
          aria-invalid={error ? "true" : undefined}
          className={inputClass(Boolean(error))}
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled}
          className={`${BTN_OUTLINE} shrink-0`}
        >
          <FiPlus size={16} aria-hidden="true" />
          Tambah
        </button>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

/* ---------------------------------- Form ---------------------------------- */

/**
 * mode: "create" | "edit"
 * qc: detail QC (edit) atau null
 * items: item master aktif
 * onSubmit(payload)
 */
export default function QcForm({
  mode,
  qc = null,
  items,
  submitting,
  submitLabel,
  cancelHref,
  onSubmit,
}) {
  const isEdit = mode === "edit";

  const [form, setForm] = useState({
    type: qc?.type ?? "BUY",
    product_name: qc?.product_name ?? "",
    serial_number: qc?.serial_number ?? "",
    sender_name: qc?.sender_name ?? "",
    tracking_number: qc?.tracking_number ?? "",
    pic: qc?.pic ?? "",
    price: qc?.price != null ? String(qc.price) : "",
    date: qc?.date ?? todayWib(),
    // Status wajib dipilih saat membuat QC (tidak ada nilai bawaan).
    status: "",
  });
  const [rows, setRows] = useState(() => buildRows(items, qc));
  const [extras, setExtras] = useState(() =>
    (qc?.extras ?? []).map((extra) => ({
      key: nextKey("extra"),
      name: extra.name,
    })),
  );
  const [errors, setErrors] = useState({ fields: {}, extras: {} });

  const defectCount = rows.filter(
    (row) => row.section === "PHYSICAL" && row.checked,
  ).length;
  const minorCount = rows.filter(
    (row) =>
      (row.section === "FUNCTION" || row.section === "ACCESSORY") &&
      row.classification === "MINOR",
  ).length;

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) =>
      current.fields[name]
        ? { ...current, fields: { ...current.fields, [name]: "" } }
        : current,
    );
  }

  function updateRow(key, patch) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function removeRow(key) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  /* Mengembalikan pesan error, atau "" kalau berhasil. */
  function addCustom(section, rawName) {
    const name = rawName.trim();
    if (!name) return "Isi nama item.";
    if (name.length > 100) return "Nama maksimal 100 karakter.";
    if (rows.length >= MAX_ENTRIES)
      return `Maksimal ${MAX_ENTRIES} item checklist.`;
    if (
      rows.some(
        (row) =>
          row.section === section &&
          row.name.trim().toLowerCase() === name.toLowerCase(),
      )
    )
      return "Item ini sudah ada di bagian ini.";

    setRows((current) => [...current, newRow({ section, name, custom: true })]);
    return "";
  }

  function updateExtra(key, name) {
    setExtras((current) =>
      current.map((extra) => (extra.key === key ? { ...extra, name } : extra)),
    );
    setErrors((current) =>
      current.extras[key]
        ? { ...current, extras: { ...current.extras, [key]: "" } }
        : current,
    );
  }

  function validate() {
    const fields = {};
    const extraErrors = {};

    const productName = form.product_name.trim();
    if (!productName) fields.product_name = "Nama produk wajib diisi.";
    else if (productName.length > 150)
      fields.product_name = "Nama produk maksimal 150 karakter.";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date))
      fields.date = "Isi tanggal yang valid.";

    if (!isEdit && !form.status) fields.status = "Pilih status dulu.";

    if (form.pic.trim().length > 100) fields.pic = "PIC maksimal 100 karakter.";

    if (form.price !== "" && Number(form.price) > MAX_PRICE)
      fields.price = "Harga terlalu besar.";

    const seen = new Set();
    for (const extra of extras) {
      const name = extra.name.trim();
      if (!name) extraErrors[extra.key] = "Isi nama tambahan.";
      else if (seen.has(name.toLowerCase()))
        extraErrors[extra.key] = "Barang ini sudah ada di daftar.";
      seen.add(name.toLowerCase());
    }

    return { fields, extras: extraErrors };
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const found = validate();
    setErrors(found);

    if (
      Object.keys(found.fields).length > 0 ||
      Object.keys(found.extras).length > 0
    ) {
      requestAnimationFrame(() => {
        document
          .querySelector(
            "[data-qc-form] [aria-invalid='true'], [data-qc-form] [data-invalid='true']",
          )
          ?.scrollIntoView({ block: "center" });
      });
      return;
    }

    // Edit: kosong dikirim null (mengosongkan). Create: kosong tidak dikirim.
    const optional = (value) => {
      const trimmed = value.trim();
      return isEdit ? trimmed || null : trimmed || undefined;
    };

    const payload = {
      type: form.type,
      product_name: form.product_name.trim(),
      date: form.date,
      ...(!isEdit && { status: form.status }),
      serial_number: optional(form.serial_number),
      sender_name: optional(form.sender_name),
      tracking_number: optional(form.tracking_number),
      pic: optional(form.pic),
      price: form.price !== "" ? Number(form.price) : isEdit ? null : undefined,
      entries: rows.map(toEntry),
      extras: extras.map((extra) => ({ name: extra.name.trim() })),
    };

    // Buang field undefined (create) supaya tidak ikut terkirim.
    for (const key of Object.keys(payload)) {
      if (payload[key] === undefined) delete payload[key];
    }

    onSubmit(payload);
  }

  const statusInfo = STATUS_LABEL[form.status];

  return (
    <form
      data-qc-form
      onSubmit={handleSubmit}
      noValidate
      className="grid grid-cols-1 items-start gap-8 xl:grid-cols-3"
    >
      <div className="flex min-w-0 flex-col gap-8 xl:col-span-2">
        {/* Info produk */}
        <Section
          title="Info produk"
          description="Data unit kamera yang sedang di-QC."
        >
          <div>
            <p className={labelClass}>Jenis transaksi</p>
            <div className="flex gap-2">
              {Object.entries(TYPE_LABEL).map(([value, label]) => (
                <Pill
                  key={value}
                  active={form.type === value}
                  disabled={submitting}
                  onClick={() => setField("type", value)}
                >
                  {label}
                </Pill>
              ))}
            </div>
          </div>

          {!isEdit && (
            <div
              data-invalid={errors.fields.status ? "true" : undefined}
              className="min-w-0"
            >
              <p className={labelClass}>
                Status
                <span className="ml-2 text-second2" aria-hidden="true">
                  *
                </span>
              </p>
              <div className="flex gap-2">
                {Object.entries(STATUS_LABEL).map(([value, info]) => (
                  <Pill
                    key={value}
                    active={form.status === value}
                    disabled={submitting}
                    onClick={() => setField("status", value)}
                  >
                    {info.label}
                  </Pill>
                ))}
              </div>
              {errors.fields.status && (
                <ErrorText>{errors.fields.status}</ErrorText>
              )}
            </div>
          )}

          <Field
            id="qc-product"
            label="Nama produk"
            required
            error={errors.fields.product_name}
          >
            <input
              id="qc-product"
              type="text"
              maxLength={150}
              autoComplete="off"
              value={form.product_name}
              disabled={submitting}
              onChange={(event) => setField("product_name", event.target.value)}
              placeholder="Contoh: Sony A7 III"
              aria-invalid={errors.fields.product_name ? "true" : undefined}
              className={inputClass(Boolean(errors.fields.product_name))}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="qc-serial" label="Serial number">
              <input
                id="qc-serial"
                type="text"
                maxLength={100}
                autoComplete="off"
                value={form.serial_number}
                disabled={submitting}
                onChange={(event) =>
                  setField("serial_number", event.target.value)
                }
                className={inputClass(false)}
              />
            </Field>

            <Field
              id="qc-date"
              label="Tanggal"
              required
              error={errors.fields.date}
            >
              <input
                id="qc-date"
                type="date"
                value={form.date}
                disabled={submitting}
                onChange={(event) => setField("date", event.target.value)}
                aria-invalid={errors.fields.date ? "true" : undefined}
                className={`${inputClass(Boolean(errors.fields.date))} tabular-nums`}
              />
            </Field>

            <Field id="qc-sender" label="Nama pengirim">
              <input
                id="qc-sender"
                type="text"
                maxLength={100}
                autoComplete="off"
                value={form.sender_name}
                disabled={submitting}
                onChange={(event) =>
                  setField("sender_name", event.target.value)
                }
                className={inputClass(false)}
              />
            </Field>

            <Field id="qc-tracking" label="Nomor resi">
              <input
                id="qc-tracking"
                type="text"
                maxLength={100}
                autoComplete="off"
                value={form.tracking_number}
                disabled={submitting}
                onChange={(event) =>
                  setField("tracking_number", event.target.value)
                }
                className={inputClass(false)}
              />
            </Field>
          </div>

          <Field id="qc-pic" label="PIC" error={errors.fields.pic}>
            <input
              id="qc-pic"
              type="text"
              maxLength={100}
              autoComplete="off"
              value={form.pic}
              disabled={submitting}
              onChange={(event) => setField("pic", event.target.value)}
              placeholder="Yang melakukan QC"
              aria-invalid={errors.fields.pic ? "true" : undefined}
              className={inputClass(Boolean(errors.fields.pic))}
            />
          </Field>

          <Field
            id="qc-price"
            label="Harga"
            error={errors.fields.price}
            hint="Isi total yang disepakati (produk beserta tambahannya). Tidak dihitung otomatis."
          >
            <div className="flex">
              <span
                aria-hidden="true"
                className="inline-flex shrink-0 items-center rounded-l-xl border border-r-0 border-second/30 bg-second/5 px-4 text-sm font-medium text-second/60"
              >
                Rp
              </span>
              <input
                id="qc-price"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={formatThousands(form.price)}
                disabled={submitting}
                onChange={(event) =>
                  setField(
                    "price",
                    event.target.value
                      .replace(/\D/g, "")
                      .replace(/^0+(?=\d)/, "")
                      .slice(0, 10),
                  )
                }
                placeholder="0"
                aria-invalid={errors.fields.price ? "true" : undefined}
                className={`${inputClass(Boolean(errors.fields.price))} rounded-l-none tabular-nums`}
              />
            </div>
          </Field>
        </Section>

        {/* Checklist */}
        {SECTIONS.map((section) => {
          const sectionRows = rows.filter(
            (row) => row.section === section.value,
          );
          return (
            <Section
              key={section.value}
              title={section.label}
              description={section.description}
              aside={<Tag tone="soft">{sectionRows.length} item</Tag>}
            >
              {sectionRows.length === 0 && (
                <p className="text-sm text-second/60">
                  Belum ada item. Tambahkan lewat kolom di bawah atau kelola
                  item di halaman Item checklist.
                </p>
              )}

              {sectionRows.map((row) => (
                <EntryRow
                  key={row.key}
                  row={row}
                  disabled={submitting}
                  onChange={(patch) => updateRow(row.key, patch)}
                  onRemove={() => removeRow(row.key)}
                />
              ))}

              <AddCustom
                disabled={submitting}
                label={section.label}
                placeholder={ADD_PLACEHOLDER[section.value]}
                onAdd={(name) => addCustom(section.value, name)}
              />
            </Section>
          );
        })}

        {/* Tambahan */}
        <Section
          title="Tambahan"
          description="Barang tambahan (+) yang ikut dengan unit, contoh: lensa kit, tas. Hanya nama, tanpa harga."
          aside={
            <Tag tone="soft">
              {extras.length}/{MAX_EXTRAS}
            </Tag>
          }
        >
          {extras.map((extra) => (
            <div key={extra.key}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={extra.name}
                  maxLength={150}
                  disabled={submitting}
                  autoComplete="off"
                  onChange={(event) =>
                    updateExtra(extra.key, event.target.value)
                  }
                  placeholder="Nama barang"
                  aria-label="Nama barang tambahan"
                  aria-invalid={errors.extras[extra.key] ? "true" : undefined}
                  className={inputClass(Boolean(errors.extras[extra.key]))}
                />
                <button
                  type="button"
                  onClick={() =>
                    setExtras((current) =>
                      current.filter((item) => item.key !== extra.key),
                    )
                  }
                  disabled={submitting}
                  aria-label="Hapus tambahan"
                  className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full text-second2 transition hover:bg-second2/10 disabled:opacity-50 ${FOCUS_RING}`}
                >
                  <FiTrash2 size={16} aria-hidden="true" />
                </button>
              </div>
              {errors.extras[extra.key] && (
                <ErrorText>{errors.extras[extra.key]}</ErrorText>
              )}
            </div>
          ))}

          <div>
            <button
              type="button"
              onClick={() =>
                setExtras((current) => [
                  ...current,
                  { key: nextKey("extra"), name: "" },
                ])
              }
              disabled={submitting || extras.length >= MAX_EXTRAS}
              className={BTN_OUTLINE}
            >
              <FiPlus size={16} aria-hidden="true" />
              Tambah barang
            </button>
          </div>
        </Section>
      </div>

      {/* Ringkasan */}
      <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-16">
        <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
          <h2 className="text-lg font-bold text-second">Ringkasan</h2>

          <div className="min-w-0">
            <p className="line-clamp-2 break-words text-sm font-semibold text-second">
              {form.product_name.trim() || "Produk belum diisi"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Tag tone="strong">{TYPE_LABEL[form.type]}</Tag>
              {!isEdit && statusInfo && (
                <Tag tone={statusInfo.tone}>{statusInfo.label}</Tag>
              )}
            </div>
          </div>

          <dl className="divide-y divide-second/10 border-y border-second/30">
            {[
              ["Kerusakan fisik", defectCount],
              ["Fungsi/Aksesories minor", minorCount],
              ["Barang tambahan", extras.length],
              [
                "Harga",
                form.price !== "" ? formatRupiah(form.price) : "Belum diisi",
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-start justify-between gap-4 py-2 text-sm"
              >
                <dt className="text-second/60">{label}</dt>
                <dd className="font-semibold tabular-nums text-second">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          {!isEdit && (
            <p className="text-xs leading-relaxed text-second/60">
              Foto dan video ditambahkan di halaman detail setelah QC disimpan.
            </p>
          )}
        </section>

        <div className="flex flex-col gap-2">
          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className={`${BTN_PRIMARY} w-full`}
          >
            {submitting ? (
              <>
                <FiLoader
                  className="animate-spin motion-reduce:animate-none"
                  size={16}
                  aria-hidden="true"
                />
                Menyimpan…
              </>
            ) : (
              <>
                <FiSave size={16} aria-hidden="true" />
                {submitLabel}
              </>
            )}
          </button>

          <Link
            href={cancelHref}
            aria-disabled={submitting}
            tabIndex={submitting ? -1 : undefined}
            className={`${BTN_OUTLINE} w-full hover:border-second2 hover:text-second2 ${
              submitting ? "pointer-events-none opacity-50" : ""
            }`}
          >
            Batal
          </Link>
        </div>
      </aside>
    </form>
  );
}
