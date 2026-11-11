"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link.js";
import { FiLoader, FiPlus, FiSave, FiTrash2, FiUser } from "react-icons/fi";

import {
  BTN_OUTLINE,
  BTN_PRIMARY,
  ErrorText,
  FOCUS_RING,
  MAX_AMOUNT,
  MAX_ITEMS,
  Section,
  SummaryRow,
  Tag,
  STATUS,
  formatCurrency,
  formatDate,
  formatThousands,
  inputClass,
  labelClass,
  todayWib,
} from "./payroll-shared.jsx";

/* ------------------------------ Small pieces ------------------------------ */

function Field({ label, htmlFor, required, error, description, children }) {
  const descId = `${htmlFor}-desc`;
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className={labelClass}>
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
        <ErrorText id={descId}>{error}</ErrorText>
      ) : (
        description && (
          <p id={descId} className="mt-2 text-sm text-second/60">
            {description}
          </p>
        )
      )}
    </div>
  );
}

/* Input rupiah: hanya angka, titik ribuan otomatis, kursor tidak loncat. */
function MoneyInput({ id, value, onChange, hasError, disabled, describedBy }) {
  const ref = useRef(null);
  const caret = useRef(null);

  function handleChange(event) {
    const raw = event.target.value;
    const position = event.target.selectionStart ?? raw.length;
    const digitsBefore = raw.slice(0, position).replace(/\D/g, "").length;
    const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    if (digits.length > 10) return;
    caret.current = Math.min(digitsBefore, digits.length);
    onChange(digits);
  }

  useLayoutEffect(() => {
    if (caret.current == null || !ref.current) return;
    const formatted = formatThousands(value);
    let position = 0;
    let found = 0;
    while (position < formatted.length && found < caret.current) {
      if (/\d/.test(formatted[position])) found += 1;
      position += 1;
    }
    ref.current.setSelectionRange(position, position);
    caret.current = null;
  }, [value]);

  return (
    <div className="flex">
      <span
        aria-hidden="true"
        className="inline-flex shrink-0 items-center rounded-l-xl border border-r-0 border-second/30 bg-second/5 px-4 text-sm font-medium text-second/60"
      >
        Rp
      </span>
      <input
        ref={ref}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="0"
        value={formatThousands(value)}
        onChange={handleChange}
        disabled={disabled}
        aria-invalid={hasError ? true : undefined}
        aria-describedby={describedBy}
        className={`${inputClass(hasError)} rounded-l-none tabular-nums`}
      />
    </div>
  );
}

let keyCounter = 0;
export function newItem(values = {}) {
  keyCounter += 1;
  return {
    key: `item-${keyCounter}`,
    name: "",
    note: "",
    checked: false,
    amount: "",
    // Kalkulator: harga per 1 kali x berapa kali (tidak dikirim ke server,
    // hanya hasilnya yang masuk ke jumlah dan keterangan).
    calc: false,
    unit: "",
    qty: "",
    noteEdited: false,
    ...values,
  };
}

function buildCalcNote(item) {
  const name = item.name.trim();
  return `${name ? `${name}: ` : ""}Rp ${formatThousands(item.unit)} × ${Number(item.qty)} kali`;
}

/* Kalau kalkulator aktif, jumlah (dan keterangan) dihitung dari isiannya. */
function applyCalc(item) {
  if (!item.calc) return item;
  const ready = item.unit !== "" && item.qty !== "";
  const next = {
    ...item,
    amount: ready ? String(Number(item.unit) * Number(item.qty)) : "",
  };
  if (!item.noteEdited) next.note = ready ? buildCalcNote(item) : "";
  return next;
}

/* Bentuk item untuk dikirim / dibandingkan */
function toPayloadItems(items) {
  return items.map((item) => {
    const note = item.note.trim();
    return {
      name: item.name.trim(),
      ...(note && { note }),
      checked: Boolean(item.checked),
      amount: Number(item.amount),
    };
  });
}

