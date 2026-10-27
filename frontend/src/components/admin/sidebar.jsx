"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FiHome,
  FiCamera,
  FiTag,
  FiFileText,
  FiImage,
  FiShoppingBag,
  FiSettings,
  FiUser,
  FiExternalLink,
  FiMenu,
  FiX,
  FiChevronDown,
  FiLogOut,
  FiBox,
} from "react-icons/fi";
import {
  MdLocalGroceryStore,
  MdOutlineLocalGroceryStore,
  MdQrCode2,
} from "react-icons/md";
import { FaStore } from "react-icons/fa";
import { useGetStore } from "../../app/features/store/hooks.js";
import Image from "next/image.js";
import { useGetCurrentUser } from "../../app/features/users/hooks.js";
import { useRouter } from "next/navigation.js";
import { useQueryClient } from "@tanstack/react-query";
import { useLogoutCurrentUser } from "../../app/features/users/hooks.js";
import { normalizeApiError } from "../../lib/api/errors.js";
import notify from "../../lib/notify.js";
const navigation = [
  { label: "Dashboard", href: "/admin", icon: FiHome },
  { label: "Produk", href: "/admin/cameras", icon: FiBox },
  { label: "Kategori", href: "/admin/categories", icon: FiTag },
  { label: "Invoice", href: "/admin/invoices", icon: FiFileText },
  {
    label: "Toko Online",
    href: "/admin/marketplaces",
    icon: MdOutlineLocalGroceryStore,
  },
  { label: "QR Code", href: "/admin/qr-code", icon: MdQrCode2 },
  { label: "Banner", href: "/admin/banners", icon: FiImage },
  { label: "Toko", href: "/admin/store", icon: FaStore },
];

const pageTitles = {
  "/admin": "Dashboard",
  "/admin/cameras": "Produk",
  "/admin/categories": "Kategori",
  "/admin/invoices": "Invoice",
  "/admin/marketplaces": "Toko Online",
  "/admin/qr-code": "QR Code",
  "/admin/banners": "Banner",
  "/admin/store": "Toko",
  "/admin/profile": "Edit Profil",
  "/admin/settings": "Pengaturan",
  "/admin/account": "Akun Saya",
};

function SidebarLink({ item, active, onClick }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-4 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
        active ? "bg-primary text-second" : "text-primary hover:bg-primary/20 "
      }`}
    >
      <Icon
        size={19}
        className={
          active ? "text-second" : "text-primary group-hover:text-primary"
        }
      />
      <span>{item.label}</span>
    </Link>
  );
}
function ProfileMenu({ onClose }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const logoutMutation = useLogoutCurrentUser();

  const items = [{ label: "Akun saya", href: "/admin/account", icon: FiUser }];

  async function handleLogout() {
    try {
      await logoutMutation.mutateAsync();

      // Hapus cache privat, termasuk data profil user dan toko.
      queryClient.clear();

      onClose();
      router.replace("/auth/login");
      router.refresh();

      notify.success("Berhasil keluar dari akun.");
    } catch (error) {
      const apiError = normalizeApiError(error);
      notify.error(apiError.message);
    }
  }

  return (
    <div
      id="admin-profile-menu"
      className="absolute bottom-full left-1/2 z-20 mb-2 w-[85%] -translate-x-1/2 overflow-hidden rounded-2xl  bg-second p-2 shadow-xl shadow-second/10"
    >
      <div className="  px-4 py-2">
        <p className="text-xs font-medium text-primary/40">Akun</p>
      </div>

      <div className="mt-1 flex flex-col gap-1">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-4 rounded-xl px-4 py-2.5 text-sm text-primary/70 transition-colors hover:bg-second/5 hover:text-primary"
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          className="flex w-full cursor-pointer items-center gap-4 rounded-xl bg-second2 px-4 py-2.5 text-left text-sm font-medium text-primary transition-colors hover:bg-second2/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiLogOut size={18} />
          <span>{logoutMutation.isPending ? "Keluar..." : "Keluar"}</span>
        </button>
      </div>
    </div>
  );
}

function Sidebar({ mobileOpen, onClose }) {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const { data: store, isLoading } = useGetStore();
  const { data: currentUser, isLoading: isUserLoading } = useGetCurrentUser();
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-64 flex-col   bg-grad transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex h-16 shrink-0 items-center justify-between   px-4">
        <Link
          href="/admin"
          onClick={onClose}
          className="flex items-center gap-2"
        >
          <div className="flex size-8 items-center justify-center rounded-full overflow-hidden text-primary">
            {store ? (
              <Image
                src={store.logo_url}
                width={50}
                height={50}
                alt={`${store.name} logo`}
              ></Image>
            ) : (
              <FiCamera></FiCamera>
            )}
          </div>

          <span className="text-base font-bold tracking-tight text-primary">
            {`${store ? store.name : "Toko Anda"}`}{" "}
          </span>
        </Link>

        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup sidebar"
          className="rounded-lg p-2 text-primary transition-colors hover:bg-second/5 hover:text-second lg:hidden"
        >
          <FiX size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-8">
        <p className="mb-4 px-4 text-xs font-semibold uppercase tracking-wider text-primary">
          Menu utama
        </p>

        <nav aria-label="Navigasi admin" className="flex flex-col gap-2">
          {navigation.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

            return (
              <SidebarLink
                key={item.href}
                item={item}
                active={active}
                onClick={onClose}
              />
            );
          })}
        </nav>
      </div>

      <div className="relative shrink-0 p-4">
        {profileOpen && <ProfileMenu onClose={() => setProfileOpen(false)} />}

        <button
          type="button"
          aria-expanded={profileOpen}
          aria-controls="admin-profile-menu"
          onClick={() => setProfileOpen((open) => !open)}
          className={`flex w-full items-center gap-4 rounded-xl bg-primary p-2 text-left transition-colors ${
            profileOpen ? "bg-primary" : ""
          }`}
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-grad text-primary">
            <FiUser size={20} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-second">
              {isUserLoading
                ? "Memuat akun..."
                : currentUser?.name || "Akun Saya"}
            </p>

            <p className="truncate text-xs text-second/50">
              {currentUser?.email || ""}
            </p>
          </div>

          <FiChevronDown
            size={17}
            className={`shrink-0 text-second/40 transition-transform ${
              profileOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>
    </aside>
  );
}

export default function AdminShell({ children }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pageTitle =
    pageTitles[pathname] ||
    navigation.find(
      (item) => item.href !== "/admin" && pathname.startsWith(`${item.href}/`),
    )?.label ||
    "Admin";

  function closeMobileSidebar() {
    setMobileOpen(false);
  }

  return (
    <div className="min-h-dvh bg-primary text-second">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Tutup menu navigasi"
          onClick={closeMobileSidebar}
          className="fixed inset-0 z-40 bg-second/40 backdrop-blur-md lg:hidden"
        />
      )}

      <div className="flex min-h-dvh">
        <Sidebar mobileOpen={mobileOpen} onClose={closeMobileSidebar} />

        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4   px-4 text-second bg-primary sm:px-8">
            <button
              type="button"
              aria-label="Buka menu navigasi"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-second transition-colors hover:bg-primary/10 lg:hidden"
            >
              <FiMenu size={21} />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold sm:text-lg">
                {pageTitle}
              </h1>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
