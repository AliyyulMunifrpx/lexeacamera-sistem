"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BsWhatsapp, BsInstagram, BsTiktok } from "react-icons/bs";
import { SiShopee } from "react-icons/si";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCheck,
  FiCheckCircle,
  FiCopy,
  FiLoader,
  FiMapPin,
  FiMinus,
  FiPlus,
  FiSearch,
  FiTrash2,
} from "react-icons/fi";

import { useGetStore } from "../../features/store/hooks.js";
import { createOrder, getCameras } from "../../features/public/api.js";
import { normalizeApiError } from "../../../lib/api/errors.js";

/* -------------------------------------------------------------------------- */
/*  Aturan dari dokumentasi POST /orders                                      */
/* -------------------------------------------------------------------------- */

const MAX_ITEMS = 10;
const MAX_QTY = 10;
const WA_PATTERN = /^\+?\d{8,15}$/;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const labelClass = "mb-2 block text-sm font-semibold text-second";

function inputClass(hasError) {
  return [
    "w-full min-w-0 rounded-xl border bg-primary px-4 py-2 text-base text-second",
    "placeholder:text-second/35 transition-colors duration-150",
    "outline-none focus:ring-4",
    "disabled:cursor-not-allowed disabled:bg-second/5 disabled:text-second/50",
    hasError
      ? "border-second2 focus:border-second2 focus:ring-second2/15"
      : "border-second/30 hover:border-second/30 focus:border-second4 focus:ring-second4/15",
  ].join(" ");
}

/* -------------------------------- Formatters ------------------------------ */

function formatRupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

/* 0812…, +62812…, 62812… -> 62812… */
function normalizeWhatsapp(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

/* 6282325551234 -> "+62 8232-5551-234" */
function formatWhatsapp(digits) {
  if (!digits) return "";
  if (!digits.startsWith("62")) return `+${digits}`;
  const national = digits.slice(2);
  const groups = [
    national.slice(0, 4),
    national.slice(4, 8),
    national.slice(8),
  ].filter(Boolean);
  return `+62 ${groups.join("-")}`;
}

/* ------------------------------ Small pieces ------------------------------ */

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
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-2 flex items-start gap-2 text-sm text-second2"
        >
          <FiAlertCircle
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          {error}
        </p>
      ) : (
        hint && <p className="mt-2 text-xs text-second/60">{hint}</p>
      )}
    </div>
  );
}

/* ----------------------------- Pencarian kamera ---------------------------- */

