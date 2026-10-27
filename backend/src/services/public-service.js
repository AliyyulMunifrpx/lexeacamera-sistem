import { ResponseError } from "../error/response-error.js";
import { prisma } from "../lib/database.js";
import {
  getAllPublicCameraValidation,
  getPublicCameraValidation,
  getPublicHomeValidation,
  getPublicStoreValidation,
} from "../validation/public-validation.js";
import { validate } from "../validation/validation.js";
import bannerService from "./banner-service.js";

const PER_PAGE = 20;

// Jumlah item di beranda
const HOME_GENERAL_SIZE = 18;
const HOME_FEATURED_SIZE = 4;
// Batas aman supaya query beranda nggak pernah tanpa batas
const HOME_MAX_CATEGORIES = 100;

// Kamera yang di-soft-delete nggak pernah terlihat publik
const ACTIVE = { is_deleted: false };

// Hanya field yang aman untuk publik. id toko sengaja nggak ikut.
const STORE_SELECT = {
  logo_url: true,
  name: true,
  instagram: true,
  whatsapp: true,
  tiktok: true,
  facebook: true,
  map_url: true,
  address: true,
  main_banner_url: true,
  terms_and_condition: true,
};

// Kartu di daftar: cukup yang dibutuhkan grid katalog
const CARD_SELECT = {
  id: true,
  name: true,
  price: true,
  condition: true,
  stock: true,
  promo: true,
  best_selling: true,
  category: { select: { id: true, name: true } },
  images: {
    where: { is_primary: true },
    take: 1,
    select: { image_url: true },
  },
};

const DETAIL_SELECT = {
  id: true,
  name: true,
  price: true,
  condition: true,
  stock: true,
  description: true,
  inclusions: true,
  promo: true,
  best_selling: true,
  created_at: true,
  sku: true,
  serial_number: true,
  color: true,
  shutter_count: true,
  category: { select: { id: true, name: true } },
  // Foto utama selalu pertama, sisanya urut waktu upload
  images: {
    select: { id: true, image_url: true, is_primary: true },
    orderBy: [{ is_primary: "desc" }, { created_at: "asc" }, { id: "asc" }],
  },
  // Hanya marketplace yang aktif. Nama marketplace unik, jadi urutan stabil.
  marketplaceLinks: {
    where: { marketplace: { is_active: true } },
    select: {
      product_url: true,
      marketplace: { select: { id: true, name: true, logo_url: true } },
    },
    orderBy: { marketplace: { name: "asc" } },
  },
};

// id sebagai tiebreaker supaya urutan antar halaman stabil
const ORDER_BY = {
  newest: [{ created_at: "desc" }, { id: "asc" }],
  price_asc: [{ price: "asc" }, { created_at: "desc" }, { id: "asc" }],
  price_desc: [{ price: "desc" }, { created_at: "desc" }, { id: "asc" }],
};

// Foto utama jadi satu field `image_url` supaya frontend nggak perlu menggali array
const toCard = ({ images, ...camera }) => ({
  ...camera,
  image_url: images[0]?.image_url ?? null,
});

const getPublicStore = async (query = {}) => {
  validate(getPublicStoreValidation, query);

  const store = await prisma.store.findFirst({
    select: STORE_SELECT,
    orderBy: { id: "asc" },
  });

  if (!store) {
    throw new ResponseError(404, "STORE_NOT_FOUND");
  }

  return store;
};
export const getAllPublicCamera = async (query) => {
  const req = validate(getAllPublicCameraValidation, query); // atau getAllPublicCameraValidation

  if (
    req.min_price !== undefined &&
    req.max_price !== undefined &&
    req.min_price > req.max_price
  ) {
    throw new ResponseError(400, "INVALID_PRICE_RANGE");
  }

  const where = { ...ACTIVE };

  if (req.search) {
    where.name = { contains: req.search, mode: "insensitive" };
  }
  if (req.category_id) where.category_id = req.category_id;
  if (req.condition) where.condition = req.condition;
  if (req.promo !== undefined) where.promo = req.promo;
  if (req.best_selling !== undefined) where.best_selling = req.best_selling;

  // 👇 TAMBAHKAN FILTER SKU DI SINI 👇
  if (req.sku) {
    where.sku = { contains: req.sku, mode: "insensitive" };
  }

  if (req.min_price !== undefined || req.max_price !== undefined) {
    where.price = {};
    if (req.min_price !== undefined) where.price.gte = req.min_price;
    if (req.max_price !== undefined) where.price.lte = req.max_price;
  }

  const [cameras, total] = await prisma.$transaction([
    prisma.camera.findMany({
      where,
      select: CARD_SELECT,
      orderBy: ORDER_BY[req.sort],
      skip: (req.page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.camera.count({ where }),
  ]);

  return {
    data: cameras.map(toCard),
    paging: {
      page: req.page,
      per_page: PER_PAGE,
      total,
      total_pages: Math.ceil(total / PER_PAGE),
    },
  };
};

const getPublicCamera = async (request) => {
  const req = validate(getPublicCameraValidation, request);

  const camera = await prisma.camera.findFirst({
    where: { id: req.id, ...ACTIVE },
    select: DETAIL_SELECT,
  });

  if (!camera) {
    throw new ResponseError(404, "CAMERA_NOT_FOUND");
  }

  const { marketplaceLinks, ...rest } = camera;

  return {
    ...rest,
    marketplaces: marketplaceLinks.map((link) => ({
      id: link.marketplace.id,
      name: link.marketplace.name,
      logo_url: link.marketplace.logo_url,
      product_url: link.product_url,
    })),
  };
};

// Semua data beranda dalam satu request. Toko, kategori, kamera umum, promo, dan best
// seller dibaca dalam satu transaksi; banner memakai query banner yang sama
// dengan GET /banners supaya urutan dan batasnya selalu sama.
const getPublicHome = async (query = {}) => {
  validate(getPublicHomeValidation, query);

  const [[store, categories, general, promo, bestSelling], banners] =
    await Promise.all([
      prisma.$transaction([
        prisma.store.findFirst({
          select: STORE_SELECT,
          orderBy: { id: "asc" },
        }),
        prisma.category.findMany({
          select: { id: true, name: true },
          // id sebagai tiebreaker supaya urutan stabil
          orderBy: [{ name: "asc" }, { id: "asc" }],
          take: HOME_MAX_CATEGORIES,
        }),
        prisma.camera.findMany({
          where: {
            ...ACTIVE,
            promo: false, // 🎯 Filter bukan promo
            best_selling: false, // 🎯 Filter bukan best selling
          },
          select: CARD_SELECT,
          orderBy: ORDER_BY.newest,
          take: HOME_GENERAL_SIZE,
        }),
        prisma.camera.findMany({
          where: { ...ACTIVE, promo: true },
          select: CARD_SELECT,
          orderBy: ORDER_BY.newest,
          take: HOME_FEATURED_SIZE,
        }),
        prisma.camera.findMany({
          where: { ...ACTIVE, best_selling: true },
          select: CARD_SELECT,
          orderBy: ORDER_BY.newest,
          take: HOME_FEATURED_SIZE,
        }),
      ]),
      bannerService.getAllBanner(),
    ]);

  if (!store) {
    throw new ResponseError(404, "STORE_NOT_FOUND");
  }

  return {
    store,
    banners,
    categories,
    cameras: general.map(toCard),
    promo_cameras: promo.map(toCard),
    best_selling_cameras: bestSelling.map(toCard),
  };
};

export default {
  getPublicStore,
  getAllPublicCamera,
  getPublicCamera,
  getPublicHome,
};
