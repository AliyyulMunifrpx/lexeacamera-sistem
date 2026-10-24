const ERROR_MESSAGES = {
  EMAIL_ALREADY_EXIST: "Email sudah terdaftar.",
  EMAIL_NOT_VERIVIED:
    "Email belum diverifikasi. Silakan periksa kotak masuk email Anda.",
  INCORRECT_EMAIL_OR_PASSWORD: "Email atau kata sandi salah.",
  ACCOUNT_SUSPEND: "Akun Anda sedang ditangguhkan.",
  USER_DATABASE_MISMATCH: "Data akun tidak ditemukan.",
  UNAUTHORIZED: "Sesi Anda telah berakhir. Silakan masuk kembali.",
  INVALID_PRICE_RANGE: "",
  MARKETPLACE_ALREADY_EXIST: "",
  STORE_NOT_FOUND: "",
  BANNER_IMAGE_REQUIRED: "Pilih gambar banner terlebih dahulu.",
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
  UNAUTHORIZED:
    "Sesi Anda tidak valid atau telah berakhir. Silakan masuk kembali.",
  CURRENT_PASSWORD_INVALID: "",
  UPDATE_EMAIL_REQUEST_FAILED: "",
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
  ];

  const match = patterns.find((item) => item.regex.test(message));

  return match?.message || null;
}

export default ERROR_MESSAGES;
