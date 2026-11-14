"use client";

import { FiAlertTriangle, FiRefreshCw } from "react-icons/fi";
import { useGetPublicStore } from "../../features/public/hooks.js";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-second4/40";

/* Lembar kertas: putih, bergaris tepi tipis, bayangan lembut, pita gradien di atas. */
function Paper({ children }) {
  return (
    <article className="relative mx-auto flex min-h-[80dvh] w-full max-w-3xl flex-col overflow-hidden rounded-sm border border-second/10 bg-primary shadow-xl shadow-second/10 print:min-h-0 print:border-0 print:shadow-none">
      <div className="h-2 w-full shrink-0 bg-grad" aria-hidden="true" />
      <div className="flex flex-1 flex-col p-8 sm:p-16">{children}</div>
    </article>
  );
}

function PaperSkeleton() {
  return (
    <Paper>
      <div
        role="status"
        aria-label="Memuat dokumen"
        className="flex flex-col gap-8"
      >
        <div className="flex items-center gap-4">
          <div className="size-16 animate-pulse rounded-sm bg-second/10" />
          <div className="h-4 w-48 animate-pulse rounded bg-second/10" />
        </div>
        <div className="mx-auto h-8 w-64 animate-pulse rounded bg-second/10" />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className={`h-4 animate-pulse rounded bg-second/10 ${
                index % 4 === 3 ? "w-2/3" : "w-full"
              }`}
            />
          ))}
        </div>
      </div>
    </Paper>
  );
}

export default function TermsPage() {
  const {
    data: store,
    isPending,
    isError,
    isFetching,
    refetch,
  } = useGetPublicStore();

  const paragraphs = String(store?.terms_and_condition ?? "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const storeName = String(store?.name ?? "").trim();
  const address = String(store?.address ?? "").trim();

  return (
    <div className="min-h-[100dvh] w-full bg-second/10 px-4 pb-16 pt-20 print:bg-primary print:p-0">
      {isPending ? (
        <PaperSkeleton />
      ) : isError ? (
        <Paper>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <FiAlertTriangle
              size={32}
              className="text-second2"
              aria-hidden="true"
            />
            <p role="alert" className="font-semibold text-second">
              Dokumen gagal dimuat.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className={`inline-flex items-center gap-2 rounded-full bg-grad px-4 py-2 text-sm font-semibold text-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer ${FOCUS_RING}`}
            >
              <FiRefreshCw
                size={16}
                className={
                  isFetching ? "animate-spin motion-reduce:animate-none" : ""
                }
                aria-hidden="true"
              />
              {isFetching ? "Memuat…" : "Coba lagi"}
            </button>
          </div>
        </Paper>
      ) : (
        <Paper>
          {/* Kop dokumen */}
          <header className="flex items-center gap-4 border-b-2 border-second pb-4">
            {store?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={store.logo_url}
                alt=""
                className="size-16 shrink-0 rounded-sm object-contain"
              />
            ) : (
              <div
                aria-hidden="true"
                className="flex size-16 shrink-0 items-center justify-center rounded-sm bg-grad text-2xl font-bold text-primary"
              >
                {(storeName || "S").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="break-words font-serif text-lg font-bold uppercase tracking-wide text-second">
                {storeName || "Toko"}
              </p>
              {address && (
                <p className="mt-2 line-clamp-2 break-words text-xs text-second/60">
                  {address}
                </p>
              )}
            </div>
          </header>

          {/* Judul */}
          <div className="py-8 text-center">
            <h1 className="font-serif text-2xl font-bold uppercase tracking-widest text-second sm:text-3xl">
              Syarat dan Ketentuan
            </h1>
            <div
              className="mx-auto mt-4 h-1 w-16 rounded-full bg-grad"
              aria-hidden="true"
            />
          </div>

          {/* Isi */}
          {paragraphs.length > 0 ? (
            <div className="flex flex-col gap-4 font-serif text-base leading-relaxed text-second">
              {paragraphs.map((text, index) => (
                <p
                  key={index}
                  className="whitespace-pre-line break-words text-justify hyphens-auto"
                >
                  {text}
                </p>
              ))}
            </div>
          ) : (
            <p className="py-16 text-center font-serif text-second/60">
              Syarat dan ketentuan belum tersedia.
            </p>
          )}

          {/* Kaki dokumen */}
          <footer className="mt-auto pt-16">
            <div className="border-t border-second/30 pt-4 text-center text-xs text-second/60">
              {storeName || "Toko"}
              {address ? ` · ${address}` : ""}
            </div>
          </footer>
        </Paper>
      )}
    </div>
  );
}
