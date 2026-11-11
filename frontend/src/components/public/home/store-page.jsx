import Image from "next/image.js";
import PrimaryBanner from "./primary-banner.jsx";
import CameraCard from "./camera-card.jsx";

// Rasio banner di lg HANYA dipakai kalau tidak ada produk di sampingnya
// (misalnya 1 baris penuh berisi 3 banner).
const LG_BANNER_ASPECT = "lg:aspect-[4/5]";

// Tinggi minimal banner = lebarnya, supaya 4 kamera (kotak 2x2) di dalam
// PrimaryBanner selalu muat. Tinggi sebenarnya mengikuti blok produk di samping.
const MIN_SQUARE = "before:block before:pb-[100%]";

export default function StoreHomePage({ data }) {
  const bestSellingBanner = data?.banners?.find(
    (item) => item.is_best_seller === true,
  );
  const bestSellingCamera = data?.best_selling_cameras || [];

  const promoBanner = data?.banners?.find((item) => item.is_promo === true);
  const promoCameras = data?.promo_cameras || [];

  const kameraMasih = (data?.cameras || []).filter((item) => item.stock !== 0);
  const kameraHabis = (data?.cameras || []).filter((item) => item.stock === 0);
  const cameras = [...kameraMasih, ...kameraHabis];

  // Banner standar (bukan promo & bukan best seller)
  const standartBanner =
    data?.banners?.filter((item) => {
      return item.is_promo === false && item.is_best_seller === false;
    }) || [];

  // ===== Khusus lg =====
  // Daftar banner berurutan: best seller -> promo -> standar
  const lgBanners = [];
  if (bestSellingCamera.length > 0) {
    lgBanners.push({
      key: "best-seller",
      type: "primary",
      banner: bestSellingBanner,
      cameras: bestSellingCamera,
    });
  }
  if (promoCameras.length > 0) {
    lgBanners.push({
      key: "promo",
      type: "primary",
      banner: promoBanner,
      cameras: promoCameras,
    });
  }
  standartBanner.forEach((item) => {
    lgBanners.push({
      key: `standard-${item.id}`,
      type: "standard",
      banner: item,
    });
  });

  // Bagi per 3 banner (1 baris = 3 slot x 2 kolom)
  const bannerRows = [];
  for (let i = 0; i < lgBanners.length; i += 3) {
    bannerRows.push(lgBanners.slice(i, i + 3));
  }

  // Jumlah produk yang menempel di samping banner (tinggi 2 baris)
  // 2 banner -> 2 kolom x 2 baris = 4 | 1 banner -> 4 kolom x 2 baris = 8
  const SIDE_PRODUCTS = { 1: 8, 2: 4 };

  // Bagikan produk ke tiap baris banner, sisanya ke grid bawah
  let pointer = 0;
  const rows = bannerRows.map((row) => {
    const count = SIDE_PRODUCTS[row.length] || 0;
    const sideProducts = cameras.slice(pointer, pointer + count);
    pointer += count;
    return { banners: row, sideProducts };
  });
  const restCameras = cameras.slice(pointer);

  // stretch = true  -> tinggi banner mengikuti blok produk di sampingnya
  // stretch = false -> tidak ada produk di samping, pakai rasio LG_BANNER_ASPECT
  function renderLgBanner(item, stretch) {
    if (item.type === "primary") {
      // Rasio bawaan PrimaryBanner (2/3) ditimpa: ia mengisi penuh wrapper-nya.
      return (
        <div
          key={item.key}
          className={`col-span-2 relative w-full [&>div]:absolute [&>div]:inset-0 [&>div]:aspect-auto ${
            stretch ? MIN_SQUARE : LG_BANNER_ASPECT
          }`}
        >
          <PrimaryBanner cameras={item.cameras} banner={item.banner} />
        </div>
      );
    }

    return (
      <div
        key={item.key}
        className={`col-span-2 w-full relative rounded-xl overflow-hidden ${
          stretch ? "" : LG_BANNER_ASPECT
        }`}
      >
        <Image
          alt="Standard banner"
          src={item.banner.banner_url}
          fill
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col gap-4">
      {/* ===== MOBILE & TABLET (di bawah lg): sama seperti sebelumnya ===== */}
      {bestSellingCamera.length > 0 && (
        <div className="lg:hidden">
          <PrimaryBanner
            cameras={bestSellingCamera}
            banner={bestSellingBanner}
          />
        </div>
      )}

      {promoCameras.length > 0 && (
        <div className="lg:hidden">
          <PrimaryBanner cameras={promoCameras} banner={promoBanner} />
        </div>
      )}

      {standartBanner.length > 0 &&
        standartBanner.map((item) => (
          <div
            key={item.id}
            className="lg:hidden w-full aspect-[2/3] relative rounded-xl overflow-hidden"
          >
            <Image
              alt="Standard banner"
              src={item.banner_url}
              fill
              className="w-full h-full "
            />
          </div>
        ))}

      <div className="lg:hidden w-full grid gap-2 grid-cols-2 md:grid-cols-4">
        {cameras?.map((item) => (
          <CameraCard key={item.id} data={item} />
        ))}
      </div>

      {/* ===== LG ===== */}
      <div className="hidden lg:flex flex-col gap-2 w-full">
        {rows.map((row, rowIndex) => {
          const hasSide = row.sideProducts.length > 0;

          return (
            <div
              key={rowIndex}
              className="grid grid-cols-6 gap-2 items-stretch w-full"
            >
              {row.banners.map((item) => renderLgBanner(item, hasSide))}

              {/* Produk di slot sisa: 2 baris, tinggi blok ini = tinggi banner.
                  Atas kartu sejajar atas banner, bawah kartu sejajar bawah banner. */}
              {hasSide && (
                <div
                  className={`h-full grid grid-rows-2 gap-2 ${
                    row.banners.length === 1
                      ? "col-span-4 grid-cols-4"
                      : "col-span-2 grid-cols-2"
                  }`}
                >
                  {row.sideProducts.map((item) => (
                    <CameraCard key={item.id} data={item} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {restCameras.length > 0 && (
          <div className="w-full grid gap-2 grid-cols-6">
            {restCameras.map((item) => (
              <CameraCard key={item.id} data={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
