const ERROR_MESSAGES = {
  // Auth & akun
  EMAIL_ALREADY_EXIST:
    "Email sudah terdaftar. Silakan gunakan email lain atau masuk.",
  EMAIL_NOT_VERIVIED:
    "Email belum diverifikasi. Silakan periksa kotak masuk email Anda.",
  INCORRECT_EMAIL_OR_PASSWORD: "Email atau kata sandi salah.",
  ACCOUNT_SUSPEND: "Akun Anda telah ditangguhkan atau dinonaktifkan.",
  USER_DATABASE_MISMATCH: "Data akun tidak ditemukan.",
  UNAUTHORIZED:
    "Sesi Anda tidak valid atau telah berakhir. Silakan masuk kembali.",
  CURRENT_PASSWORD_INVALID: "Kata sandi saat ini salah.",
  UPDATE_EMAIL_REQUEST_FAILED:
    "Gagal memproses pembaruan email. Silakan coba lagi.",
  SESSION_EXPIRED: "Sesi Anda telah kedaluwarsa. Silakan masuk kembali.",
  INVALID_TOKEN: "Tautan (link) sudah kedaluwarsa atau sudah pernah dipakai.",
  WEAK_PASSWORD:
    "Kata sandi terlalu lemah. Gunakan kombinasi huruf, angka, dan simbol yang lebih kuat.",
  PASSWORD_UPDATE_FAILED: "Gagal menyimpan kata sandi. Silakan coba lagi.",
  AUTH_SERVICE_UNAVAILABLE:
    "Layanan autentikasi sedang bermasalah. Coba beberapa saat lagi.",
  USER_ALREADY_EXIST: "Pengguna dengan data tersebut sudah terdaftar.",

  // Toko & marketplace
  INVALID_PRICE_RANGE:
    "Rentang harga tidak valid. Harga minimum harus lebih kecil dari harga maksimum.",
  MARKETPLACE_ALREADY_EXIST: "Marketplace tersebut sudah terdaftar.",
  STORE_NOT_FOUND: "Data toko tidak ditemukan.",
  STORE_NOT_READY:
    "Toko belum siap atau belum aktif untuk memproses tindakan ini.",
  WHATSAPP_ALREADY_USED:
    "Nomor WhatsApp ini sudah digunakan oleh akun atau toko lain.",

  // Pelanggan & Pesanan (Customer & Order)
  CUSTOMER_HAS_ORDERS:
    "Tidak dapat menghapus pelanggan karena masih memiliki riwayat pesanan aktif.",
  ORDER_ALREADY_PAID: "Pesanan ini sudah dibayar sebelumnya.",

  // Banner & Media
  BANNER_IMAGE_REQUIRED: "Pilih gambar banner terlebih dahulu.",
  BANNER_FLAG_CONFLICT:
    "Satu banner tidak boleh menjadi Promo dan Best Seller sekaligus.",
  BANNER_FLAG_TAKEN:
    "Flag ini baru saja dipakai banner lain. Muat ulang lalu coba lagi.",
  NOTHING_TO_UPDATE: "Tidak ada perubahan data yang dikirim.",
  INVALID_IMAGE_FORMAT: "Format gambar harus berupa PNG, JPEG, atau WebP.",
  INVALID_IMAGE:
    "File tidak dapat diproses sebagai gambar. Coba gunakan file lain.",
  IMAGE_TOO_LARGE: "Ukuran gambar melebihi batas maksimal 5 MB.",
  INVALID_IMAGE_FIELD:
    "File gambar tidak valid. Pastikan menggunakan field banner yang benar.",
  BANNER_NOT_FOUND: "Banner tidak ditemukan atau sudah dihapus.",
  BANNER_UPLOAD_FAILED: "Gagal mengunggah gambar banner. Silakan coba kembali.",
  BANNER_BUCKET_NOT_CONFIGURED:
    "Penyimpanan gambar banner belum dikonfigurasi di server.",

  // Sistem umum
  TO_MANY_REQUESTS:
    "Terlalu banyak permintaan dalam waktu singkat. Silakan coba beberapa saat lagi.",
  TOO_MANY_REQUESTS:
    "Terlalu banyak permintaan dalam waktu singkat. Silakan coba beberapa saat lagi.",
};
export function getErrorMessage(code, fallback) {
  return (
    ERROR_MESSAGES[code] || fallback || "Terjadi kesalahan. Silakan coba lagi."
  );
}

export function getValidationMessage(message) {
  if (!message) return null;

  const patterns = [
    {
      regex: /^"email" must be a valid email$/,
      message: "Format email tidak valid.",
    },
    {
      regex: /^"email" is required$/,
      message: "Email wajib diisi.",
    },
    {
      regex: /^"password" is required$/,
      message: "Kata sandi wajib diisi.",
    },
    {
      regex: /^"password" length must be at least \d+ characters long$/,
      message: "Kata sandi terlalu pendek.",
    },
    {
      regex: /^"name" is required$/,
      message: "Nama wajib diisi.",
    },
    {
      regex: /^"id" must be a valid GUID$/,
      message: "ID tidak valid.",
    },
    {
      regex: /^"is_promo" must be a boolean$/,
      message: "Nilai Promo harus true atau false.",
    },
    {
      regex: /^"is_best_seller" must be a boolean$/,
      message: "Nilai Best Seller harus true atau false.",
    },
    {
      regex: /^".+" is not allowed$/,
      message: "Data yang dikirim mengandung field yang tidak dikenali.",
    },
  ];

  const match = patterns.find((item) => item.regex.test(message));

  return match?.message || null;
}

export default ERROR_MESSAGES;
