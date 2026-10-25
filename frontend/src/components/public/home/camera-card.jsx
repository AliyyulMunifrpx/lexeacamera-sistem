import Image from "next/image.js";
import Link from "next/link.js";
import { BsFire } from "react-icons/bs";
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
export default function CameraCard({ data }) {
  return (
    <Link
      href={`/${data.id}`}
      key={data.id}
      className="group mb-2 flex w-full break-inside-avoid flex-col gap-2"
    >
      <div className="w-full aspect-square relative rounded-lg overflow-hidden bg-second/5">
        {data.stock === 0 && (
          <div className="bg-second/60 absolute inset-0 w-full aspect-square z-10 flex items-center justify-center">
            <div className="w-[50%] aspect-square bg-second/90 rounded-full flex items-center justify-center text-primary">
              Habis
            </div>
          </div>
        )}
        {data.image_url ? (
          <Image
            alt={`${data.name} photo`}
            src={data.image_url}
            fill
            unoptimized
            className="w-full h-full object-cover transition-transform group-hover:scale-105 ease-out duration-300"
          />
        ) : (
          <div className="flex h-full datas-center justify-center text-xs text-second/40">
            No image
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-second text-sm font-normal line-clamp-2 break-words ">
          <span className="bg-second2 text-primary text-xs px-1 font-semibold">
            {data.condition}
          </span>{" "}
          {data.name}
        </h3>
        {data.stock === 0
          ? ""
          : data.stock <= 3 && (
              <div className="h-3 w-full bg-second2/40 rounded-md relative ">
                {" "}
                <div
                  className={`h-3 bg-second2 absolute top-0 left-0 ${data.stock === 0 ? "hidden" : data.stock === 3 ? "w-9" : data.stock === 2 ? "w-7" : "w-5"} rounded-md`}
                ></div>
                <BsFire
                  className={`absolute bottom-0 text-yellow-500 stroke-second2 stroke-[1] [paint-order:stroke_fill] ${
                    data.stock === 0
                      ? "hidden"
                      : data.stock === 1
                        ? "left-2"
                        : data.stock === 3
                          ? "left-6"
                          : "left-4"
                  }`}
                />
                <p className="text-xs text-primary absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2">
                  Stok Menipis {data.stock}
                </p>
              </div>
            )}
        <p className="text-base text-grad font-semibold">
          <span className="text-sm">Rp</span>
          {formatPrice(data.price)}
        </p>
      </div>
    </Link>
  );
}
