"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link.js";
import { useParams, useRouter } from "next/navigation.js";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiArrowLeft,
  FiCamera,
  FiCheck,
  FiInfo,
  FiLoader,
  FiLock,
  FiMinus,
  FiPlus,
  FiRotateCcw,
  FiSearch,
  FiShoppingBag,
  FiTrash2,
} from "react-icons/fi";

import {
  useGetOwnerOrder,
  useUpdateOrderItems,
} from "../../../../../features/orders/hooks.js";
import { useGetCameras } from "../../../../../features/cameras/hooks.js";
import { normalizeApiError } from "../../../../../../lib/api/errors.js";
import notify from "../../../../../../lib/notify.js";
import PrimaryButton from "../../../../../../components/primary-button.jsx";
import CancelButton from "../../../../../../components/cancel-button";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN DETAIL ORDER / INVOICE)                      */
/*  Spacing : only 2, 4, 8, 16                                                */
/*  Color   : primary + second (+ second2 error, second3 sukses, second4 fokus) */
/* -------------------------------------------------------------------------- */

const ORDERS_PATH = "/owner/orders";
const ORDER_DETAIL_PATH = (id) => `/owner/orders/${id}`;

const MAX_ITEMS = 50;
const MAX_QUANTITY = 1000;
const SEARCH_DEBOUNCE_MS = 400;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

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

function formatNumber(number = 0) {
  return new Intl.NumberFormat("id-ID").format(number);
}

function formatPrice(price = 0) {
  const amount = Number(price) || 0;
  const sign = amount < 0 ? "-" : "";

  return `${sign}${new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Math.abs(amount))}`;
}

function useDebouncedValue(value, delay = SEARCH_DEBOUNCE_MS) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/* Kode error backend (err.response.data.errors) -> pesan Indonesia */
function describeError(error) {
  const body = error?.response?.data;
  const code = body?.errors;

  switch (code) {
    case "ORDER_NOT_FOUND":
      return { code, message: "Order tidak ditemukan." };
    case "ORDER_ALREADY_PAID":
      return {
        code,
        message:
          "Order sudah lunas, jadi item tidak bisa diubah. Tandai belum lunas dulu.",
      };
    case "ORDER_NOT_SALE":
      return { code, message: "Order refund tidak bisa diubah itemnya." };
    case "CAMERA_NOT_FOUND":
      return {
        code,
        cameraIds: Array.isArray(body?.camera_ids) ? body.camera_ids : [],
        message:
          "Ada kamera yang tidak ditemukan atau sudah dihapus. Hapus dari daftar lalu simpan lagi.",
      };
    case "DISCOUNT_EXCEEDS_TOTAL":
      return {
        code,
        message:
          "Diskon di invoice lebih besar dari total baru. Kurangi diskon lewat edit invoice atau ubah isi pesanan.",
      };
    default:
      return { code, message: normalizeApiError(error).message };
  }
}

/* ------------------------------ Small pieces ------------------------------ */

function Tag({ children, tone = "outline" }) {
  const tones = {
    outline: "border border-second/30 text-second/60",
    strong: "border border-second4 text-second4",
    soft: "bg-second/10 text-second",
    grad: "bg-grad text-primary",
    failure: "bg-second2 text-primary",
  };

  return (
    <span
      className={`inline-flex h-4 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-2 text-xs font-semibold leading-none ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function ErrorText({ id, children }) {
  return (
    <p
      id={id}
      role="alert"
      className="flex items-start gap-2 text-sm text-second2"
    >
      <FiAlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

function FormSection({ title, description, aside, children, sectionRef }) {
  return (
    <section
      ref={sectionRef}
      className="flex min-w-0 scroll-mt-16 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8"
    >
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

function QuantityButton({ label, onClick, disabled, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-second/30 text-second shadow transition-colors hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation ${FOCUS_RING}`}
    >
      {children}
    </button>
  );
}

function SummaryRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-xs text-second/60">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-semibold tabular-nums text-second">
        {children}
      </dd>
    </div>
  );
}

function StatePanel({ icon: Icon, title, children, actions }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header>
        <Link
          href={ORDERS_PATH}
          className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke daftar order
        </Link>
      </header>

      <section className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-second/30 bg-primary px-4 py-16 text-center shadow-xl shadow-second/5">
        <div
          aria-hidden="true"
          className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-second/5 text-second/40"
        >
          <Icon size={24} />
        </div>
        <h1 className="text-lg font-bold text-second">{title}</h1>
        <p className="max-w-md text-pretty text-sm text-second/60">
          {children}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {actions}
        </div>
      </section>
    </div>
  );
}

/* --------------------------------- Item row -------------------------------- */

function ItemRow({
  item,
  error,
  disabled,
  onQuantityChange,
  onStep,
  onRemove,
}) {
  const quantity = Number(item.quantity);
  const validQuantity =
    Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_QUANTITY;
  const lineTotal = validQuantity ? item.price * quantity : 0;
  const changed =
    !item.isNew && validQuantity && quantity !== item.originalQuantity;
  const overStock =
    item.isNew &&
    validQuantity &&
    Number.isFinite(item.stock) &&
    quantity > item.stock;

  return (
    <li
      className={`flex flex-col gap-4 rounded-xl border p-4 transition-colors ${
        error ? "border-second2 bg-second2/5" : "border-second/30"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiCamera size={16} />
          </div>

          <div className="min-w-0">
            <p className="break-words text-sm font-semibold text-second">
              {item.name}
            </p>

            {item.sku && (
              <p className="mt-2 font-mono text-xs text-second/60">
                SKU {item.sku}
              </p>
            )}

            <p className="mt-2 text-xs tabular-nums text-second/60">
              {formatPrice(item.price)} × {validQuantity ? quantity : "—"}
              {item.isNew ? " · harga saat ini" : " · harga saat order dibuat"}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {item.isNew && <Tag tone="grad">Baru</Tag>}
              {changed && (
                <Tag tone="strong">Semula {item.originalQuantity}</Tag>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:justify-end">
          <QuantityButton
            label={`Kurangi jumlah ${item.name}`}
            onClick={() => onStep(item.camera_id, -1)}
            disabled={disabled || (validQuantity && quantity <= 1)}
          >
            <FiMinus size={16} aria-hidden="true" />
          </QuantityButton>

          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            aria-label={`Jumlah ${item.name}`}
            aria-invalid={error ? true : undefined}
            value={item.quantity}
            onChange={(event) =>
              onQuantityChange(item.camera_id, event.target.value)
            }
            disabled={disabled}
            maxLength={4}
            className={`${inputClass(Boolean(error))} w-16 px-2 text-center tabular-nums`}
          />

          <QuantityButton
            label={`Tambah jumlah ${item.name}`}
            onClick={() => onStep(item.camera_id, 1)}
            disabled={disabled || (validQuantity && quantity >= MAX_QUANTITY)}
          >
            <FiPlus size={16} aria-hidden="true" />
          </QuantityButton>

          <button
            type="button"
            aria-label={`Hapus ${item.name} dari order`}
            onClick={() => onRemove(item.camera_id)}
            disabled={disabled}
            className={`ml-2 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-second2 shadow transition-colors hover:bg-second2 hover:text-primary disabled:opacity-50 touch-manipulation ${FOCUS_RING}`}
          >
            <FiTrash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-second/30 pt-4 text-sm">
        <span className="text-second/60">Subtotal item</span>
        <span className="font-semibold tabular-nums text-second">
          {validQuantity ? formatPrice(lineTotal) : "—"}
        </span>
      </div>

      {error && <ErrorText>{error}</ErrorText>}

      {overStock && (
        <p className="flex items-start gap-2 rounded-xl border border-second4/30 bg-second4/5 px-4 py-2 text-xs text-second4">
          <FiInfo size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          Stok saat ini {formatNumber(item.stock)}. Order tetap bisa disimpan,
          tetapi pelunasan gagal jika stok masih kurang.
        </p>
      )}
    </li>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export default function OwnerOrderItemsPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const initializedId = useRef(null);
  const itemsRef = useRef(null);

  const {
    data: order,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useGetOwnerOrder(id);

  const updateMutation = useUpdateOrderItems();
  const isSaving = updateMutation.isPending;

  const [items, setItems] = useState([]);
  const [rowErrors, setRowErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [cameraSearch, setCameraSearch] = useState("");

  const debouncedSearch = useDebouncedValue(cameraSearch.trim());

  const {
    data: cameraResponse,
    isLoading: isLoadingCameras,
    isError: isCameraError,
    isFetching: isFetchingCameras,
    refetch: refetchCameras,
  } = useGetCameras({ search: debouncedSearch, page: 1 });

  const cameras = Array.isArray(cameraResponse)
    ? cameraResponse
    : Array.isArray(cameraResponse?.data)
      ? cameraResponse.data
      : [];

  const isNotFound =
    isError && error?.response?.data?.errors === "ORDER_NOT_FOUND";

  /* Item asli dari order, dipakai untuk deteksi perubahan dan tombol kembalikan. */
  const initialItems = useMemo(
    () =>
      (order?.items ?? []).map((item) => ({
        camera_id: item.camera_id,
        name: item.camera_name,
        sku: item.sku ?? null,
        price: Number(item.camera_price) || 0,
        quantity: String(item.quantity),
        originalQuantity: Number(item.quantity) || 0,
        isNew: false,
        stock: undefined,
      })),
    [order],
  );

  useEffect(() => {
    if (!order || initializedId.current === order.id) return;

    initializedId.current = order.id;
    setItems(initialItems);
    setRowErrors({});
    setFormError("");
  }, [order, initialItems]);

  useEffect(() => {
    if (isNotFound) {
      notify.error("Order tidak ditemukan.");
      router.replace(ORDERS_PATH);
    }
  }, [isNotFound, router]);

  useEffect(() => {
    if (isError && !isNotFound) {
      notify.error(normalizeApiError(error).message);
    }
  }, [isError, isNotFound, error]);

  useEffect(() => {
    if (isCameraError) notify.error("Gagal memuat daftar kamera.");
  }, [isCameraError]);

  /* ------------------------------ Mutasi lokal ----------------------------- */

  function clearErrors(cameraId) {
    setFormError("");

    if (cameraId) {
      setRowErrors((current) =>
        current[cameraId] ? { ...current, [cameraId]: undefined } : current,
      );
    }
  }

  function changeQuantity(cameraId, rawValue) {
    const digits = String(rawValue)
      .replace(/\D/g, "")
      .replace(/^0+(?=\d)/, "");

    setItems((current) =>
      current.map((item) =>
        item.camera_id === cameraId ? { ...item, quantity: digits } : item,
      ),
    );
    clearErrors(cameraId);
  }

  function stepQuantity(cameraId, delta) {
    setItems((current) =>
      current.map((item) => {
        if (item.camera_id !== cameraId) return item;

        const next = Math.min(
          MAX_QUANTITY,
          Math.max(1, (Number(item.quantity) || 0) + delta),
        );

        return { ...item, quantity: String(next) };
      }),
    );
    clearErrors(cameraId);
  }

  function removeItem(cameraId) {
    setItems((current) =>
      current.filter((item) => item.camera_id !== cameraId),
    );
    clearErrors(cameraId);
  }

  function restoreItem(original) {
    setItems((current) =>
      current.some((item) => item.camera_id === original.camera_id)
        ? current
        : [...current, original],
    );
    setFormError("");
  }

  function addCamera(camera) {
    if (items.some((item) => item.camera_id === camera.id)) {
      notify.error("Kamera tersebut sudah ada di order.");
      return;
    }

    if (items.length >= MAX_ITEMS) {
      notify.error(`Maksimal ${MAX_ITEMS} jenis kamera dalam satu order.`);
      return;
    }

    // Kamera yang tadinya ada di order dikembalikan dengan harga dan jumlah semula.
    const original = initialItems.find((item) => item.camera_id === camera.id);

    if (original) {
      restoreItem(original);
      return;
    }

    const price = Number(camera.price);

    if (!Number.isFinite(price) || price < 0) {
      notify.error("Harga kamera tidak valid.");
      return;
    }

    setItems((current) => [
      ...current,
      {
        camera_id: camera.id,
        name: camera.name,
        sku: camera.sku ?? null,
        price,
        quantity: "1",
        originalQuantity: 0,
        isNew: true,
        stock: Number.isFinite(Number(camera.stock))
          ? Number(camera.stock)
          : undefined,
      },
    ]);
    setFormError("");
  }

  /* ------------------------------ Turunan data ----------------------------- */

  const quantityOf = (item) => Number(item.quantity);
  const isValidQuantity = (item) => {
    const quantity = quantityOf(item);

    return (
      Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_QUANTITY
    );
  };

  const initialQuantities = new Map(
    initialItems.map((item) => [item.camera_id, item.originalQuantity]),
  );

  const isDirty =
    items.length !== initialItems.length ||
    items.some(
      (item) => initialQuantities.get(item.camera_id) !== quantityOf(item),
    );

  const removedItems = initialItems.filter(
    (original) => !items.some((item) => item.camera_id === original.camera_id),
  );

  const selectedIds = new Set(items.map((item) => item.camera_id));

  const newSubtotal = items.reduce(
    (sum, item) =>
      isValidQuantity(item) ? sum + item.price * quantityOf(item) : sum,
    0,
  );
  const newUnits = items.reduce(
    (sum, item) => (isValidQuantity(item) ? sum + quantityOf(item) : sum),
    0,
  );

  const invoice = order?.invoice;
  const storeDiscount =
    Number(invoice?.store_discount ?? order?.store_discount) || 0;
  const customerDiscount =
    Number(invoice?.customer_discount ?? order?.customer_discount) || 0;

  const estimatedTotal = newSubtotal - storeDiscount - customerDiscount;
  const oldTotal = Number(order?.total_amount) || 0;
  const difference = estimatedTotal - oldTotal;
  const discountLiveError =
    estimatedTotal < 0 ? "Total diskon di invoice melebihi total baru." : "";

  /* -------------------------------- Submit --------------------------------- */

  function validate() {
    const rows = {};
    let form = "";

    if (items.length < 1) {
      form =
        "Order harus punya minimal 1 item. Untuk membatalkan seluruh pesanan, hapus invoice-nya.";
    } else if (items.length > MAX_ITEMS) {
      form = `Maksimal ${MAX_ITEMS} jenis kamera dalam satu order.`;
    }

    items.forEach((item) => {
      if (!item.camera_id) {
        rows[item.camera_id ?? item.name] =
          "Kamera ini sudah tidak terhubung ke data produk, hapus dari daftar.";
      } else if (!isValidQuantity(item)) {
        rows[item.camera_id] = `Jumlah harus bilangan bulat 1–${MAX_QUANTITY}.`;
      }
    });

    if (!form && estimatedTotal < 0) {
      form =
        "Total diskon di invoice melebihi total baru. Kurangi diskon lewat edit invoice atau ubah isi pesanan.";
    }

    return { rows, form };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSaving || !order) return;

    const { rows, form } = validate();

    setRowErrors(rows);
    setFormError(form);

    if (form || Object.keys(rows).length > 0) {
      itemsRef.current?.scrollIntoView({ block: "start" });
      return;
    }

    if (!isDirty) {
      notify.error("Tidak ada perubahan untuk disimpan.");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          items: items.map((item) => ({
            camera_id: item.camera_id,
            quantity: quantityOf(item),
          })),
        },
      });

      notify.success(
        invoice?.is_final
          ? "Item order diperbarui. Invoice tetap final: unduh dan kirim ulang PDF-nya."
          : "Item order berhasil diperbarui.",
      );
      router.push(ORDER_DETAIL_PATH(id));
    } catch (err) {
      const apiError = describeError(err);

      if (apiError.code === "ORDER_NOT_FOUND") {
        notify.error(apiError.message);
        router.replace(ORDERS_PATH);
        return;
      }

      if (apiError.code === "CAMERA_NOT_FOUND" && apiError.cameraIds?.length) {
        setRowErrors(
          Object.fromEntries(
            apiError.cameraIds.map((cameraId) => [
              cameraId,
              "Kamera tidak ditemukan atau sudah dihapus.",
            ]),
          ),
        );
      }

      if (
        apiError.code === "ORDER_ALREADY_PAID" ||
        apiError.code === "ORDER_NOT_SALE"
      ) {
        // Status order berubah di tempat lain: muat ulang agar layar terkunci muncul.
        refetch();
      }

      setFormError(apiError.message);
      notify.error(apiError.message);
      itemsRef.current?.scrollIntoView({ block: "start" });
    }
  }

  /* -------------------------------- States --------------------------------- */

  if (isLoading || isNotFound) {
    return (
      <div
        className="flex items-center justify-center gap-4 py-16 text-sm text-second/60"
        role="status"
        aria-live="polite"
      >
        <FiLoader
          className="animate-spin motion-reduce:animate-none"
          size={16}
          aria-hidden="true"
        />
        Memuat order…
      </div>
    );
  }

  if (isError || !order) {
    return (
      <StatePanel
        icon={FiAlertTriangle}
        title="Gagal memuat order"
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className={`${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            {isFetching ? "Memuat…" : "Coba lagi"}
          </button>
        }
      >
        Order mungkin tidak ditemukan atau sesi Anda telah berakhir.
      </StatePanel>
    );
  }

  const detailLink = (
    <Link
      href={ORDER_DETAIL_PATH(order.id)}
      className={`${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 ${FOCUS_RING}`}
    >
      Kembali ke detail order
    </Link>
  );

  if (order.type !== "SALE") {
    return (
      <StatePanel
        icon={FiLock}
        title="Order refund tidak bisa diubah itemnya"
        actions={detailLink}
      >
        Hanya order penjualan yang isinya bisa diedit.
      </StatePanel>
    );
  }

  if (order.payment_status === "PAID") {
    return (
      <StatePanel icon={FiLock} title="Order sudah lunas" actions={detailLink}>
        Item hanya bisa diubah selama order belum lunas. Tandai order belum
        lunas dulu di halaman detail, lalu ubah itemnya.
      </StatePanel>
    );
  }

  const orderLabel = order.invoice?.no_invoice ?? "Order tanpa invoice";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        <Link
          href={ORDER_DETAIL_PATH(order.id)}
          className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke detail order
        </Link>

        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiShoppingBag size={16} />
          </div>

          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              Edit <span className="text-grad">item order</span>
            </h1>
            <p className="mt-2 text-pretty break-all text-sm text-second/60">
              {orderLabel}. Ubah jumlah, hapus, atau tambah kamera selama order
              belum lunas.
            </p>
          </div>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="grid grid-cols-1 items-start gap-8 xl:grid-cols-3"
      >
        <div className="flex min-w-0 flex-col gap-8 xl:col-span-2">
          <FormSection
            sectionRef={itemsRef}
            title="Item order"
            description="Item lama memakai harga saat order dibuat. Kamera yang baru ditambahkan memakai harga saat ini."
            aside={
              <Tag tone="soft">
                {items.length}/{MAX_ITEMS} jenis · {formatNumber(newUnits)} unit
              </Tag>
            }
          >
            {formError && <ErrorText id="items-error">{formError}</ErrorText>}

            {items.length === 0 ? (
              <p className="rounded-xl bg-second/5 p-4 text-sm text-second/60">
                Belum ada item. Tambahkan kamera dari daftar di bawah, atau
                kembalikan item yang tadi dihapus.
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {items.map((item) => (
                  <ItemRow
                    key={item.camera_id ?? item.name}
                    item={item}
                    error={rowErrors[item.camera_id]}
                    disabled={isSaving}
                    onQuantityChange={changeQuantity}
                    onStep={stepQuantity}
                    onRemove={removeItem}
                  />
                ))}
              </ul>
            )}

            {removedItems.length > 0 && (
              <div className="flex flex-col gap-4 border-t border-second/30 pt-4">
                <h3 className="text-sm font-semibold text-second">
                  Item yang akan dihapus
                </h3>

                <ul className="flex flex-col gap-2">
                  {removedItems.map((original) => (
                    <li
                      key={original.camera_id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-second/30 p-4"
                    >
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-second/60 line-through">
                          {original.name}
                        </p>
                        <p className="mt-2 text-xs tabular-nums text-second/60">
                          Semula {original.originalQuantity} unit
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => restoreItem(original)}
                        disabled={isSaving || items.length >= MAX_ITEMS}
                        className={`${BTN_BASE} shrink-0 border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                      >
                        <FiRotateCcw size={16} aria-hidden="true" />
                        Kembalikan
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </FormSection>

          <FormSection
            title="Tambah kamera"
            description="Cari kamera lalu tambahkan ke order. Stok tidak dicek di sini, tetapi dicek saat order dilunasi."
          >
            <div className="relative">
              <FiSearch
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-second/40"
              />
              <input
                type="search"
                name="camera_search"
                aria-label="Cari kamera"
                autoComplete="off"
                spellCheck={false}
                value={cameraSearch}
                onChange={(event) => setCameraSearch(event.target.value)}
                placeholder="Cari nama kamera atau 4 digit terakhir SKU…"
                className={`${inputClass(false)} pl-8`}
                disabled={isSaving}
              />
            </div>

            {isLoadingCameras ? (
              <div
                className="flex items-center justify-center gap-4 py-16 text-sm text-second/60"
                role="status"
              >
                <FiLoader
                  className="animate-spin motion-reduce:animate-none"
                  size={16}
                  aria-hidden="true"
                />
                Memuat daftar kamera…
              </div>
            ) : isCameraError ? (
              <div
                role="alert"
                className="flex flex-col items-start gap-4 rounded-xl border border-second2/30 bg-second2/5 p-4"
              >
                <p className="text-sm font-medium text-second2">
                  Gagal memuat daftar kamera.
                </p>
                <button
                  type="button"
                  onClick={() => refetchCameras()}
                  disabled={isFetchingCameras}
                  className={`${BTN_BASE} bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
                >
                  Coba lagi
                </button>
              </div>
            ) : cameras.length === 0 ? (
              <p className="rounded-xl bg-second/5 p-4 text-sm text-second/60">
                Tidak ada kamera yang cocok dengan pencarian.
              </p>
            ) : (
              <ul
                className={`flex max-h-80 flex-col gap-2 overflow-y-auto transition-opacity ${
                  isFetchingCameras ? "opacity-60" : "opacity-100"
                }`}
              >
                {cameras.map((camera) => {
                  const isSelected = selectedIds.has(camera.id);
                  const price = Number(camera.price);
                  const validPrice = Number.isFinite(price) && price >= 0;

                  return (
                    <li
                      key={camera.id}
                      className={`flex flex-col gap-4 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                        isSelected
                          ? "border-second4 bg-second4/5"
                          : "border-second/30"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-second">
                          {camera.name}
                        </p>
                        <p className="mt-2 text-sm tabular-nums text-second/60">
                          {validPrice
                            ? formatPrice(price)
                            : "Harga tidak tersedia"}
                          {Number.isFinite(Number(camera.stock)) &&
                            ` · Stok ${formatNumber(Number(camera.stock))}`}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => addCamera(camera)}
                        disabled={
                          isSaving ||
                          isSelected ||
                          items.length >= MAX_ITEMS ||
                          !validPrice
                        }
                        className={`${BTN_BASE} shrink-0 border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                      >
                        {isSelected ? (
                          <>
                            <FiCheck size={16} aria-hidden="true" />
                            Ditambahkan
                          </>
                        ) : (
                          <>
                            <FiPlus size={16} aria-hidden="true" />
                            Tambahkan
                          </>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </FormSection>
        </div>

        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-16 xl:-mt-4 xl:pt-4">
          <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
            <h2 className="text-lg font-bold text-second">Ringkasan</h2>

            <dl className="divide-y divide-second/10 border-y border-second/30">
              <SummaryRow label="Subtotal semula">
                {formatPrice(order.subtotal)}
              </SummaryRow>
              <SummaryRow label="Subtotal baru">
                {formatPrice(newSubtotal)}
              </SummaryRow>
              <SummaryRow label="Diskon toko">
                {storeDiscount > 0 ? `- ${formatPrice(storeDiscount)}` : "—"}
              </SummaryRow>
              <SummaryRow label="Diskon pelanggan">
                {customerDiscount > 0
                  ? `- ${formatPrice(customerDiscount)}`
                  : "—"}
              </SummaryRow>
              <SummaryRow label="Total semula">
                {formatPrice(oldTotal)}
              </SummaryRow>
              <SummaryRow label="Estimasi total baru">
                <span className="flex flex-col items-end gap-2">
                  <span>{formatPrice(estimatedTotal)}</span>
                  {discountLiveError && (
                    <Tag tone="failure">Diskon melebihi total</Tag>
                  )}
                  {!discountLiveError && isDirty && difference !== 0 && (
                    <Tag tone="outline">
                      {difference > 0 ? "+" : "-"}
                      {formatPrice(Math.abs(difference))}
                    </Tag>
                  )}
                </span>
              </SummaryRow>
            </dl>

            <p className="text-xs text-second/50">
              Preview saja. Server tetap menghitung ulang total order dan
              invoice.
            </p>
          </section>

          <section className="flex flex-col gap-4 rounded-2xl border border-second4/30 bg-second4/5 p-4 text-sm text-second4">
            <p className="flex items-start gap-2">
              <FiInfo
                size={16}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              Stok kamera tidak berubah di sini. Stok dicek dan dipotong saat
              order ditandai lunas.
            </p>

            {invoice?.is_final && (
              <p className="flex items-start gap-2">
                <FiInfo
                  size={16}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                Invoice sudah final dan tetap final, tetapi isinya ikut berubah.
                PDF yang sudah pernah dikirim tidak ikut berubah, jadi unduh dan
                kirim ulang.
              </p>
            )}
          </section>

          <div className="flex flex-col gap-2">
            <PrimaryButton
              type="submit"
              disabled={isSaving || !isDirty}
              ariaBusy={isSaving}
            >
              {isSaving ? (
                <>
                  <FiLoader
                    className="animate-spin motion-reduce:animate-none"
                    size={16}
                    aria-hidden="true"
                  />
                  Menyimpan perubahan…
                </>
              ) : (
                "Simpan perubahan"
              )}
            </PrimaryButton>

            <CancelButton
              href={ORDER_DETAIL_PATH(order.id)}
              disabled={isSaving}
            >
              Batal
            </CancelButton>
          </div>
        </aside>
      </form>
    </div>
  );
}
