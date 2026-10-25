"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image.js";
import Link from "next/link.js";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FiArrowLeft,
  FiCheck,
  FiLoader,
  FiMinus,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiX,
} from "react-icons/fi";

import {
  useCreateOrder,
  useGetCamera,
  useGetCameras,
} from "../../features/public/hooks.js";
import { normalizeApiError } from "../../../lib/api/errors.js";
import notify from "../../../lib/notify.js";

const MAX_QUANTITY = 10;
const MAX_ITEMS = 10;

const priceFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

function formatPrice(value) {
  const number = Number(value);

  if (value === null || value === undefined || Number.isNaN(number)) {
    return "0";
  }

  return priceFormatter.format(number);
}

const CONDITION_LABEL = {
  NEW: "Baru",
  SECOND: "Bekas",
};

const inputClass =
  "h-12 w-full rounded-md border border-second/30 bg-primary px-4 text-sm text-second outline-none transition-colors placeholder:text-second/40 focus:border-second disabled:opacity-50";

const labelClass = "mb-2 block text-sm font-medium text-second";

// Server hanya menerima digit dengan "+" opsional di depan, 8 sampai 15 karakter.
function cleanWhatsapp(value) {
  return String(value ?? "").replace(/[\s\-().]/g, "");
}

function isValidWhatsapp(value) {
  return /^\+?\d{8,15}$/.test(value);
}

// Detail kamera (images[]) dan kartu daftar (image_url) disamakan jadi satu bentuk.
function toOrderItem(camera) {
  const primary =
    camera.images?.find((image) => image.is_primary) ?? camera.images?.[0];

  return {
    id: camera.id,
    name: camera.name,
    price: Number(camera.price),
    condition: camera.condition,
    stock: Number(camera.stock),
    image_url: camera.image_url ?? primary?.image_url ?? null,
    quantity: 1,
  };
}

function maxQuantityOf(item) {
  return Math.max(1, Math.min(MAX_QUANTITY, item.stock));
}

// Ubah error API menjadi pesan yang bisa dibaca pembeli.
function getOrderErrorMessage(error) {
  const data = error?.response?.data;
  const code = typeof data?.errors === "string" ? data.errors : "";

  if (code === "INSUFFICIENT_STOCK") {
    const list = data?.details?.cameras ?? [];

    return list.length > 0
      ? `Stok tidak cukup: ${list
          .map((item) => `${item.name} (tersisa ${item.stock})`)
          .join(", ")}.`
      : "Stok kamera tidak cukup.";
  }

  if (code === "CAMERA_NOT_FOUND") {
    return "Ada kamera yang sudah tidak tersedia dan dihapus dari pesanan.";
  }

  if (code === "TOO_MANY_REQUESTS") {
    return "Terlalu banyak percobaan. Coba lagi dalam beberapa menit.";
  }

  if (code === "STORE_NOT_READY") {
    return "Toko belum siap menerima pesanan. Coba lagi nanti.";
  }

  return normalizeApiError(error).message || "Gagal membuat pesanan.";
}

function PageFallback() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center gap-2 text-sm text-second/60">
      <FiLoader className="animate-spin" size={22} />
      Memuat halaman pesan...
    </div>
  );
}

function BackBar({ onBack }) {
  return (
    <div className="sticky top-0 z-30 -mx-4 -mt-4 bg-primary px-4 py-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-second/60 transition-colors hover:text-second"
      >
        <FiArrowLeft size={18} />
        Kembali
      </button>
    </div>
  );
}

