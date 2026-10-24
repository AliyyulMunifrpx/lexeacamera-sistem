import { FiMail } from "react-icons/fi";

export default function EmailConfirmationModal({
  email,
  onClose,
  email_before,
}) {
  if (!email) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-confirmation-title"
        className="w-full max-w-md rounded-2xl border border-second/20 bg-primary p-6 text-second shadow-2xl"
      >
        <div className="flex size-14 items-center justify-center rounded-2xl bg-second/10">
          <FiMail size={28} />
        </div>

        <h2 id="email-confirmation-title" className="mt-5 text-xl font-bold">
          Konfirmasi Perubahan Email
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-second/70">
          Permintaan perubahan email berhasil diproses. Untuk menyelesaikan
          perubahan, silakan buka email verifikasi yang dikirimkan ke alamat
          berikut:
        </p>

        <div className="mt-4 break-all rounded-xl border border-second/15 bg-second/5 p-4 text-sm font-semibold">
          {email}
        </div>
        <div className="mt-4 break-all rounded-xl border border-second/15 bg-second/5 p-4 text-sm font-semibold">
          {email_before}
        </div>

        <div className="mt-5 space-y-3 text-sm leading-relaxed text-second/70">
          <p>1. Periksa kotak masuk email tersebut, termasuk folder spam.</p>
          <p>
            2. Buka email verifikasi dan ikuti instruksi untuk mengonfirmasi
            perubahan.
          </p>
          <p>
            3. Email akun baru berlaku setelah proses verifikasi selesai dan
            perubahan tersinkronisasi.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-second px-5 py-3 text-sm font-semibold text-primary transition hover:opacity-90"
        >
          Saya Mengerti
        </button>
      </section>
    </div>
  );
}
