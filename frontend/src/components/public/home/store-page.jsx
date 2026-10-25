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

  // Filter banner standar (yang bukan promo & bukan best seller)
  const standartBanner =
    data?.banners?.filter((item) => {
      return item.is_promo === false && item.is_best_seller === false;
    }) || [];

  return (
    <div className="w-full h-full flex flex-col gap-4">
      {bestSellingCamera.length > 0 && (
        <PrimaryBanner cameras={bestSellingCamera} banner={bestSellingBanner} />
      )}

      {promoCameras.length > 0 && (
        <PrimaryBanner cameras={promoCameras} banner={promoBanner} />
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

      <div className="w-full grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {data?.cameras?.map((item) => {
          return <CameraCard key={item.id} data={item}></CameraCard>;
        })}
      </div>
    </div>
  );
}