// Sheet pencarian produk. Tetap terbuka setelah menambah, supaya bisa memilih beberapa.
function AddProductSheet({ addedIds, itemCount, onAdd, onClose }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  // Debounce supaya tidak request di setiap ketikan (batas 120 request/menit per IP).
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  // Kunci scroll halaman dan tutup dengan Escape.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const camerasQuery = useGetCameras({
    search: debouncedSearch,
    sort: "newest",
    page,
  });

  const cameras = camerasQuery.data?.data ?? [];
  const paging = camerasQuery.data?.paging;
  const limitReached = itemCount >= MAX_ITEMS;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Tambah produk"
    >
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />

      <div className="relative flex max-h-[80dvh] w-full max-w-md flex-col gap-4 rounded-t-md bg-primary p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl md:rounded-md">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-second">Tambah produk</h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex size-8 items-center justify-center rounded-lg text-second/50 transition-colors hover:bg-second/5 hover:text-second"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="flex h-12 items-center gap-2 rounded-md border border-second/30 px-4">
          <FiSearch size={16} className="shrink-0 text-second/50" />

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            maxLength={100}
            autoFocus
            placeholder="Cari nama kamera"
            aria-label="Cari nama kamera"
            className="w-full bg-transparent text-sm text-second outline-none placeholder:text-second/40"
          />
        </div>

        {limitReached && (
          <p className="text-sm text-second/60">
            Maksimal {MAX_ITEMS} jenis kamera dalam satu pesanan.
          </p>
        )}

        <div className="min-h-32 flex-1 space-y-2 overflow-y-auto">
          {camerasQuery.isPending ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-second/60">
              <FiLoader className="animate-spin" size={18} />
              Memuat produk...
            </div>
          ) : camerasQuery.isError ? (
            <div className="space-y-2 py-8 text-center">
              <p className="text-sm text-second">Gagal memuat produk.</p>
              <button
                type="button"
                onClick={() => camerasQuery.refetch()}
                className="text-sm font-semibold text-second underline"
              >
                Coba lagi
              </button>
            </div>
          ) : cameras.length === 0 ? (
            <p className="py-8 text-center text-sm text-second/50">
              {debouncedSearch
                ? "Tidak ada produk yang cocok."
                : "Belum ada produk."}
            </p>
          ) : (
            <div
              className={`space-y-2 transition-opacity ${
                camerasQuery.isPlaceholderData ? "opacity-60" : ""
              }`}
            >
              {cameras.map((camera) => {
                const isAdded = addedIds.includes(camera.id);
                const isOutOfStock = !(Number(camera.stock) > 0);
                const disabled = isAdded || isOutOfStock || limitReached;

                return (
                  <div
                    key={camera.id}
                    className="flex items-center gap-4 rounded-md border border-second/30 p-2"
                  >
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-second/5">
                      {camera.image_url && (
                        <Image
                          src={camera.image_url}
                          alt={camera.name}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 break-words text-sm font-medium text-second">
                        {camera.name}
                      </p>
                      <p className="text-sm text-grad">
                        Rp{formatPrice(camera.price)}
                        {isOutOfStock && (
                          <span className="ml-2 text-second/50">
                            Stok habis
                          </span>
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onAdd(camera)}
                      disabled={disabled}
                      className="flex h-8 shrink-0 items-center gap-2 rounded-full bg-second px-4 text-sm font-semibold text-primary transition-colors hover:bg-second/80 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isAdded ? (
                        <>
                          <FiCheck size={14} />
                          Ada
                        </>
                      ) : (
                        <>
                          <FiPlus size={14} />
                          Tambah
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {paging && paging.total_pages > 1 && (
          <div className="flex items-center justify-between gap-2 text-sm">
            <button
              type="button"
              onClick={() => setPage((previous) => Math.max(1, previous - 1))}
              disabled={page <= 1 || camerasQuery.isPlaceholderData}
              className="flex h-8 items-center rounded-full border border-second/15 px-4 font-semibold text-second disabled:opacity-40"
            >
              Sebelumnya
            </button>

            <span className="text-second/60">
              {page}/{paging.total_pages}
            </span>

            <button
              type="button"
              onClick={() =>
                setPage((previous) =>
                  Math.min(paging.total_pages, previous + 1),
                )
              }
              disabled={
                page >= paging.total_pages || camerasQuery.isPlaceholderData
              }
              className="flex h-8 items-center rounded-full border border-second/15 px-4 font-semibold text-second disabled:opacity-40"
            >
              Berikutnya
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="flex h-12 w-full items-center justify-center rounded-full bg-second px-4 text-sm font-semibold text-primary transition-colors hover:bg-second/80"
        >
          Selesai
        </button>
      </div>
    </div>
  );
}

// Bukti pesanan setelah berhasil.
function OrderReceipt({ order }) {
  const [copied, setCopied] = useState(false);

  async function copyInvoice() {
    try {
      await navigator.clipboard.writeText(order.no_invoice);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error("Gagal menyalin nomor invoice.");
    }
  }

  return (
    <div className="mx-auto h-[100dvh] w-full max-w-md space-y-4 p-4 pb-8">
      <div className="flex flex-col items-center gap-2 pt-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-second text-primary">
          <FiCheck size={24} />
        </div>

        <h1 className="text-base font-bold text-second">
          Pesanan berhasil dibuat
        </h1>

        <p className="text-sm text-second/60">
          Terima kasih, {order.customer_name}. Simpan nomor invoice di bawah ini
          sebagai bukti pesanan.
        </p>
      </div>

      <section className="space-y-4 rounded-md border border-second/30 p-4">
        <div className="space-y-2">
          <p className="text-sm text-second/60">Nomor invoice</p>

          <div className="flex items-center justify-between gap-2">
            <p className="break-all text-base font-semibold text-second">
              {order.no_invoice}
            </p>

            <button
              type="button"
              onClick={copyInvoice}
              className="flex h-8 shrink-0 items-center rounded-full border border-second/15 px-4 text-sm font-semibold text-second transition-colors hover:bg-second/5"
            >
              {copied ? "Tersalin" : "Salin"}
            </button>
          </div>
        </div>

        <div className="space-y-2 border-t border-second/10 pt-4">
          {order.items?.map((item, index) => (
            <div
              key={`${item.camera_name}-${index}`}
              className="flex items-start justify-between gap-4 text-sm"
            >
              <div className="min-w-0">
                <p className="break-words text-second">{item.camera_name}</p>
                <p className="text-second/60">
                  {item.quantity} x Rp{formatPrice(item.camera_price)}
                </p>
              </div>

              <p className="shrink-0 font-medium text-second">
                Rp{formatPrice(item.line_total)}
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-second/10 pt-4">
          <p className="font-semibold text-second">Total</p>
          <p className="text-base font-semibold text-grad">
            Rp{formatPrice(order.total_amount)}
          </p>
        </div>
      </section>

      <p className="text-center text-sm text-second/60">
        Admin akan menghubungi kamu lewat WhatsApp untuk metode pembayaran dan
        pengiriman.
      </p>

      <Link
        href="/"
        className="flex h-12 w-full items-center justify-center rounded-full bg-second px-4 text-sm font-semibold text-primary transition-colors hover:bg-second/80"
      >
        Kembali ke beranda
      </Link>
    </div>
  );
}

function OrderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cameraId = searchParams.get("camera_id") ?? "";

  // Tanpa camera_id, query tidak jalan dan pesanan dimulai dari daftar kosong.
  const cameraQuery = useGetCamera(cameraId);
  const createOrder = useCreateOrder();

  const [form, setForm] = useState({
    customer_name: "",
    address: "",
    whatsapp: "",
    instagram: "",
  });
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [order, setOrder] = useState(null);

  const camera = cameraQuery.data?.data ?? cameraQuery.data;
  const isSubmitting = createOrder.isPending;

  // Kamera dari URL dimasukkan sekali sebagai item pertama.
  useEffect(() => {
    if (ready) return;

    if (!cameraId) {
      setReady(true);
      return;
    }

    if (camera) {
      setItems([toOrderItem(camera)]);
      setReady(true);
    }
  }, [ready, cameraId, camera]);

  function goBack() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  function updateField(event) {
    const { name, value } = event.target;

    setForm((previous) => ({ ...previous, [name]: value }));
    setFieldErrors((previous) => ({ ...previous, [name]: "" }));
  }

  function addItem(cameraToAdd) {
    setItems((previous) => {
      if (previous.length >= MAX_ITEMS) return previous;
      if (previous.some((item) => item.id === cameraToAdd.id)) return previous;

      return [...previous, toOrderItem(cameraToAdd)];
    });
  }

  function removeItem(id) {
    setItems((previous) => previous.filter((item) => item.id !== id));
  }

  function changeQuantity(id, delta) {
    setItems((previous) =>
      previous.map((item) => {
        if (item.id !== id) return item;

        const next = Math.min(
          maxQuantityOf(item),
          Math.max(1, item.quantity + delta),
        );

        return { ...item, quantity: next };
      }),
    );
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) return;

    if (items.length === 0) {
      notify.error("Tambahkan minimal satu produk.");
      return;
    }

    if (items.some((item) => !(item.stock > 0))) {
      notify.error("Hapus produk yang stoknya habis dari pesanan.");
      return;
    }

    const customerName = form.customer_name.trim();
    const address = form.address.trim();
    const whatsapp = cleanWhatsapp(form.whatsapp);
    const instagram = form.instagram.trim();

    const errors = {};

    if (!customerName) errors.customer_name = "Nama wajib diisi.";
    if (!address) errors.address = "Alamat wajib diisi.";

    if (!whatsapp) {
      errors.whatsapp = "Nomor WhatsApp wajib diisi.";
    } else if (!isValidWhatsapp(whatsapp)) {
      errors.whatsapp =
        "Nomor harus 8 sampai 15 digit, boleh diawali + (contoh: 081234567890).";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const payload = {
      customer_name: customerName,
      address,
      whatsapp,
      // Kosong = tidak dikirim, server menyimpannya sebagai null.
      ...(instagram && { instagram }),
      items: items.map((item) => ({
        camera_id: item.id,
        quantity: item.quantity,
      })),
    };

    createOrder.mutate(payload, {
      onSuccess: (response) => {
        setOrder(response?.data ?? response);
        window.scrollTo({ top: 0 });
      },
      onError: (error) => {
        notify.error(getOrderErrorMessage(error));

        const data = error?.response?.data;
        const code = data?.errors;

        // Stok berubah: samakan stok dan jumlah item dengan yang dikirim server.
        if (code === "INSUFFICIENT_STOCK") {
          const list = data?.details?.cameras ?? [];

          setItems((previous) =>
            previous.map((item) => {
              const hit = list.find((entry) => entry.camera_id === item.id);
              if (!hit) return item;

              const stock = Number(hit.stock);

              return {
                ...item,
                stock,
                quantity: Math.min(item.quantity, Math.max(1, stock)),
              };
            }),
          );
        }

        // Kamera sudah dihapus: buang dari pesanan.
        if (code === "CAMERA_NOT_FOUND") {
          const missing = data?.details?.camera_ids ?? [];

          setItems((previous) =>
            previous.filter((item) => !missing.includes(item.id)),
          );
        }
      },
    });
  }

  if (order) {
    return <OrderReceipt order={order} />;
  }

  // Kamera dari URL gagal dimuat.
  if (cameraId && !ready && cameraQuery.isError) {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col items-center justify-center gap-4 p-4 text-center">
        <h1 className="font-semibold text-second">Kamera tidak ditemukan</h1>
        <p className="text-sm text-second/60">
          Produk ini mungkin sudah dihapus atau terjadi gangguan koneksi.
        </p>

        <div className="flex gap-2">
          <Link
            href="/"
            className="flex h-8 items-center rounded-full border border-second/15 px-4 text-sm font-semibold text-second"
          >
            Ke beranda
          </Link>

          <button
            type="button"
            onClick={() => cameraQuery.refetch()}
            disabled={cameraQuery.isFetching}
            className="flex h-8 items-center rounded-full bg-second px-4 text-sm font-semibold text-primary disabled:opacity-50"
          >
            {cameraQuery.isFetching ? "Memuat..." : "Coba lagi"}
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return <PageFallback />;
  }

  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const hasOutOfStock = items.some((item) => !(item.stock > 0));
  const canAddMore = items.length < MAX_ITEMS;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 bg-primary p-4 pb-8">
      <BackBar onBack={goBack} />

      <h1 className="text-base font-bold text-second">Form pemesanan</h1>

      {/* Daftar produk yang dipesan */}
      <section className="space-y-4 rounded-md border border-second/30 p-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-semibold text-second">
            Produk ({items.length}/{MAX_ITEMS})
          </h2>

          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            disabled={isSubmitting || !canAddMore}
            className="flex h-8 items-center gap-2 rounded-full border border-second/15 px-4 text-sm font-semibold text-second transition-colors hover:bg-second/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FiPlus size={14} />
            Tambah produk
          </button>
        </div>

        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-second/50">
            Belum ada produk. Tekan Tambah produk untuk mencari kamera.
          </p>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const isOutOfStock = !(item.stock > 0);
              const max = maxQuantityOf(item);

              return (
                <div
                  key={item.id}
                  className="space-y-4 border-b border-second/10 pb-4 last:border-b-0 last:pb-0"
                >
                  <div className="flex gap-4">
                    <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-second/5">
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-second/40">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <h3 className="line-clamp-2 break-words text-sm font-semibold text-second">
                        {item.name}
                      </h3>

                      <p className="text-sm text-second/60">
                        {CONDITION_LABEL[item.condition] ?? item.condition}
                        {" · "}
                        {isOutOfStock ? "Stok habis" : `Stok ${item.stock}`}
                      </p>

                      <p className="text-sm font-semibold text-grad">
                        Rp{formatPrice(item.price)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      disabled={isSubmitting}
                      aria-label={`Hapus ${item.name}`}
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-second/50 transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-second">Jumlah</p>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => changeQuantity(item.id, -1)}
                        disabled={
                          isSubmitting || isOutOfStock || item.quantity <= 1
                        }
                        aria-label="Kurangi jumlah"
                        className="flex size-8 items-center justify-center rounded-full border border-second/15 text-second transition-colors hover:bg-second/5 disabled:opacity-40"
                      >
                        <FiMinus size={16} />
                      </button>

                      <span
                        aria-live="polite"
                        className="w-8 text-center text-sm font-semibold text-second"
                      >
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => changeQuantity(item.id, 1)}
                        disabled={
                          isSubmitting || isOutOfStock || item.quantity >= max
                        }
                        aria-label="Tambah jumlah"
                        className="flex size-8 items-center justify-center rounded-full border border-second/15 text-second transition-colors hover:bg-second/5 disabled:opacity-40"
                      >
                        <FiPlus size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="customer_name" className={labelClass}>
            Nama lengkap
            <span className="ml-2 text-red-500">*</span>
          </label>

          <input
            id="customer_name"
            name="customer_name"
            value={form.customer_name}
            onChange={updateField}
            maxLength={100}
            autoComplete="name"
            placeholder="Contoh: Budi Santoso"
            aria-invalid={Boolean(fieldErrors.customer_name)}
            disabled={isSubmitting}
            className={inputClass}
          />

          {fieldErrors.customer_name && (
            <p className="mt-2 text-xs text-red-500">
              {fieldErrors.customer_name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="whatsapp" className={labelClass}>
            Nomor WhatsApp
            <span className="ml-2 text-red-500">*</span>
          </label>

          <input
            id="whatsapp"
            name="whatsapp"
            type="tel"
            inputMode="tel"
            value={form.whatsapp}
            onChange={updateField}
            maxLength={20}
            autoComplete="tel"
            placeholder="081234567890"
            aria-invalid={Boolean(fieldErrors.whatsapp)}
            disabled={isSubmitting}
            className={inputClass}
          />

          {fieldErrors.whatsapp && (
            <p className="mt-2 text-xs text-red-500">{fieldErrors.whatsapp}</p>
          )}
        </div>

        <div>
          <label htmlFor="address" className={labelClass}>
            Alamat lengkap
            <span className="ml-2 text-red-500">*</span>
          </label>

          <textarea
            id="address"
            name="address"
            value={form.address}
            onChange={updateField}
            maxLength={500}
            autoComplete="street-address"
            placeholder="Jalan, nomor, kelurahan, kota, kode pos"
            aria-invalid={Boolean(fieldErrors.address)}
            disabled={isSubmitting}
            className={`${inputClass} h-auto min-h-28 resize-y p-4`}
          />

          <div className="mt-2 flex items-start justify-between gap-2">
            <p className="text-xs text-red-500">{fieldErrors.address}</p>
            <p className="shrink-0 text-xs text-second/40">
              {form.address.length}/500
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="instagram" className={labelClass}>
            Instagram
            <span className="ml-2 text-second/40">(opsional)</span>
          </label>

          <input
            id="instagram"
            name="instagram"
            value={form.instagram}
            onChange={updateField}
            maxLength={100}
            autoComplete="off"
            placeholder="@username"
            disabled={isSubmitting}
            className={inputClass}
          />
        </div>

        {/* Ringkasan total. Angka final dihitung server saat pesanan dibuat. */}
        <section className="space-y-2 rounded-md border border-second/30 p-4">
          <div className="flex items-center justify-between gap-4 text-sm">
            <p className="text-second/60">
              Total ({items.reduce((sum, item) => sum + item.quantity, 0)} unit)
            </p>

            <p className="text-base font-semibold text-grad">
              Rp{formatPrice(total)}
            </p>
          </div>

          <p className="text-xs text-second/50">
            Total final dihitung ulang oleh toko saat pesanan dibuat. Metode
            pembayaran dan pengiriman diatur admin setelah pesanan masuk.
          </p>
        </section>

        {hasOutOfStock && (
          <p className="text-sm text-red-500">
            Ada produk yang stoknya habis. Hapus dulu dari pesanan untuk
            melanjutkan.
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || items.length === 0 || hasOutOfStock}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-second px-4 text-sm font-semibold text-primary transition-colors hover:bg-second/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <FiLoader className="animate-spin" size={17} />
              Mengirim pesanan...
            </>
          ) : (
            "Buat pesanan"
          )}
        </button>
      </form>

      {sheetOpen && (
        <AddProductSheet
          addedIds={items.map((item) => item.id)}
          itemCount={items.length}
          onAdd={addItem}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}

// Suspense wajib karena useSearchParams() membaca data runtime.
export default function OrderPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <div className="w-full h-full bg-primary">
        {" "}
        <OrderPageContent />
      </div>
    </Suspense>
  );
}
