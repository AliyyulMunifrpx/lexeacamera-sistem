"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image.js";
import Link from "next/link.js";
import { useRouter } from "next/navigation.js";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiImage,
  FiLoader,
  FiShoppingBag,
  FiUploadCloud,
} from "react-icons/fi";
import { IoSearchSharp } from "react-icons/io5";

import {
  useGetStore,
  useUpdateStore,
} from "../../../../features/store/hooks.js";
import { useGetHome } from "../../../../features/public/hooks.js";

import BannerCropModal from "../../../../../components/owner/banner-crop-modal.jsx";
import BannerCarousel from "../../../../../components/public/home/banner-carousel.jsx";
import CameraCard from "../../../../../components/public/home/camera-card.jsx";

import { normalizeApiError } from "../../../../../lib/api/errors.js";
import notify from "../../../../../lib/notify.js";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/*  Spacing : only 2, 4, 8, 16                                                */
/*  Color   : primary + second (+ second2 error, second3 sukses, second4 fokus) */
/* -------------------------------------------------------------------------- */

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

const TEXT_FIELDS = [
  "name",
  "terms_and_condition",
  "instagram",
  "whatsapp",
  "tiktok",
  "facebook",
  "address",
  "map_url",
];

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

const labelClass = "mb-2 block text-sm font-semibold text-second";

const INITIAL_VALUES = {
  name: "",
  terms_and_condition: "",
  instagram: "",
  whatsapp: "",
  tiktok: "",
  facebook: "",
  address: "",
  map_url: "",
};

const CONTACT_FIELDS = [
  { name: "instagram", label: "Instagram", placeholder: "@namatoko" },
  { name: "whatsapp", label: "WhatsApp", placeholder: "6281234567890" },
  { name: "tiktok", label: "TikTok", placeholder: "@namatoko" },
  {
    name: "facebook",
    label: "Shopee",
    placeholder: "Link toko di shopee",
  },
];

/* ------------------------------ Helpers ---------------------------------- */

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

function getStoreValues(store) {
  return {
    name: store.name ?? "",
    terms_and_condition: store.terms_and_condition ?? "",
    instagram: store.instagram ?? "",
    whatsapp: store.whatsapp ?? "",
    tiktok: store.tiktok ?? "",
    facebook: store.facebook ?? "",
    address: store.address ?? "",
    map_url: store.map_url ?? "",
  };
}

function validateImage(file) {
  if (!file) return "";
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Format gambar harus PNG, JPEG, atau WebP.";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "Ukuran gambar maksimal 5 MB.";
  }
  return "";
}

/* ------------------------------ Small pieces ----------------------------- */

