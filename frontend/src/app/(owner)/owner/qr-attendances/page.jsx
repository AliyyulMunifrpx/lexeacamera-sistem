"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Image from "next/image.js";
import {
  FiArrowUpRight,
  FiCheck,
  FiClock,
  FiCopy,
  FiExternalLink,
  FiGrid,
  FiPrinter,
  FiRefreshCw,
  FiUsers,
} from "react-icons/fi";

import { useGetStore } from "../../../features/store/hooks.js";
import notify from "../../../../lib/notify.js";
import PrimaryButton from "../../../../components/primary-button.jsx";

/* -------------------------------------------------------------------------- */
/*  Design rules (SAMAKAN DENGAN INVOICE)                                     */
/* -------------------------------------------------------------------------- */

const ATTENDANCE_PATH = "/employee/attendances";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition touch-manipulation";

const STEPS = [
  "Buka kamera ponsel dan arahkan ke QR code.",
  "Ketuk tautan yang muncul. Masuk ke akun karyawan jika diminta.",
  "Tekan tombol absen masuk saat datang dan absen pulang saat selesai.",
];

const PRINT_TIPS = [
  "Cetak di kertas A4 portrait, tanpa skala tambahan.",
  "Aktifkan “Background graphics” agar warna ikut tercetak.",
  "Pasang di dekat pintu masuk, terang, dan setinggi pandangan mata.",
];

