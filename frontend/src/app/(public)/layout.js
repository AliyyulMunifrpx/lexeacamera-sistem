import Footer from "../../components/footer.jsx";
import Navbar from "../../components/navbar.jsx";
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
async function getStore() {
  try {
    const response = await fetch(`${API_URL}/public/store`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) return null;

    const json = await response.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}
export default async function RootLayout({ children }) {
  const store = await getStore();

  return (
    <div>
      <div className="relative isolate min-h-full flex flex-col bg-primary">
        <Navbar
          logo={store?.logo_url}
          name={store?.name || "lexea camera"}
          whatsapp={store?.whatsapp}
          shopee={store.facebook}
          instagram={store?.instagram}
        />{" "}
        <div className="z-20"> {children}</div>
        <Footer
          logo={store?.logo_url}
          name={store?.name || "lexea camera"}
          whatsapp={store?.whatsapp}
          shopee={store.facebook}
          instagram={store?.instagram}
          address={store?.address}
          mapUrl={store?.map_url}
        ></Footer>
      </div>
    </div>
  );
}
