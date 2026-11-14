import CameraCard from "./camera-card.jsx";

export default function CameraSection({ data }) {
  return (
    <div className="w-full gap-2 grid grid-cols-2 lg:grid-cols-6">
      {data?.map((item) => {
        return <CameraCard key={item.id} data={item}></CameraCard>;
      })}
    </div>
  );
}
