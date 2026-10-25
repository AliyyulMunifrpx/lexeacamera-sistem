"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  FiArrowUpRight,
  FiCamera,
  FiExternalLink,
  FiGrid,
  FiPrinter,
  FiRefreshCw,
} from "react-icons/fi";

import { useGetStore } from "../../../features/store/hooks.js";
import Image from "next/image.js";

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-second";

export default function QRCodePage() {
  const [publicUrl, setPublicUrl] = useState("");

  const { data: store, isFetching, refetch } = useGetStore();

  useEffect(() => {
    setPublicUrl(`${window.location.origin}/`);
  }, []);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6">
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
            background: white !important;
            box-shadow: none !important;
            color: #1e1e1e !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          #qr-print-area .qr-print-card {
            width: 100% !important;
            max-width: 150mm !important;
            padding: 16mm !important;
            border: 1px solid #dedede !important;
            border-radius: 6mm !important;
            background: white !important;
            box-shadow: none !important;
            color: #1e1e1e !important;
          }

          #qr-print-area .qr-code-frame {
            width: 78mm !important;
            height: 78mm !important;
            padding: 5mm !important;
            border: 1px solid #eeeeee !important;
            border-radius: 4mm !important;
            background: white !important;
          }

          #qr-print-area .qr-code-frame svg {
            width: 100% !important;
            height: 100% !important;
          }

          #qr-print-area .qr-accent {
            color: #1e1e1e !important;
            background: #f5f5f5 !important;
            border-color: #dedede !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="">
          <div className="flex items-center gap-2">
            <FiGrid size={24} />

            <h1 className="text-2xl font-bold tracking-tight text-second sm:text-3xl">
              QR Code
            </h1>
          </div>

          <p className="mt-2 text-sm text-second/60">
            QR code untuk mengakses halaman utama toko dengan cepat.
          </p>
        </div>
        <div className="flex gap-4 w-full md:w-fit">
          {" "}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Perbarui data dashboard"
            className={`inline-flex px-4 py-2 items-center gap-2 rounded-full border border-second/30 px-4 text-sm font-semibold text-second transition-colors hover:bg-second/5 disabled:opacity-60 ${FOCUS_RING}`}
          >
            <FiRefreshCw
              size={16}
              className={isFetching ? "animate-spin" : ""}
            />
            {isFetching ? "Memperbarui..." : "Perbarui"}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={!publicUrl}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-second px-4 w-full md:w-fit py-2 text-sm font-semibold text-primary transition-colors hover:bg-second/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiPrinter size={18} />
            Cetak QR Code
          </button>
        </div>
      </div>

      <div className="no-print flex items-start gap-4 rounded-2xl border border border-second/30 bg-second/5 p-4">
        <FiCamera size={20} className="mt-0.5 shrink-0 text-second" />

        <div>
          <h2 className="text-sm font-semibold text-second">
            Siap dicetak dan dipajang
          </h2>

          <p className="mt-1 text-sm leading-6 text-second/60">
            Pengunjung cukup memindai QR code menggunakan kamera ponsel untuk
            membuka halaman utama toko. Cetak dan letakkan di meja atau area
            yang mudah terlihat.
          </p>
        </div>
      </div>

      <div className="flex justify-center">
        <section
          id="qr-print-area"
          className="qr-print-area w-full max-w-2xl overflow-hidden rounded-3xl border border-second/15 bg-white text-[#1e1e1e] shadow-xl shadow-black/5"
        >
          <div className="qr-print-card relative flex flex-col items-center overflow-hidden p-5 text-center sm:p-10">
            {/* Ornamen */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 flex h-2"
            >
              <span className="flex-1 bg-grad" />
              <span className="flex-1 bg-second2" />
              <span className="flex-1 bg-second3" />
            </div>

            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-8 -top-8 size-16 rounded-full bg-grad"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-16 size-4 rounded-full bg-second2"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-8 size-4 rounded-full bg-second3"
            />

            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-8 -left-8 size-16 rounded-full w-50 bg-second3"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-16 left-4 size-4 rounded-full bg-grad"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-8 right-4 size-8 rounded-full border-2 border-second2"
            />

            {/* Konten */}
            <div className="flex items-center gap-2">
              <div className="qr-accent flex size-10 items-center justify-center rounded-xl border border-[#e5e5e5] bg-[#f5f5f5]">
                <Image
                  src={store?.logo_url}
                  width={50}
                  height={50}
                  alt={`${store.name} logo`}
                />{" "}
              </div>

              <div className="text-left">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#777]">
                  Scan to explore
                </p>
                <p className="text-sm font-bold">
                  {store?.name || "Kunjungi Toko Kami"}
                </p>
              </div>
            </div>

            <div className="my-8 space-y-2">
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                Semuanya,
                <br />
                dimulai di sini.
              </h2>

              <p className="mx-auto max-w-xs text-sm leading-relaxed text-[#777]">
                Pindai QR code untuk melihat koleksi dan informasi toko.
              </p>

              <div className="mx-auto h-2 w-16 rounded-full bg-grad" />
            </div>

            <div className="qr-code-frame flex aspect-square w-full max-w-[320px] items-center justify-center rounded-2xl border border-[#ededed] bg-white p-4 shadow-[8px_8px_0_0] shadow-second3 sm:max-w-[360px]">
              {publicUrl ? (
                <QRCodeSVG
                  value={publicUrl}
                  size={320}
                  level="H"
                  marginSize={3}
                  bgColor="#ffffff"
                  fgColor="#1e1e1e"
                  title="QR Code halaman utama toko"
                  className="h-full w-full"
                />
              ) : (
                <div className="animate-pulse text-sm text-[#777]">
                  Membuat QR code...
                </div>
              )}
            </div>

            <div className="mt-8 flex items-center gap-2 rounded-full border border-[#e5e5e5] px-4 py-2">
              <span className="size-2 rounded-full bg-grad" />
              <p className="text-xs font-semibold tracking-wide">
                SCAN · BUKA · JELAJAHI
              </p>
            </div>

            <div className="mt-8 w-full border-t border-dashed border-[#dedede] pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#999]">
                Kunjungi kami di
              </p>

              <p className="mt-2 break-all text-sm font-medium">
                {publicUrl || "Menyiapkan alamat..."}
              </p>

              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[#777]">
                <span>Scan dengan kamera ponsel</span>
                <FiArrowUpRight size={14} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