function originalItems(slip) {
  return (slip?.items ?? []).map((item) => ({
    name: item.name,
    ...(item.note && { note: item.note }),
    checked: Boolean(item.checked),
    amount: Number(item.amount),
  }));
}

const ACCOUNT_PATTERN = /^[\d\s-]+$/;

/* ---------------------------------- Form ---------------------------------- */

/**
 * mode: "create" | "edit"
 * slip: data slip (edit) atau null
 * employeeId / employeeName / employeeField: dikelola halaman (pemilih karyawan di create)
 * onSubmit(payload): payload siap kirim. Di edit hanya berisi field yang berubah.
 */
export default function PayrollForm({
  mode,
  slip = null,
  employeeId = "",
  employeeName = "",
  employeeField = null,
  employeeError = "",
  presetJob = "",
  submitting,
  submitLabel,
  cancelHref,
  onSubmit,
}) {
  const isEdit = mode === "edit";

  const [form, setForm] = useState({
    job_title: slip?.job_title ?? presetJob,
    bank_name: slip?.bank_name ?? "",
    account_number: slip?.account_number ?? "",
    account_holder: slip?.account_holder ?? "",
    disbursement_date: slip?.disbursement_date?.slice(0, 10) ?? todayWib(),
    status: "PENDING",
  });
  const [items, setItems] = useState(() =>
    slip?.items?.length
      ? slip.items.map((item) =>
          newItem({
            name: item.name,
            note: item.note ?? "",
            checked: Boolean(item.checked),
            amount: String(item.amount ?? ""),
          }),
        )
      : [newItem({ name: "Gaji pokok" })],
  );
  const [errors, setErrors] = useState({});
  const [itemErrors, setItemErrors] = useState({});

  const total = items.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0,
  );
  const totalTooLarge = total > MAX_AMOUNT;

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) =>
      current[name] ? { ...current, [name]: "" } : current,
    );
  }

  function setItem(key, patch) {
    setItems((current) =>
      current.map((item) =>
        item.key === key ? applyCalc({ ...item, ...patch }) : item,
      ),
    );
    setItemErrors((current) =>
      current[key] ? { ...current, [key]: {} } : current,
    );
  }

  function addItem() {
    if (items.length >= MAX_ITEMS) return;
    setItems((current) => [...current, newItem()]);
  }

  function removeItem(key) {
    setItems((current) =>
      current.length > 1 ? current.filter((item) => item.key !== key) : current,
    );
  }

  function toggleCalc(item, on) {
    if (on) {
      setItem(item.key, {
        calc: true,
        unit: item.amount,
        qty: "1",
        noteEdited: item.note.trim() !== "",
      });
    } else {
      setItem(item.key, { calc: false });
    }
  }

  /* Payload edit = hanya yang berubah */
  function buildPayload() {
    if (!isEdit) {
      const note = (value) => value.trim();
      return {
        employee_id: employeeId,
        job_title: note(form.job_title),
        bank_name: note(form.bank_name),
        account_number: note(form.account_number),
        account_holder: note(form.account_holder),
        disbursement_date: form.disbursement_date,
        status: form.status,
        items: toPayloadItems(items),
      };
    }

    const data = {};
    for (const field of [
      "job_title",
      "bank_name",
      "account_number",
      "account_holder",
    ]) {
      const value = form[field].trim();
      if (value !== (slip[field] ?? "")) data[field] = value;
    }
    if (form.disbursement_date !== slip.disbursement_date?.slice(0, 10)) {
      data.disbursement_date = form.disbursement_date;
    }
    const nextItems = toPayloadItems(items);
    if (JSON.stringify(nextItems) !== JSON.stringify(originalItems(slip))) {
      data.items = nextItems;
    }
    return data;
  }

  const dirty = !isEdit || Object.keys(buildPayload()).length > 0;

  function validate() {
    const found = {};
    const foundItems = {};

    if (!isEdit && !employeeId) found.employee = "Pilih karyawan dulu.";

    for (const [field, label] of [
      ["job_title", "Jabatan"],
      ["bank_name", "Nama bank"],
      ["account_holder", "Atas nama"],
    ]) {
      const value = form[field].trim();
      if (!value) found[field] = `${label} wajib diisi.`;
      else if (value.length > 100)
        found[field] = `${label} maksimal 100 huruf.`;
    }

    const account = form.account_number.trim();
    if (!ACCOUNT_PATTERN.test(account)) {
      found.account_number =
        "Nomor rekening hanya boleh angka, spasi, atau tanda strip.";
    } else if (account.length < 4 || account.length > 30) {
      found.account_number = "Nomor rekening harus 4–30 karakter.";
    }

    const date = form.disbursement_date;
    const year = Number(date.slice(0, 4));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || year < 2000 || year > 2100) {
      found.disbursement_date = "Isi tanggal cair yang valid.";
    } else if (!isEdit && form.status === "PAID" && date > todayWib()) {
      found.disbursement_date =
        "Slip yang sudah cair tidak boleh bertanggal di masa depan.";
    }

    items.forEach((item) => {
      const itemError = {};
      const name = item.name.trim();
      if (!name) itemError.name = "Nama penerimaan wajib diisi.";
      else if (name.length > 100) itemError.name = "Maksimal 100 huruf.";
      if (item.calc) {
        if (item.unit === "") itemError.unit = "Isi jumlah per 1 kali.";
        if (item.qty === "" || Number(item.qty) < 1)
          itemError.qty = "Isi berapa kali (minimal 1).";
        if (
          !itemError.unit &&
          !itemError.qty &&
          Number(item.amount) > MAX_AMOUNT
        )
          itemError.amount = "Jumlah terlalu besar.";
      } else if (item.amount === "") itemError.amount = "Jumlah wajib diisi.";
      else if (Number(item.amount) > MAX_AMOUNT)
        itemError.amount = "Jumlah terlalu besar.";
      if (item.note.trim().length > 500) itemError.note = "Maksimal 500 huruf.";
      if (Object.keys(itemError).length > 0) foundItems[item.key] = itemError;
    });

    if (totalTooLarge) found.items = "Total semua penerimaan terlalu besar.";

    return { found, foundItems };
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const { found, foundItems } = validate();
    setErrors(found);
    setItemErrors(foundItems);

    if (Object.keys(found).length > 0 || Object.keys(foundItems).length > 0) {
      requestAnimationFrame(() => {
        document
          .querySelector("[aria-invalid='true']")
          ?.scrollIntoView({ block: "center" });
      });
      return;
    }

    onSubmit(buildPayload());
  }

  const status = STATUS[isEdit ? slip.status : form.status];
  const shownEmployee = isEdit ? slip.employee_name : employeeName;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="grid grid-cols-1 items-start gap-8 xl:grid-cols-3"
    >
      <div className="flex min-w-0 flex-col gap-8 xl:col-span-2">
        {/* Karyawan */}
        <Section
          title="Karyawan"
          description={
            isEdit
              ? "Karyawan pada slip tidak bisa diganti."
              : "Pilih karyawan yang akan dibuatkan slip gaji."
          }
        >
          {isEdit ? (
            <div className="flex items-center gap-4 rounded-xl border border-second/30 bg-second/5 p-4">
              <FiUser
                size={16}
                className="shrink-0 text-second/60"
                aria-hidden="true"
              />
              <p className="min-w-0 break-words text-sm font-semibold text-second">
                {slip.employee_name}
              </p>
            </div>
          ) : (
            <>
              {employeeField}
              {(errors.employee || employeeError) && (
                <ErrorText id="employee-desc">
                  {errors.employee || employeeError}
                </ErrorText>
              )}
            </>
          )}
        </Section>

        {/* Jabatan & rekening */}
        <Section
          title="Jabatan dan rekening"
          description="Data ini disimpan di slip, jadi slip lama tidak berubah kalau data karyawan diubah nanti."
        >
          <Field
            label="Jabatan"
            htmlFor="job_title"
            required
            error={errors.job_title}
          >
            <input
              id="job_title"
              value={form.job_title}
              onChange={(event) => setField("job_title", event.target.value)}
              maxLength={100}
              autoComplete="off"
              placeholder="Contoh: Kasir"
              disabled={submitting}
              aria-invalid={errors.job_title ? true : undefined}
              aria-describedby={errors.job_title ? "job_title-desc" : undefined}
              className={inputClass(errors.job_title)}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Nama bank"
              htmlFor="bank_name"
              required
              error={errors.bank_name}
            >
              <input
                id="bank_name"
                value={form.bank_name}
                onChange={(event) => setField("bank_name", event.target.value)}
                maxLength={100}
                autoComplete="off"
                placeholder="Contoh: BCA"
                disabled={submitting}
                aria-invalid={errors.bank_name ? true : undefined}
                aria-describedby={
                  errors.bank_name ? "bank_name-desc" : undefined
                }
                className={inputClass(errors.bank_name)}
              />
            </Field>

            <Field
              label="Nomor rekening"
              htmlFor="account_number"
              required
              error={errors.account_number}
            >
              <input
                id="account_number"
                inputMode="numeric"
                value={form.account_number}
                onChange={(event) =>
                  setField("account_number", event.target.value)
                }
                maxLength={30}
                autoComplete="off"
                placeholder="1234567890"
                disabled={submitting}
                aria-invalid={errors.account_number ? true : undefined}
                aria-describedby={
                  errors.account_number ? "account_number-desc" : undefined
                }
                className={`${inputClass(errors.account_number)} tabular-nums`}
              />
            </Field>
          </div>

          <Field
            label="Atas nama"
            htmlFor="account_holder"
            required
            error={errors.account_holder}
          >
            <input
              id="account_holder"
              value={form.account_holder}
              onChange={(event) =>
                setField("account_holder", event.target.value)
              }
              maxLength={100}
              autoComplete="off"
              placeholder="Nama pemilik rekening"
              disabled={submitting}
              aria-invalid={errors.account_holder ? true : undefined}
              aria-describedby={
                errors.account_holder ? "account_holder-desc" : undefined
              }
              className={inputClass(errors.account_holder)}
            />
          </Field>
        </Section>

        {/* Penerimaan */}
        <Section
          title="Penerimaan"
          description="Isi gaji pokok, insentif, dan penerimaan lain. Total dihitung otomatis."
          aside={
            <Tag tone="soft">
              {items.length}/{MAX_ITEMS} penerimaan
            </Tag>
          }
        >
          {items.map((item, index) => {
            const itemError = itemErrors[item.key] ?? {};
            return (
              <div
                key={item.key}
                className="flex flex-col gap-4 rounded-xl border border-second/30 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-second">
                    Penerimaan {index + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeItem(item.key)}
                    disabled={submitting || items.length <= 1}
                    aria-label={`Hapus penerimaan ${index + 1}`}
                    className={`inline-flex size-8 items-center justify-center rounded-full bg-primary text-second2 shadow transition-colors hover:bg-second2 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation ${FOCUS_RING}`}
                  >
                    <FiTrash2 size={16} aria-hidden="true" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Nama"
                    htmlFor={`${item.key}-name`}
                    required
                    error={itemError.name}
                  >
                    <input
                      id={`${item.key}-name`}
                      value={item.name}
                      onChange={(event) =>
                        setItem(item.key, { name: event.target.value })
                      }
                      maxLength={100}
                      autoComplete="off"
                      placeholder="Contoh: Gaji pokok"
                      disabled={submitting}
                      aria-invalid={itemError.name ? true : undefined}
                      aria-describedby={
                        itemError.name ? `${item.key}-name-desc` : undefined
                      }
                      className={inputClass(itemError.name)}
                    />
                  </Field>

                  {item.calc ? (
                    <Field
                      label="Total"
                      htmlFor={`${item.key}-total`}
                      required
                      error={itemError.amount}
                    >
                      <output
                        id={`${item.key}-total`}
                        className="block w-full min-w-0 rounded-xl border border-second/30 bg-second/5 px-4 py-2 text-base font-semibold tabular-nums text-second"
                      >
                        {item.amount === "" ? "—" : formatCurrency(item.amount)}
                      </output>
                    </Field>
                  ) : (
                    <Field
                      label="Jumlah"
                      htmlFor={`${item.key}-amount`}
                      required
                      error={itemError.amount}
                    >
                      <MoneyInput
                        id={`${item.key}-amount`}
                        value={item.amount}
                        onChange={(digits) =>
                          setItem(item.key, { amount: digits })
                        }
                        hasError={Boolean(itemError.amount)}
                        disabled={submitting}
                        describedBy={
                          itemError.amount
                            ? `${item.key}-amount-desc`
                            : undefined
                        }
                      />
                    </Field>
                  )}
                </div>

                <label className="flex cursor-pointer items-center gap-4">
                  <input
                    type="checkbox"
                    checked={item.calc}
                    onChange={(event) => toggleCalc(item, event.target.checked)}
                    disabled={submitting}
                    className={`size-4 shrink-0 cursor-pointer accent-second4 ${FOCUS_RING}`}
                  />
                  <span className="text-sm text-second">
                    Pakai kalkulator (jumlah per 1 kali × berapa kali)
                  </span>
                </label>

                {item.calc && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field
                      label="Jumlah per 1 kali"
                      htmlFor={`${item.key}-unit`}
                      required
                      error={itemError.unit}
                    >
                      <MoneyInput
                        id={`${item.key}-unit`}
                        value={item.unit}
                        onChange={(digits) =>
                          setItem(item.key, { unit: digits })
                        }
                        hasError={Boolean(itemError.unit)}
                        disabled={submitting}
                        describedBy={
                          itemError.unit ? `${item.key}-unit-desc` : undefined
                        }
                      />
                    </Field>

                    <Field
                      label="Berapa kali"
                      htmlFor={`${item.key}-qty`}
                      required
                      error={itemError.qty}
                    >
                      <input
                        id={`${item.key}-qty`}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Contoh: 3"
                        value={item.qty}
                        onChange={(event) =>
                          setItem(item.key, {
                            qty: event.target.value
                              .replace(/\D/g, "")
                              .replace(/^0+(?=\d)/, "")
                              .slice(0, 4),
                          })
                        }
                        maxLength={4}
                        disabled={submitting}
                        aria-invalid={itemError.qty ? true : undefined}
                        aria-describedby={
                          itemError.qty ? `${item.key}-qty-desc` : undefined
                        }
                        className={`${inputClass(itemError.qty)} tabular-nums`}
                      />
                    </Field>
                  </div>
                )}

                <Field
                  label="Keterangan"
                  htmlFor={`${item.key}-note`}
                  error={itemError.note}
                  description={
                    item.calc
                      ? "Terisi otomatis dari kalkulator, boleh diubah."
                      : undefined
                  }
                >
                  <textarea
                    id={`${item.key}-note`}
                    value={item.note}
                    onChange={(event) =>
                      setItem(item.key, {
                        note: event.target.value,
                        noteEdited: event.target.value.trim() !== "",
                      })
                    }
                    rows={2}
                    maxLength={500}
                    placeholder="Contoh: Bulan November"
                    disabled={submitting}
                    aria-invalid={itemError.note ? true : undefined}
                    aria-describedby={
                      itemError.note ? `${item.key}-note-desc` : undefined
                    }
                    className={`${inputClass(itemError.note)} resize-y`}
                  />
                </Field>

                <label className="flex cursor-pointer items-center gap-4">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(event) =>
                      setItem(item.key, { checked: event.target.checked })
                    }
                    disabled={submitting}
                    className={`size-4 shrink-0 cursor-pointer accent-second4 ${FOCUS_RING}`}
                  />
                  <span className="text-sm text-second">
                    Sudah dicentang (hanya penanda, tidak mengubah total)
                  </span>
                </label>
              </div>
            );
          })}

          <div>
            <button
              type="button"
              onClick={addItem}
              disabled={submitting || items.length >= MAX_ITEMS}
              className={`${BTN_OUTLINE} w-full sm:w-auto`}
            >
              <FiPlus size={16} aria-hidden="true" />
              Tambah penerimaan
            </button>
          </div>

          {errors.items && (
            <ErrorText id="items-desc">{errors.items}</ErrorText>
          )}
        </Section>

        {/* Tanggal & status */}
        <Section
          title="Tanggal cair"
          description={
            isEdit
              ? "Status cair diubah dari halaman detail slip."
              : "Slip yang belum cair boleh bertanggal ke depan."
          }
        >
          <Field
            label="Tanggal cair"
            htmlFor="disbursement_date"
            required
            error={errors.disbursement_date}
          >
            <input
              id="disbursement_date"
              type="date"
              value={form.disbursement_date}
              onChange={(event) =>
                setField("disbursement_date", event.target.value)
              }
              min="2000-01-01"
              max="2100-12-31"
              disabled={submitting}
              aria-invalid={errors.disbursement_date ? true : undefined}
              aria-describedby={
                errors.disbursement_date ? "disbursement_date-desc" : undefined
              }
              className={`${inputClass(errors.disbursement_date)} tabular-nums`}
            />
          </Field>

          {!isEdit && (
            <fieldset className="flex flex-col gap-2">
              <legend className={labelClass}>Status</legend>
              {Object.entries(STATUS).map(([value, option]) => {
                const checked = form.status === value;
                return (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors ${
                      checked
                        ? "border-second4 bg-second4/5"
                        : "border-second/30"
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={value}
                      checked={checked}
                      onChange={() => setField("status", value)}
                      disabled={submitting}
                      className={`size-4 shrink-0 cursor-pointer accent-second4 ${FOCUS_RING}`}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-second">
                        {option.label}
                      </span>
                      <span className="mt-2 block text-sm text-second/60">
                        {value === "PAID"
                          ? "Gaji sudah dibayarkan. Langsung dihitung sebagai pengeluaran gaji di laporan."
                          : "Gaji belum dibayarkan. Belum mengurangi laporan."}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          )}
        </Section>
      </div>

      {/* Ringkasan */}
      <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-16 xl:-mt-4 xl:pt-4">
        <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
          <h2 className="text-lg font-bold text-second">Ringkasan</h2>

          <div className="min-w-0">
            <p className="line-clamp-2 break-words text-sm font-semibold text-second">
              {shownEmployee || "Karyawan belum dipilih"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Tag tone={status.tone}>{status.label}</Tag>
              <Tag>{items.length} penerimaan</Tag>
            </div>
          </div>

          <dl className="divide-y divide-second/10 border-y border-second/30">
            <SummaryRow label="Tanggal cair">
              {formatDate(form.disbursement_date)}
            </SummaryRow>
            <SummaryRow label="Total gaji">
              <span className="flex flex-col items-end gap-2">
                <span>{formatCurrency(total)}</span>
                {totalTooLarge && <Tag tone="failure">Terlalu besar</Tag>}
              </span>
            </SummaryRow>
          </dl>
        </section>

        <div className="flex flex-col gap-2">
          <button
            type="submit"
            disabled={submitting || !dirty}
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
