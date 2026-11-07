import Image from "next/image.js";
import Link from "next/link.js";

const priceFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

function formatPrice(value) {
  const number = Number(value);

  if (value === null || value === undefined || Number.isNaN(number)) {
    return "0";
  }

  return priceFormatter.format(number);
}

export default function PrimaryBanner({ banner, cameras }) {
  return (
    <div className="w-full aspect-[2/3] relative rounded-lg overflow-hidden">
      {" "}
      <div className="w-full aspect-[2/3] absolute inset-0 ">
        {banner?.banner_url ? (
          <Image
            src={banner.banner_url}
            alt="best selling banner"
            fill
            className="w-full h-full"
          />
        ) : (
          <div className="w-full h-full bg-grad"></div>
        )}
      </div>
      <div className="w-full absolute aspect-square bottom-0 left-0 grid grid-cols-2 p-4 gap-4">
        {cameras.map((item, i) => {
          const price = Number(item.price) || 0;
          const strikethrough = Number(item.strikethrough_price) || 0;
          const hasDiscount = strikethrough > price && price >= 0;

          return (
            <Link
              href={`/${item.id}`}
              key={item.id}
              className="w-full aspect-square relative mt-auto mx-auto"
            >
              <Image
                alt={`${item.name} photo`}
                fill
                src={item.image_url}
                className="w-full h-full"
              ></Image>

              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 px-2 py-1 backdrop-blur-sm rounded-md">
                {hasDiscount && (
                  <p className="text-sm text-primary/70 line-through text-center ">
                    <span className="text-[10px]">Rp</span>
                    {formatPrice(strikethrough)}
                  </p>
                )}
                <p className="text-base font-semibold text-primary text-center">
                  <span className="text-[10px]">Rp</span>
                  {formatPrice(price)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