function Tag({ children, tone = "outline" }) {
  const tones = {
    outline: "border border-second/20 text-second/60",
    strong: "border border-second4 text-second4",
    soft: "bg-second/10 text-second",
    solid: "bg-second text-primary",
    grad: "bg-grad text-primary",
    failure: "bg-second2 text-primary",
    success: "bg-second3/10 text-second3",
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
      className="mt-2 flex items-start gap-2 text-sm text-second2"
    >
      <FiAlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

function FormSection({ title, description, aside, children }) {
  return (
    <section className="flex min-w-0 scroll-mt-16 flex-col gap-8 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
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

function FieldGrid({ children }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
  );
}

function FormField({ label, htmlFor, required, children, description, error }) {
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

/* --------------------------- Loading & error ---------------------------- */

function LoadingState() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        <div className="h-8 w-48 animate-pulse rounded-full bg-second/10" />
        <div className="flex items-center gap-4">
          <div className="size-8 shrink-0 animate-pulse rounded-xl bg-second/10" />
          <div className="min-w-0 space-y-2">
            <div className="h-8 w-64 animate-pulse rounded-lg bg-second/10" />
            <div className="h-4 w-80 animate-pulse rounded bg-second/10" />
          </div>
        </div>
      </header>
      <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-8 xl:col-span-2">
          <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
          <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
          <div className="h-64 animate-pulse rounded-2xl bg-second/10" />
        </div>
        <div className="h-[34rem] animate-pulse rounded-2xl bg-second/10" />
      </div>
    </div>
  );
}

function ErrorState({ onRetry, isFetching }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header>
        <Link
          href="/owner/store"
          className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke profil toko
        </Link>
      </header>
      <div className="flex flex-col items-center justify-center rounded-2xl border border-second2/30 bg-second2/5 px-4 py-16 text-center">
        <FiAlertCircle size={32} className="text-second2" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-bold text-second">
          Gagal memuat profil toko
        </h2>
        <p className="mt-2 max-w-md text-sm text-second/60">
          Periksa koneksi atau sesi Anda, kemudian coba kembali.
        </p>
        <button
          type="button"
          onClick={onRetry}
          disabled={isFetching}
          className={`${BTN_BASE} mt-4 bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
        >
          {isFetching ? (
            <>
              <FiLoader
                className="animate-spin motion-reduce:animate-none"
                size={16}
                aria-hidden="true"
              />
              Memuat…
            </>
          ) : (
            "Coba lagi"
          )}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------- Image field -------------------------------- */

function ImageField({
  label,
  currentImage,
  preview,
  file,
  error,
  onChange,
  disabled,
  isLogo = false,
}) {
  const labelId = `${label.replace(/\s+/g, "-").toLowerCase()}-label`;
  const errorId = `${labelId}-error`;
  const src = preview || currentImage;

  return (
    <div className="min-w-0">
      <p id={labelId} className={labelClass}>
        {label}
      </p>

      <div
        className={`flex items-center justify-center overflow-hidden rounded-xl border border-second/30 bg-second/[0.03] p-3 ${
          isLogo ? "aspect-square max-w-56" : "aspect-[3/1]"
        }`}
      >
        {src ? (
          <Image
            src={src}
            alt={`Pratinjau ${label.toLowerCase()}`}
            width={isLogo ? 512 : 3000}
            height={isLogo ? 512 : 1000}
            unoptimized
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-center text-second/40">
            <FiImage size={28} aria-hidden="true" />
            <span className="text-xs">
              {isLogo ? "Logo belum tersedia" : "Banner belum tersedia"}
            </span>
          </div>
        )}
      </div>

      <label
        className={`mt-4 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-second/30 px-4 py-2 text-sm font-semibold text-second transition-colors hover:border-second4 hover:text-second4 focus-within:ring-4 focus-within:ring-second4/15 ${
          isLogo ? "max-w-56" : ""
        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        <FiUploadCloud size={16} aria-hidden="true" />
        {file ? "Pilih gambar lain" : "Ganti gambar"}

        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={disabled}
          onChange={onChange}
          aria-labelledby={labelId}
          aria-describedby={error ? errorId : undefined}
          className="sr-only"
        />
      </label>

      <p className="mt-2 text-xs leading-relaxed text-second/55">
        PNG, JPEG, atau WebP. Maksimal 5 MB.
        {isLogo
          ? " Gambar diperkecil oleh server hingga 512 × 512 piksel."
          : " Crop gambar ke rasio 16:9 sebelum diunggah. Server memperkecil banner hingga 1920 × 1080 piksel."}
      </p>

      {file && (
        <p className="mt-2 flex items-center gap-2 break-all text-xs text-second3">
          <FiCheck size={13} className="shrink-0" aria-hidden="true" />
          <span className="tabular-nums">
            {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB
          </span>
        </p>
      )}

      {error && <ErrorText id={errorId}>{error}</ErrorText>}
    </div>
  );
}

/* -------------------- Pratinjau tampilan publik -------------------------- */

const PREVIEW_PRODUCT_COUNT = 4;

function PreviewSkeleton() {
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="aspect-square w-full animate-pulse rounded-lg bg-second/10" />
      <div className="h-4 w-3/4 animate-pulse rounded bg-second/10" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-second/10" />
    </div>
  );
}

/* Meniru beranda publik versi mobile: navbar, banner utama, carousel, produk. */
function StorePreview({ name, logoSrc, bannerSrc }) {
  const screenRef = useRef(null);
  const displayName = name.trim() || "Nama toko";

  const { data: homeData, isLoading } = useGetHome();

  const cameras = useMemo(
    () => (homeData?.cameras ?? []).slice(0, PREVIEW_PRODUCT_COUNT),
    [homeData],
  );

  // Aturan yang sama dengan halaman beranda.
  const slides = useMemo(() => {
    const promo = homeData?.promo_cameras ?? [];
    const bestSelling = homeData?.best_selling_cameras ?? [];

    return (homeData?.banners ?? []).flatMap((banner) => {
      if (banner.is_promo) {
        return promo.length > 0 ? [{ banner, products: promo }] : [];
      }
      if (banner.is_best_seller) {
        return bestSelling.length > 0
          ? [{ banner, products: bestSelling }]
          : [];
      }
      return [{ banner, products: [] }];
    });
  }, [homeData]);

  const slidesKey = slides.map((slide) => slide.banner.id).join("|");

  useEffect(() => {
    screenRef.current?.setAttribute("inert", "");
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-second">
          Pratinjau tampilan publik
        </h2>
        <Tag tone="strong">Langsung</Tag>
      </div>

      <p className="sr-only">
        Pratinjau beranda toko versi mobile seperti yang dilihat pengunjung.
        Hanya tampilan, tidak bisa diklik.
      </p>

      {/* Bezel ponsel */}
      <div className="rounded-4xl bg-second/10  shadow-xl border-10 border-second">
        <div
          ref={screenRef}
          aria-hidden="true"
          className="pointer-events-none max-h-[44rem] cursor-default select-none overflow-hidden rounded-3xl bg-second/10"
        >
          {/* Navbar (versi statis dari navbar mobile) */}
          <div className="flex h-16 items-center justify-between gap-2 bg-primary px-4">
            <div className="flex min-w-0 items-center gap-2">
              <div className="relative aspect-square h-8 shrink-0 overflow-hidden rounded-full bg-second/10">
                {logoSrc && (
                  <Image
                    src={logoSrc}
                    alt=""
                    fill
                    unoptimized
                    className="h-full w-full rounded-full object-cover"
                  />
                )}
              </div>
              <h2 className="truncate text-3xl font-bold text-grad">
                {displayName}
              </h2>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <IoSearchSharp className="h-8 w-8 text-second" />
              <div className="flex size-8 flex-col items-center justify-center gap-1.5">
                <span className="block h-0.5 w-6 rounded-full bg-second" />
                <span className="block h-0.5 w-6 rounded-full bg-second" />
                <span className="block h-0.5 w-6 rounded-full bg-second" />
              </div>
            </div>
          </div>

          {/* Isi beranda */}
          <div className="flex flex-col gap-4 px-4 pb-4 pt-4">
            {/* Banner utama */}
            <div className="relative aspect-[3/1] w-full overflow-hidden rounded-xl bg-second/10">
              {bannerSrc ? (
                <Image
                  src={bannerSrc}
                  alt=""
                  fill
                  unoptimized
                  sizes="384px"
                  className="rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-second/40">
                  Banner belum tersedia
                </div>
              )}
            </div>

            {/* Carousel banner */}
            {slides.length > 0 && (
              <BannerCarousel key={slidesKey} slides={slides} />
            )}

            <p className="py-4 text-xl text-second">
              Rekomendasi <span className="font-bold text-grad">Untukmu</span>
            </p>

            {isLoading ? (
              <div className="grid w-full grid-cols-2 gap-2">
                {Array.from({ length: PREVIEW_PRODUCT_COUNT }, (_, index) => (
                  <PreviewSkeleton key={index} />
                ))}
              </div>
            ) : cameras.length === 0 ? (
              <p className="py-10 text-center text-sm text-second/50">
                Belum ada produk.
              </p>
            ) : (
              <div className="grid w-full grid-cols-2 gap-2">
                {cameras.map((item) => (
                  <CameraCard key={item.id} data={item} />
                ))}
              </div>
            )}

            <div className="my-4 w-full rounded-full bg-grad py-2 text-center font-bold text-primary">
              Lihat Produk Lengkap
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-second/50">
        Pratinjau beranda versi mobile. Nama, logo, dan banner utama mengikuti
        formulir secara langsung (termasuk gambar yang belum disimpan). Carousel
        dan produk memakai data toko saat ini, dan hanya sebagian beranda yang
        ditampilkan.
      </p>
    </div>
  );
}

/* ---------------------------------- Page --------------------------------- */

export default function EditStorePage() {
  const router = useRouter();

  const {
    data: store,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useGetStore();

  const updateMutation = useUpdateStore();

  const [values, setValues] = useState(INITIAL_VALUES);
  const [initialValues, setInitialValues] = useState(null);

  const [logo, setLogo] = useState(null);
  const [mainBanner, setMainBanner] = useState(null);

  const [logoPreview, setLogoPreview] = useState("");
  const [bannerPreview, setBannerPreview] = useState("");

  const [logoError, setLogoError] = useState("");
  const [bannerError, setBannerError] = useState("");
  const [formError, setFormError] = useState("");
  const [removeMainBanner, setRemoveMainBanner] = useState(false);

  const [bannerToCrop, setBannerToCrop] = useState(null);

  const isStoreNotFound =
    isError && error?.response?.data?.errors === "STORE_NOT_FOUND";

  const hasChanges = initialValues
    ? TEXT_FIELDS.some(
        (field) =>
          (values[field] ?? "").trim() !== (initialValues[field] ?? "").trim(),
      ) ||
      Boolean(logo) ||
      Boolean(mainBanner) ||
      removeMainBanner
    : false;

  useEffect(() => {
    if (!store) return;
    const nextValues = getStoreValues(store);
    setValues(nextValues);
    setInitialValues(nextValues);
    setLogo(null);
    setMainBanner(null);
    setLogoError("");
    setBannerError("");
    setFormError("");
    setRemoveMainBanner(false);
  }, [store]);

  useEffect(() => {
    if (isStoreNotFound) {
      router.replace("/owner/store");
    }
  }, [isStoreNotFound, router]);

  useEffect(() => {
    if (isError && !isStoreNotFound) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }, [isError, error, isStoreNotFound]);

  useEffect(() => {
    if (!hasChanges) return;
    function handleBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  useEffect(() => {
    if (!logo) {
      setLogoPreview("");
      return;
    }
    const objectUrl = URL.createObjectURL(logo);
    setLogoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [logo]);

  useEffect(() => {
    if (!mainBanner) {
      setBannerPreview("");
      return;
    }
    const objectUrl = URL.createObjectURL(mainBanner);
    setBannerPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [mainBanner]);

  useEffect(() => {
    const sourceUrl = bannerToCrop?.src;
    if (!sourceUrl) return;
    return () => URL.revokeObjectURL(sourceUrl);
  }, [bannerToCrop?.src]);

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setFormError("");
  }

  function handleLogoChange(event) {
    const selectedFile = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!selectedFile) return;
    const validationError = validateImage(selectedFile);
    if (validationError) {
      setLogoError(validationError);
      return;
    }
    setLogo(selectedFile);
    setLogoError("");
    setFormError("");
  }

  function handleBannerSelect(event) {
    const selectedFile = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!selectedFile) return;
    const validationError = validateImage(selectedFile);
    if (validationError) {
      setBannerError(validationError);
      return;
    }
    setBannerError("");
    setFormError("");
    setBannerToCrop({
      file: selectedFile,
      src: URL.createObjectURL(selectedFile),
    });
  }

  function handleBannerCrop(croppedFile) {
    const validationError = validateImage(croppedFile);
    if (validationError) {
      setBannerError(validationError);
      return;
    }
    setMainBanner(croppedFile);
    setBannerError("");
    setFormError("");
    setRemoveMainBanner(false);
    setBannerToCrop(null);
  }

  function handleCancelCrop() {
    setBannerToCrop(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    if (!store || !initialValues) return;

    const name = values.name.trim();
    const terms = values.terms_and_condition.trim();

    if (!name || !terms) {
      setFormError("Nama toko dan syarat dan ketentuan tidak boleh kosong.");
      return;
    }

    const invalidLogo = validateImage(logo);
    if (invalidLogo) {
      setLogoError(invalidLogo);
      return;
    }

    const invalidBanner = validateImage(mainBanner);
    if (invalidBanner) {
      setBannerError(invalidBanner);
      return;
    }

    if (removeMainBanner && mainBanner) {
      setFormError(
        "Banner tidak bisa diganti dan dihapus dalam satu permintaan.",
      );
      return;
    }

    const formData = new FormData();
    let changes = 0;

    for (const field of TEXT_FIELDS) {
      const currentValue = values[field].trim();
      const originalValue = (initialValues[field] ?? "").trim();
      if (currentValue !== originalValue) {
        formData.append(field, currentValue);
        changes += 1;
      }
    }

    if (logo) {
      formData.append("logo", logo);
      changes += 1;
    }

    if (mainBanner) {
      formData.append("main_banner", mainBanner);
      changes += 1;
    } else if (removeMainBanner) {
      formData.append("remove_main_banner", "true");
      changes += 1;
    }

    if (changes === 0) {
      setFormError("Belum ada perubahan yang perlu disimpan.");
      return;
    }

    try {
      await updateMutation.mutateAsync(formData);
      notify.success("Profil toko berhasil diperbarui.");
      router.replace("/owner/store");
    } catch (error) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }

  if (isLoading || isStoreNotFound || (store && !initialValues)) {
    return <LoadingState />;
  }

  if (isError && !store) {
    return <ErrorState onRetry={() => refetch()} isFetching={isFetching} />;
  }

  if (!store || !initialValues) {
    return <LoadingState />;
  }

  const isSaving = updateMutation.isPending;
  const currentBanner = removeMainBanner ? null : store.main_banner_url;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <header className="flex flex-col gap-4">
        <Link
          href="/owner/store"
          className={`inline-flex h-8 w-fit items-center gap-2 rounded-full pr-4 text-sm font-medium text-second/60 transition-colors hover:text-second4 touch-manipulation ${FOCUS_RING}`}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Kembali ke profil toko
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
              Ubah <span className="text-grad">profil toko</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              Perbarui informasi dan gambar toko. Field yang tidak diubah akan
              tetap menggunakan data sebelumnya.
            </p>
          </div>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 items-start gap-8 xl:grid-cols-3"
      >
        <div className="flex min-w-0 flex-col gap-8 xl:col-span-2">
          {/* Gambar Toko */}
          <FormSection
            title="Gambar toko"
            description="Pilih gambar hanya jika ingin mengganti gambar saat ini."
            aside={
              hasChanges ? (
                <Tag tone="strong">Ada perubahan</Tag>
              ) : (
                <Tag>Belum ada perubahan</Tag>
              )
            }
          >
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
              <ImageField
                label="Logo Toko"
                currentImage={store.logo_url}
                preview={logoPreview}
                file={logo}
                error={logoError}
                disabled={isSaving}
                isLogo
                onChange={handleLogoChange}
              />

              <div className="min-w-0">
                <ImageField
                  label="Banner Utama"
                  currentImage={currentBanner}
                  preview={bannerPreview}
                  file={mainBanner}
                  error={bannerError}
                  disabled={isSaving}
                  onChange={handleBannerSelect}
                />

                {store.main_banner_url && !mainBanner && (
                  <label
                    className={`mt-4 flex cursor-pointer items-start gap-4 rounded-xl border p-4 text-sm transition-colors focus-within:ring-4 focus-within:ring-second4/15 ${
                      removeMainBanner
                        ? "border-second2/40 bg-second2/5"
                        : "border-second/30 hover:border-second/30"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={removeMainBanner}
                      disabled={isSaving}
                      onChange={(event) => {
                        setRemoveMainBanner(event.target.checked);
                        setFormError("");
                      }}
                      className={`mt-1 size-4 accent-second2 ${FOCUS_RING}`}
                    />

                    <span className="min-w-0">
                      <span className="block font-semibold text-second">
                        Hapus banner utama
                      </span>
                      <span className="mt-2 block text-sm text-second/60">
                        Banner akan dihapus saat perubahan disimpan.
                      </span>
                    </span>
                  </label>
                )}
              </div>
            </div>
          </FormSection>

          {/* Informasi Umum */}
          <FormSection
            title="Informasi umum"
            description="Nama toko dan syarat dan ketentuan."
          >
            <FormField label="Nama Toko" htmlFor="store-name" required>
              <input
                id="store-name"
                name="name"
                value={values.name}
                onChange={handleChange}
                maxLength={100}
                disabled={isSaving}
                className={inputClass(false)}
                placeholder="Nama toko…"
              />
            </FormField>

            <FormField
              label="Syarat dan Ketentuan"
              htmlFor="store-terms"
              required
            >
              <textarea
                id="store-terms"
                name="terms_and_condition"
                value={values.terms_and_condition}
                onChange={handleChange}
                maxLength={3000}
                rows={7}
                disabled={isSaving}
                className={`${inputClass(false)} resize-y`}
                placeholder="Tulis syarat dan ketentuan toko…"
              />
              <p className="mt-2 text-right text-xs tabular-nums text-second/50">
                {values.terms_and_condition.length}/3000
              </p>
            </FormField>
          </FormSection>

          {/* Informasi Kontak */}
          <FormSection
            title="Informasi kontak"
            description="Kosongkan field untuk menghapus informasi kontak yang tersimpan."
          >
            <FieldGrid>
              {CONTACT_FIELDS.map((field) => (
                <FormField
                  key={field.name}
                  label={field.label}
                  htmlFor={`store-${field.name}`}
                >
                  <input
                    id={`store-${field.name}`}
                    name={field.name}
                    value={values[field.name]}
                    onChange={handleChange}
                    maxLength={100}
                    disabled={isSaving}
                    placeholder={field.placeholder}
                    inputMode={field.name === "whatsapp" ? "tel" : undefined}
                    className={inputClass(false)}
                  />
                </FormField>
              ))}
            </FieldGrid>

            <FormField label="Alamat Toko" htmlFor="store-address">
              <textarea
                id="store-address"
                name="address"
                value={values.address}
                onChange={handleChange}
                maxLength={255}
                rows={3}
                disabled={isSaving}
                className={`${inputClass(false)} resize-y`}
                placeholder="Masukkan alamat toko…"
              />
            </FormField>

            <FormField label="Link Google Maps" htmlFor="store-map-url">
              <input
                id="store-map-url"
                name="map_url"
                type="url"
                value={values.map_url}
                onChange={handleChange}
                maxLength={500}
                disabled={isSaving}
                className={inputClass(false)}
                placeholder="https://maps.app.goo.gl/…"
              />
            </FormField>
          </FormSection>

          {formError && (
            <div className="flex items-start gap-2 rounded-xl border border-second2/30 bg-second2/5 px-4 py-3 text-sm text-second2">
              <FiAlertCircle
                className="mt-0.5 shrink-0"
                size={16}
                aria-hidden="true"
              />
              <p role="alert">{formError}</p>
            </div>
          )}
        </div>

        {/* Sidebar sticky */}
        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-16 xl:-mt-4 xl:pt-4">
          <StorePreview
            name={values.name}
            logoSrc={logoPreview || store.logo_url}
            bannerSrc={bannerPreview || currentBanner}
          />

          <div className="flex flex-col gap-2">
            <button
              type="submit"
              disabled={isSaving || Boolean(bannerToCrop) || !hasChanges}
              aria-busy={isSaving}
              className={`${BTN_BASE} w-full bg-grad text-primary shadow-lg shadow-second4/25 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
            >
              {isSaving ? (
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
                  <FiCheck size={16} aria-hidden="true" />
                  Simpan Perubahan
                </>
              )}
            </button>

            <Link
              href="/owner/store"
              aria-disabled={isSaving}
              tabIndex={isSaving ? -1 : undefined}
              className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second2 hover:text-second2 ${FOCUS_RING} ${
                isSaving ? "pointer-events-none opacity-50" : ""
              }`}
            >
              Batal
            </Link>
          </div>
        </aside>
      </form>

      {bannerToCrop && (
        <BannerCropModal
          imageSrc={bannerToCrop.src}
          sourceFile={bannerToCrop.file}
          onCancel={handleCancelCrop}
          onConfirm={handleBannerCrop}
        />
      )}
    </div>
  );
}