function CameraPicker({ selectedIds, onAdd, disabled, limitReached, invalid }) {
  const rootRef = useRef(null);
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(term.trim()), 300);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointer(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleKey(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const query = useQuery({
    queryKey: ["public-order-camera-search", search],
    queryFn: () => getCameras({ search, page: 1 }),
    enabled: open,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const list = Array.isArray(query.data)
    ? query.data
    : (query.data?.data ?? []);
  const options = list.slice(0, 8);

  function pick(camera) {
    onAdd(camera);
    setTerm("");
    setSearch("");
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <FiSearch
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-second/40"
        />
        <input
          id="order-camera-search"
          type="search"
          autoComplete="off"
          maxLength={100}
          value={term}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setTerm(event.target.value);
            setOpen(true);
          }}
          placeholder={
            limitReached
              ? `Maksimal ${MAX_ITEMS} produk`
              : "Cari nama atau SKU kamera…"
          }
          aria-expanded={open}
          aria-invalid={invalid ? "true" : undefined}
          aria-describedby={invalid ? "order-camera-search-error" : undefined}
          className={`${inputClass(invalid)} pl-8`}
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-xl border border-second/30 bg-primary shadow-xl">
          {query.isPending ? (
            <p
              role="status"
              className="flex items-center gap-2 p-4 text-sm text-second/60"
            >
              <FiLoader
                className="animate-spin motion-reduce:animate-none"
                size={16}
                aria-hidden="true"
              />
              Mencari…
            </p>
          ) : query.isError ? (
            <p role="alert" className="p-4 text-sm text-second2">
              Gagal memuat produk. Coba lagi.
            </p>
          ) : options.length === 0 ? (
            <p className="p-4 text-sm text-second/60">
              Produk tidak ditemukan.
            </p>
          ) : (
            <ul>
              {options.map((camera) => {
                const soldOut = Number(camera.stock) <= 0;
                const chosen = selectedIds.has(camera.id);
                return (
                  <li
                    key={camera.id}
                    className="border-b border-second/20 last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => pick(camera)}
                      disabled={soldOut || limitReached}
                      className={`flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-second/5 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                    >
                      {camera.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={camera.image_url}
                          alt=""
                          className="size-8 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <span className="size-8 shrink-0 rounded-xl bg-second/10" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-second">
                          {camera.name}
                        </span>
                        <span className="mt-2 block text-xs text-second/60">
                          {formatRupiah(camera.price)}
                          {" · "}
                          {soldOut ? "Stok habis" : `Stok ${camera.stock}`}
                        </span>
                      </span>
                      {chosen && (
                        <span className="shrink-0 rounded-full border border-second4 px-2 text-xs font-semibold text-second4">
                          Dipilih
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Form pemesanan ----------------------------- */

const EMPTY_FORM = {
  customer_name: "",
  address: "",
  whatsapp: "",
  instagram: "",
};

function describeOrderError(error) {
  const code = error?.response?.data?.errors;
  const status = error?.response?.status;

  if (code === "INSUFFICIENT_STOCK")
    return "Stok tidak cukup untuk salah satu produk. Kurangi jumlahnya atau pilih produk lain.";
  if (code === "AMOUNT_TOO_LARGE")
    return "Total pesanan terlalu besar. Kurangi jumlah atau produknya.";
  if (code === "CAMERA_NOT_FOUND")
    return "Salah satu produk sudah tidak tersedia. Hapus dari daftar lalu coba lagi.";
  if (code === "STORE_NOT_READY")
    return "Toko belum siap menerima pesanan. Coba lagi nanti.";
  if (status === 429)
    return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
  if (status >= 500)
    return "Terjadi gangguan di server. Coba kirim ulang sebentar lagi.";

  return normalizeApiError(error).message;
}

/* Ringkasan pesanan dikirim ke toko lewat Web3Forms.
   Pesanan sudah tersimpan di server, jadi kegagalan di sini tidak
   membatalkan apa pun. Hasil: true (terkirim), false (gagal), null (dilewati). */
const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";
const WEB3FORMS_ACCESS_KEY = process.env.NEXT_PUBLIC_FORM_ACCESS_KEY;

function formatPrice(value) {
  return new Intl.NumberFormat("id-ID").format(Number(value) || 0);
}

async function sendOrderEmail({ order, payload, fallbackItems }) {
  if (!WEB3FORMS_ACCESS_KEY) {
    console.warn(
      "Web3Forms: access key belum diatur (NEXT_PUBLIC_FORM_ACCESS_KEY).",
    );
    return null;
  }

  const orderItems =
    order?.items?.length > 0
      ? order.items.map((item) => ({
          name: item.camera_name,
          quantity: item.quantity,
          price: item.camera_price,
          total: item.line_total,
        }))
      : fallbackItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
        }));

  const itemLines = orderItems
    .map(
      (item, index) =>
        `${index + 1}. ${item.name} - ${item.quantity} x Rp${formatPrice(
          item.price,
        )} = Rp${formatPrice(item.total)}`,
    )
    .join("\n");

  const total =
    order?.total_amount ??
    orderItems.reduce((sum, item) => sum + Number(item.total), 0);

  const invoiceNumber = order?.no_invoice ?? "-";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(WEB3FORMS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: `Pesanan baru ${invoiceNumber} dari ${payload.customer_name}`,
        from_name: "Form Pemesanan Toko",
        invoice: invoiceNumber,
        nama: payload.customer_name,
        whatsapp: payload.whatsapp,
        instagram: payload.instagram || "-",
        alamat: payload.address,
        produk: itemLines,
        total: `Rp${formatPrice(total)}`,
      }),
      signal: controller.signal,
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || result?.success === false) {
      console.warn("Web3Forms: gagal mengirim email.", result?.message);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("Web3Forms: gagal mengirim email.", error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function OrderSuccess({ order, notifyFailed, onReset }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  async function copyInvoice() {
    const text = String(order.no_invoice);

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Cadangan untuk browser tanpa izin clipboard.
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } finally {
        document.body.removeChild(area);
      }
      if (!ok) return;
    }

    setCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  }

  const whatsapp = formatWhatsapp(normalizeWhatsapp(order.contact_whatsapp));

  return (
    <section
      aria-live="polite"
      className="flex min-w-0 flex-1 flex-col gap-4 rounded-xl border border-second/30 bg-primary p-4"
    >
      <div className="flex items-center gap-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary">
          <FiCheckCircle size={16} aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-grad">Pesanan terkirim</h2>
      </div>

      <p className="text-sm leading-relaxed text-second/60">
        Terima kasih, {order.customer_name}. Pesanan Anda sudah kami terima.
        Kami akan menghubungi Anda melalui nomor WhatsApp yang Anda masukkan
        {whatsapp && (
          <>
            {" "}
            (
            <span className="font-semibold tabular-nums text-second">
              {whatsapp}
            </span>
            )
          </>
        )}{" "}
        untuk konfirmasi pesanan.
      </p>

      <div className="rounded-xl border border-second/30 p-4">
        <p className="text-xs text-second/60">
          Nomor invoice (simpan untuk konfirmasi)
        </p>
        <div className="mt-2 flex items-center justify-between gap-4">
          <p className="min-w-0 select-all break-all text-lg font-bold tabular-nums text-second">
            {order.no_invoice}
          </p>
          <button
            type="button"
            onClick={copyInvoice}
            aria-label="Salin nomor invoice"
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border border-second/30 px-4 py-2 text-sm font-semibold text-second transition hover:border-second4 hover:text-second4 cursor-pointer touch-manipulation ${FOCUS_RING}`}
          >
            {copied ? (
              <>
                <FiCheck size={16} aria-hidden="true" />
                Tersalin
              </>
            ) : (
              <>
                <FiCopy size={16} aria-hidden="true" />
                Salin
              </>
            )}
          </button>
        </div>
        <p className="mt-2 text-xs text-second/60">
          Status pesanan: belum lunas.
        </p>
      </div>

      {notifyFailed && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2"
        >
          <FiAlertTriangle
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          Pesanan Anda sudah tersimpan, tetapi pemberitahuan ke toko belum
          terkirim. Hubungi toko dan sebutkan nomor invoice di atas.
        </p>
      )}

      <ul className="flex flex-col divide-y divide-second/10">
        {(order.items ?? []).map((item, index) => (
          <li
            key={`${item.camera_name}-${index}`}
            className="flex items-start justify-between gap-4 py-2 text-sm"
          >
            <span className="min-w-0">
              <span className="block break-words font-semibold text-second">
                {item.camera_name}
              </span>
              <span className="mt-2 block text-xs tabular-nums text-second/60">
                {formatRupiah(item.camera_price)} × {item.quantity}
              </span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-second">
              {formatRupiah(item.line_total)}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-4 border-t border-second/30 pt-4">
        <span className="text-sm font-semibold text-second">Total</span>
        <span className="text-lg font-bold tabular-nums text-grad">
          {formatRupiah(order.total_amount)}
        </span>
      </div>

      <button
        type="button"
        onClick={onReset}
        className={`w-full rounded-full bg-grad border border-second/30 px-4 py-2 text-sm font-semibold text-primary transition cursor-pointer ${FOCUS_RING}`}
      >
        Buat pesanan baru
      </button>
    </section>
  );
}

function OrderForm() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [items, setItems] = useState([]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState(null);
  const [notifyFailed, setNotifyFailed] = useState(false);

  const selectedIds = useMemo(
    () => new Set(items.map((item) => item.camera_id)),
    [items],
  );
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) =>
      current[name] ? { ...current, [name]: "" } : current,
    );
  }

  function addCamera(camera) {
    const stock = Number(camera.stock);
    const cap = Number.isFinite(stock) ? Math.min(MAX_QTY, stock) : MAX_QTY;

    setItems((current) => {
      if (current.some((item) => item.camera_id === camera.id)) {
        return current.map((item) =>
          item.camera_id === camera.id
            ? { ...item, quantity: Math.min(item.quantity + 1, item.cap) }
            : item,
        );
      }
      if (current.length >= MAX_ITEMS || cap < 1) return current;

      return [
        ...current,
        {
          camera_id: camera.id,
          name: camera.name,
          price: Number(camera.price) || 0,
          image_url: camera.image_url ?? null,
          cap,
          quantity: 1,
        },
      ];
    });
    setErrors((current) =>
      current.items ? { ...current, items: "" } : current,
    );
  }

  function changeQuantity(cameraId, delta) {
    setItems((current) =>
      current.map((item) =>
        item.camera_id === cameraId
          ? {
              ...item,
              quantity: Math.min(item.cap, Math.max(1, item.quantity + delta)),
            }
          : item,
      ),
    );
  }

  function removeItem(cameraId) {
    setItems((current) =>
      current.filter((item) => item.camera_id !== cameraId),
    );
  }

  function validate() {
    const found = {};

    const name = form.customer_name.trim();
    if (!name) found.customer_name = "Nama wajib diisi.";
    else if (name.length > 100)
      found.customer_name = "Nama maksimal 100 huruf.";

    const address = form.address.trim();
    if (!address) found.address = "Alamat wajib diisi.";
    else if (address.length > 500)
      found.address = "Alamat maksimal 500 karakter.";

    const whatsapp = form.whatsapp.replace(/[\s-]/g, "");
    if (!whatsapp) found.whatsapp = "Nomor WhatsApp wajib diisi.";
    else if (!WA_PATTERN.test(whatsapp))
      found.whatsapp = "Nomor WhatsApp harus 8–15 angka, boleh diawali +.";

    if (form.instagram.trim().length > 100)
      found.instagram = "Instagram maksimal 100 karakter.";

    if (items.length === 0) found.items = "Pilih minimal 1 produk.";

    return found;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setFormError("");

    const found = validate();
    setErrors(found);

    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => {
        document
          .querySelector("[data-order-form] [aria-invalid='true']")
          ?.scrollIntoView({ block: "center" });
      });
      return;
    }

    const instagram = form.instagram.trim().replace(/^@/, "");

    // Harga tidak dikirim: server mengambilnya dari data kamera.
    const payload = {
      customer_name: form.customer_name.trim(),
      address: form.address.trim(),
      whatsapp: form.whatsapp.replace(/[\s-]/g, ""),
      ...(instagram && { instagram }),
      items: items.map((item) => ({
        camera_id: item.camera_id,
        quantity: item.quantity,
      })),
    };

    setSubmitting(true);
    try {
      const response = await createOrder(payload);

      const created = response?.no_invoice
        ? response
        : (response?.data ?? response);
      setOrder({ ...created, contact_whatsapp: payload.whatsapp });

      // Kirim ringkasan ke toko di latar belakang; tidak menahan layar sukses.
      sendOrderEmail({
        order: created,
        payload,
        fallbackItems: items,
      }).then((sent) => {
        if (sent === false) setNotifyFailed(true);
      });
    } catch (error) {
      setFormError(describeOrderError(error));
    } finally {
      setSubmitting(false);
    }
  }

  function resetAll() {
    setForm(EMPTY_FORM);
    setItems([]);
    setErrors({});
    setFormError("");
    setOrder(null);
    setNotifyFailed(false);
  }

  if (order)
    return (
      <OrderSuccess
        order={order}
        notifyFailed={notifyFailed}
        onReset={resetAll}
      />
    );

  return (
    <form
      data-order-form
      onSubmit={handleSubmit}
      noValidate
      className="flex min-w-0 flex-1 flex-col gap-8 rounded-xl border border-second/30 bg-primary p-8"
    >
      <div>
        <h1 className="text-xl font-bold text-grad">Pesan Sekarang</h1>
        <p className="mt-2 text-pretty text-sm text-second/60">
          Pilih kamera, isi data Anda, lalu kirim. Harga mengikuti data toko.
        </p>
      </div>

      {/* Produk */}
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="order-camera-search" className={labelClass}>
            Produk
            <span className="ml-2 text-second2" aria-hidden="true">
              *
            </span>
          </label>
          <CameraPicker
            selectedIds={selectedIds}
            onAdd={addCamera}
            disabled={submitting}
            limitReached={items.length >= MAX_ITEMS}
            invalid={Boolean(errors.items)}
          />
          {errors.items && (
            <p
              id="order-camera-search-error"
              role="alert"
              className="mt-2 flex items-start gap-2 text-sm text-second2"
            >
              <FiAlertCircle
                size={16}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              {errors.items}
            </p>
          )}
        </div>

        {items.length > 0 && (
          <ul className="flex flex-col gap-4">
            {items.map((item) => (
              <li
                key={item.camera_id}
                className="flex items-center gap-4 rounded-xl border border-second/30 p-4"
              >
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt=""
                    className="size-16 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <span className="size-16 shrink-0 rounded-xl bg-second/10" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 break-words text-sm font-semibold text-second">
                    {item.name}
                  </p>
                  <p className="mt-2 text-xs tabular-nums text-second/60">
                    {formatRupiah(item.price)} · Stok {item.cap}
                    {item.cap === MAX_QTY ? "+" : ""}
                  </p>

                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => changeQuantity(item.camera_id, -1)}
                      disabled={submitting || item.quantity <= 1}
                      aria-label={`Kurangi jumlah ${item.name}`}
                      className={`inline-flex size-8 items-center justify-center rounded-full border border-second/30 text-second transition hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
                    >
                      <FiMinus size={16} aria-hidden="true" />
                    </button>
                    <span
                      aria-live="polite"
                      className="min-w-8 text-center text-sm font-semibold tabular-nums text-second"
                    >
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => changeQuantity(item.camera_id, 1)}
                      disabled={submitting || item.quantity >= item.cap}
                      aria-label={`Tambah jumlah ${item.name}`}
                      className={`inline-flex size-8 items-center justify-center rounded-full border border-second/30 text-second transition hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
                    >
                      <FiPlus size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => removeItem(item.camera_id)}
                    disabled={submitting}
                    aria-label={`Hapus ${item.name}`}
                    className={`inline-flex size-8 items-center justify-center rounded-full text-second2 transition hover:bg-second2/10 disabled:opacity-50 ${FOCUS_RING}`}
                  >
                    <FiTrash2 size={16} aria-hidden="true" />
                  </button>
                  <p className="text-sm font-semibold tabular-nums text-second">
                    {formatRupiah(item.price * item.quantity)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 && (
          <div className="flex items-center justify-between gap-4 border-t border-second/30 pt-4">
            <span className="text-sm font-semibold text-second">Total</span>
            <span className="text-lg font-bold tabular-nums text-grad">
              {formatRupiah(total)}
            </span>
          </div>
        )}
      </div>

      {/* Data pemesan */}
      <div className="flex flex-col gap-4">
        <Field
          id="order-name"
          label="Nama"
          required
          error={errors.customer_name}
        >
          <input
            id="order-name"
            type="text"
            autoComplete="name"
            maxLength={100}
            value={form.customer_name}
            disabled={submitting}
            onChange={(event) => setField("customer_name", event.target.value)}
            placeholder="Nama lengkap"
            aria-invalid={errors.customer_name ? "true" : undefined}
            aria-describedby={
              errors.customer_name ? "order-name-error" : undefined
            }
            className={inputClass(Boolean(errors.customer_name))}
          />
        </Field>

        <Field
          id="order-whatsapp"
          label="Nomor WhatsApp"
          required
          error={errors.whatsapp}
          hint="Boleh diawali 08, 62, atau +62."
        >
          <input
            id="order-whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            value={form.whatsapp}
            disabled={submitting}
            onChange={(event) =>
              setField("whatsapp", event.target.value.replace(/[^\d+\s-]/g, ""))
            }
            placeholder="0812 3456 7890"
            aria-invalid={errors.whatsapp ? "true" : undefined}
            aria-describedby={
              errors.whatsapp ? "order-whatsapp-error" : undefined
            }
            className={`${inputClass(Boolean(errors.whatsapp))} tabular-nums`}
          />
        </Field>

        <Field
          id="order-address"
          label="Alamat"
          required
          error={errors.address}
        >
          <textarea
            id="order-address"
            autoComplete="street-address"
            rows={3}
            maxLength={500}
            value={form.address}
            disabled={submitting}
            onChange={(event) => setField("address", event.target.value)}
            placeholder="Alamat lengkap"
            aria-invalid={errors.address ? "true" : undefined}
            aria-describedby={
              errors.address ? "order-address-error" : undefined
            }
            className={`${inputClass(Boolean(errors.address))} resize-y`}
          />
        </Field>

        <Field id="order-instagram" label="Instagram" error={errors.instagram}>
          <input
            id="order-instagram"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={100}
            value={form.instagram}
            disabled={submitting}
            onChange={(event) => setField("instagram", event.target.value)}
            placeholder="username"
            aria-invalid={errors.instagram ? "true" : undefined}
            aria-describedby={
              errors.instagram ? "order-instagram-error" : undefined
            }
            className={inputClass(Boolean(errors.instagram))}
          />
        </Field>
      </div>

      {formError && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-2 text-sm text-second2"
        >
          <FiAlertTriangle
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl bg-grad px-4 py-2 text-sm font-semibold text-primary shadow-lg shadow-second4/25 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation ${FOCUS_RING}`}
      >
        {submitting ? (
          <>
            <FiLoader
              className="animate-spin motion-reduce:animate-none"
              size={16}
              aria-hidden="true"
            />
            Mengirim…
          </>
        ) : (
          "Kirim pesanan"
        )}
      </button>
    </form>
  );
}

/* --------------------------------- Halaman -------------------------------- */

export default function ContactPage() {
  const { data: store } = useGetStore();

  const whatsapp = normalizeWhatsapp(store?.whatsapp);
  const instagram = String(store?.instagram ?? "").trim();
  const tiktok = String(store?.tiktok ?? "").trim();
  const shopee = String(store?.facebook ?? "").trim();

  const contacts = [
    {
      key: "whatsapp",
      label: "WhatsApp",
      text: formatWhatsapp(whatsapp),
      href: whatsapp ? `https://wa.me/${whatsapp}` : null,
      icon: BsWhatsapp,
    },
    {
      key: "instagram",
      label: "Instagram",
      text: instagram,
      href: instagram
        ? `https://instagram.com/${instagram.replace(/^@/, "")}`
        : null,
      icon: BsInstagram,
    },
    {
      key: "shopee",
      label: "Shopee",
      text: shopee,
      href: shopee
        ? /^https?:\/\//i.test(shopee)
          ? shopee
          : `https://${shopee}`
        : null,
      icon: SiShopee,
    },
    {
      key: "tiktok",
      label: "TikTok",
      text: tiktok,
      href: tiktok ? `https://tiktok.com/@${tiktok.replace(/^@/, "")}` : null,
      icon: BsTiktok,
    },
  ].filter((contact) => contact.text && contact.href);

  const address = String(store?.address ?? "").trim();
  const mapUrl = String(store?.map_url ?? "").trim();

  return (
    <div className="flex min-h-[100dvh] w-full flex-col gap-4 bg-second/10 px-4 pb-16 pt-20 lg:flex-row lg:items-start lg:px-56">
      <OrderForm />

      <aside className="flex h-fit w-full shrink-0 flex-col rounded-xl border border-second/30 bg-primary p-8 lg:w-70 sticky top-20">
        <div className="border-b border-second/30 pb-4">
          <p className="text-xl font-bold text-grad">Kontak Langsung</p>
        </div>

        <div className="flex flex-col gap-4 py-4">
          {contacts.map((item) => {
            const Icon = item.icon;

            return (
              <a
                key={item.key}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${item.label}: ${item.text}`}
                title={item.text}
                className={`flex min-w-0 items-center gap-4 transition hover:opacity-70 ${FOCUS_RING}`}
              >
                <Icon
                  className="shrink-0 text-xl text-second"
                  aria-hidden="true"
                />
                <span className="min-w-0 truncate text-second">
                  {item.text}
                </span>
              </a>
            );
          })}
        </div>

        {(address || mapUrl) && (
          <div className="flex items-start gap-4 border-t border-second/30 pt-4">
            <FiMapPin
              className="mt-0.5 shrink-0 text-xl text-second"
              aria-hidden="true"
            />
            {mapUrl ? (
              <p
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`line-clamp-3 min-w-0 break-words text-sm text-second transition ${FOCUS_RING}`}
              >
                {address || "Lihat di peta"}
              </p>
            ) : (
              <p className="line-clamp-3 min-w-0 break-words text-sm text-second">
                {address}
              </p>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