export default function AttendanceQRCodePage() {
  const [attendanceUrl, setAttendanceUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: store, isFetching, refetch } = useGetStore();

  useEffect(() => {
    setAttendanceUrl(`${window.location.origin}${ATTENDANCE_PATH}`);
  }, []);

  function handlePrint() {
    window.print();
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(attendanceUrl);
      setCopied(true);
      notify.success("Tautan absen disalin.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      notify.error("Gagal menyalin ke clipboard.");
    }
  }

  const storeName = store?.name || "Toko Kami";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col gap-8 bg-primary pb-16">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }

          body * {
            visibility: hidden !important;
          }

          #qr-print-area,
          #qr-print-area * {
            visibility: visible !important;
          }

          #qr-print-area {
            position: fixed !important;
            inset: 0 !important;
            z-index: 99999 !important;
            display: flex !important;
            width: 100% !important;
            height: 100% !important;
            max-width: none !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            color: #000000 !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          #qr-print-area .qr-print-card {
            width: 100% !important;
            max-width: 150mm !important;
            padding: 16mm !important;
            border: 1px solid rgba(0, 0, 0, 0.15) !important;
            border-radius: 6mm !important;
            background: #ffffff !important;
            box-shadow: none !important;
            color: #000000 !important;
          }

          #qr-print-area .qr-code-frame {
            width: 78mm !important;
            height: 78mm !important;
            padding: 5mm !important;
            border: 1px solid rgba(0, 0, 0, 0.15) !important;
            border-radius: 4mm !important;
            background: #ffffff !important;
          }

          #qr-print-area .qr-code-frame svg {
            width: 100% !important;
            height: 100% !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header */}
      <header className="no-print flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
          >
            <FiGrid size={16} />
          </div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold tracking-tight text-second sm:text-3xl">
              QR <span className="text-grad">Absen</span>
            </h1>
            <p className="mt-2 text-pretty text-sm text-second/60">
              QR code untuk karyawan membuka halaman absen dengan cepat.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Perbarui data toko"
            className={`${BTN_BASE} w-full border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${FOCUS_RING}`}
          >
            <FiRefreshCw
              size={16}
              className={
                isFetching ? "animate-spin motion-reduce:animate-none" : ""
              }
              aria-hidden="true"
            />
            {isFetching ? "Memperbarui…" : "Perbarui"}
          </button>

          <PrimaryButton
            type="button"
            onClick={handlePrint}
            disabled={!attendanceUrl}
          >
            <FiPrinter size={16} aria-hidden="true" />
            Cetak QR Code
          </PrimaryButton>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        {/* ============ Poster (area cetak) ============ */}
        <div className="flex justify-center">
          <section
            id="qr-print-area"
            aria-label="Pratinjau poster QR absen"
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-second/30 bg-primary text-second shadow-xl shadow-second/5"
          >
            <div className="qr-print-card relative flex flex-col items-center overflow-hidden px-4 pb-8 pt-8 text-center sm:px-8 sm:pb-8">
              {/* Ornamen */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-2 bg-grad"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-8 -top-8 size-16 rounded-full bg-grad opacity-20"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-8 -left-8 size-16 rounded-full bg-grad opacity-20"
              />

              {/* Identitas toko */}
              <div className="relative flex items-center gap-4">
                <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-second/30 bg-grad text-primary shadow-lg shadow-second4/20">
                  {store?.logo_url ? (
                    <Image
                      src={store.logo_url}
                      alt={`Logo ${storeName}`}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <FiUsers size={24} aria-hidden="true" />
                  )}
                </div>

                <div className="min-w-0 text-left">
                  <p className="text-xs font-semibold uppercase tracking-widest text-second/60">
                    Absensi karyawan
                  </p>
                  <p className="mt-2 truncate text-base font-bold">
                    {storeName}
                  </p>
                </div>
              </div>

              {/* Judul */}
              <div className="relative my-8 flex flex-col gap-2">
                <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                  Datang, scan,
                  <br />
                  langsung absen.
                </h2>

                <p className="mx-auto max-w-xs text-sm leading-relaxed text-second/60">
                  Pindai QR code untuk absen masuk dan pulang.
                </p>

                <div
                  aria-hidden="true"
                  className="mx-auto mt-2 h-2 w-16 rounded-full bg-grad"
                />
              </div>

              {/* QR */}
              <div className="qr-code-frame relative flex aspect-square w-full max-w-[320px] items-center justify-center rounded-xl border border-second/30 bg-primary p-4 sm:max-w-[340px]">
                {attendanceUrl ? (
                  <QRCodeSVG
                    value={attendanceUrl}
                    size={320}
                    level="H"
                    marginSize={3}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    title="QR Code halaman absen karyawan"
                    className="h-full w-full"
                  />
                ) : (
                  <p
                    role="status"
                    className="animate-pulse text-sm text-second/60"
                  >
                    Membuat QR code…
                  </p>
                )}
              </div>

              <div className="relative mt-8 flex items-center gap-2 rounded-full border border-second/30 px-4 py-2">
                <FiClock size={14} aria-hidden="true" />
                <p className="text-xs font-semibold tracking-wide">
                  SCAN · MASUK · PULANG
                </p>
              </div>

              <div className="relative mt-8 w-full border-t border-dashed border-second/20 pt-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-second/50">
                  Atau buka alamat
                </p>

                <p className="mt-2 break-all text-sm font-medium">
                  {attendanceUrl || "Menyiapkan alamat…"}
                </p>

                <p className="mt-2 flex items-center justify-center gap-2 text-xs text-second/60">
                  Scan dengan kamera ponsel
                  <FiArrowUpRight size={14} aria-hidden="true" />
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* ============ Panel samping ============ */}
        <aside className="no-print flex min-w-0 flex-col gap-4 lg:sticky lg:top-16">
          <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
            <div className="flex items-start gap-4">
              <div
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-primary shadow-lg shadow-second4/20"
              >
                <FiUsers size={16} />
              </div>

              <div className="min-w-0">
                <h2 className="text-lg font-bold text-second">
                  Siap dicetak dan dipajang
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-second/60">
                  Letakkan di area yang mudah dijangkau karyawan saat datang dan
                  pulang.
                </p>
              </div>
            </div>

            <div className="border-t border-second/30 pt-4">
              <p className="text-xs text-second/60">Alamat tujuan</p>
              <p className="mt-2 break-all text-sm font-semibold text-second">
                {attendanceUrl || "Menyiapkan alamat…"}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!attendanceUrl}
                  className={`${BTN_BASE} border border-second/30 text-second hover:border-second4 hover:text-second4 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
                >
                  {copied ? (
                    <FiCheck size={16} aria-hidden="true" />
                  ) : (
                    <FiCopy size={16} aria-hidden="true" />
                  )}
                  {copied ? "Tersalin" : "Salin tautan"}
                </button>

                <a
                  href={attendanceUrl || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!attendanceUrl}
                  className={`${BTN_BASE} border border-second/30 text-second hover:border-second4 hover:text-second4 ${
                    !attendanceUrl ? "pointer-events-none opacity-50" : ""
                  } ${FOCUS_RING}`}
                >
                  <FiExternalLink size={16} aria-hidden="true" />
                  Buka halaman absen
                  <span className="sr-only">(tab baru)</span>
                </a>
              </div>
            </div>
          </section>

          <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
            <h2 className="text-lg font-bold text-second">
              Cara karyawan absen
            </h2>

            <ol className="flex flex-col gap-4">
              {STEPS.map((step, index) => (
                <li key={step} className="flex items-start gap-4">
                  <span
                    aria-hidden="true"
                    className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-grad text-xs font-bold tabular-nums text-primary shadow-lg shadow-second4/20"
                  >
                    {index + 1}
                  </span>
                  <span className="text-sm leading-relaxed text-second/70">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-second/30 bg-primary p-4 shadow-xl shadow-second/5 sm:p-8">
            <h2 className="text-lg font-bold text-second">Tips mencetak</h2>

            <ul className="flex flex-col gap-4">
              {PRINT_TIPS.map((tip) => (
                <li key={tip} className="flex items-start gap-4">
                  <span
                    aria-hidden="true"
                    className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-second/10 text-second"
                  >
                    <FiCheck size={16} />
                  </span>
                  <span className="text-sm leading-relaxed text-second/70">
                    {tip}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
