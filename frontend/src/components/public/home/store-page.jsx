import Image from "next/image.js";
import Link from "next/link.js";
import PrimaryBanner from "./primary-banner.jsx";
import CameraCard from "./camera-card.jsx";

export default function StoreHomePage({ data }) {
  const bestSellingBanner = data?.banners?.find(
    (item) => item.is_best_seller === true,
  );
  const bestSellingCamera = data?.best_selling_cameras || [];

  const promoBanner = data?.banners?.find((item) => item.is_promo === true);
  const promoCameras = data?.promo_cameras || [];
  const kameraMasih = (data?.cameras || []).filter((value, index, array) => {
    return value.stock !== 0;
  });
  const kameraHabis = (data?.cameras || []).filter((value, index, array) => {
    return value.stock === 0;
  });
  const cameras = [...kameraMasih, ...kameraHabis];
  // Filter banner standar (yang bukan promo & bukan best seller)
  const standartBanner =
    data?.banners?.filter((item) => {
      return item.is_promo === false && item.is_best_seller === false;
    }) || [];

  return (
    <div className="w-full h-full flex flex-col gap-4">
      {bestSellingCamera.length > 0 && (
        <div className="lg:hidden">
          {" "}
          <PrimaryBanner
            cameras={bestSellingCamera}
            banner={bestSellingBanner}
          />
        </div>
      )}
      {bestSellingCamera.length > 0 && (
        <div className="hidden lg:grid w-full h-full grid-cols-6 items-center">
          <h3 className="col-start-1 col-end-3 text-[6rem] font-semibold text-primary leading-none">
            Best Seller:
          </h3>
          <div className="grid grid-cols-4 col-start-3 col-end-7 gap-2 w-full">
            {bestSellingCamera.map((item) => (
              <CameraCard key={item.id} data={item} />
            ))}
          </div>
        </div>
      )}
      {promoCameras.length > 0 && (
        <div className="lg:hidden">
          <PrimaryBanner cameras={promoCameras} banner={promoBanner} />
        </div>
      )}
      {promoCameras.length > 0 && (
        <div className="hidden lg:grid w-full h-full grid-cols-6 items-center">
          <h3 className="col-start-1 col-end-3 text-[6rem] font-semibold text-primary leading-none">
            Promo:
          </h3>
          <div className="grid grid-cols-4 col-start-3 col-end-7 gap-2 w-full">
            {promoCameras.map((item) => (
              <CameraCard key={item.id} data={item} />
            ))}
          </div>
        </div>
      )}

      {/* 🎯 Perbaikan Render Standard Banner */}
      {standartBanner.length > 0 &&
        standartBanner.map((item) => (
          <div
            key={item.id}
            className="w-full aspect-[2/3] relative rounded-xl overflow-hidden"
          >
            <Image
              alt="Standard banner"
              src={item.banner_url} // Pakai item.banner_url sesuai perulangan map
              fill
              className="w-full h-full "
            />
          </div>
        ))}

      <div className="w-full grid gap-2 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        {cameras?.map((item) => (
          <CameraCard key={item.id} data={item} />
        ))}
      </div>
    </div>
  );
}
