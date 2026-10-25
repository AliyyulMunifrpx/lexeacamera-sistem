import Image from "next/image.js";
import Link from "next/link.js";

export default function PrimaryBanner({ banner, cameras }) {
  console.log(cameras);
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
            </Link>
          );
        })}
      </div>
    </div>
  );
}
