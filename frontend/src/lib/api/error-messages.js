const ERROR_MESSAGES = {
  // Auth & akun
  EMAIL_ALREADY_EXIST: "Email sudah terdaftar.",
  EMAIL_NOT_VERIVIED:
    "Email belum diverifikasi. Silakan periksa kotak masuk email Anda.",
  INCORRECT_EMAIL_OR_PASSWORD: "Email atau kata sandi salah.",
  ACCOUNT_SUSPEND: "Akun Anda sedang ditangguhkan.",
  USER_DATABASE_MISMATCH: "Data akun tidak ditemukan.",
  UNAUTHORIZED:
    "Sesi Anda tidak valid atau telah berakhir. Silakan masuk kembali.",
  CURRENT_PASSWORD_INVALID: "",
  UPDATE_EMAIL_REQUEST_FAILED: "",

  // Toko & marketplace
  INVALID_PRICE_RANGE: "",
  MARKETPLACE_ALREADY_EXIST: "",
  STORE_NOT_FOUND: "",

  // Banner
  BANNER_IMAGE_REQUIRED: "Pilih gambar banner terlebih dahulu.",
  BANNER_FLAG_CONFLICT:
    "Satu banner tidak boleh menjadi Promo dan Best Seller sekaligus.",
  BANNER_FLAG_TAKEN:
    "Flag ini baru saja dipakai banner lain. Muat ulang lalu coba lagi.",
  NOTHING_TO_UPDATE: "Tidak ada perubahan yang dikirim.",
  INVALID_IMAGE_FORMAT: "Format gambar harus PNG, JPEG, atau WebP.",
  INVALID_IMAGE:
    "File tidak dapat diproses sebagai gambar. Coba gunakan file lain.",
  IMAGE_TOO_LARGE: "Ukuran gambar melebihi batas maksimal 5 MB.",
  INVALID_IMAGE_FIELD:
    "File gambar tidak valid. Pastikan menggunakan field banner.",
  BANNER_NOT_FOUND: "Banner tidak ditemukan atau sudah dihapus.",
  BANNER_UPLOAD_FAILED: "Gagal mengunggah gambar banner. Silakan coba kembali.",
  BANNER_BUCKET_NOT_CONFIGURED:
    "Penyimpanan gambar banner belum dikonfigurasi di server.",
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
