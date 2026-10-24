export const mockCameras = [
  {
    id: "65d3fdba-6340-4756-8d5e-bde435488927",
    name: "Canon EOS R50",
    price: 12000000,
    stock: 3,
    images: [
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80",
    ],
    category: {
      id: "cat-mirrorless",
      name: "Mirrorless",
    },
  },
  {
    id: "30335b1f-5361-4399-9eff-d424898425da",
    name: "Nikon D3500",
    price: 7000000,
    stock: 2,
    images: [
      "https://images.unsplash.com/photo-1510127034890-ba27508e9f1c?auto=format&fit=crop&w=800&q=80",
    ],
    category: {
      id: "cat-dslr",
      name: "DSLR",
    },
  },
  {
    id: "a56aa87a-016f-47b4-b8ff-b1afbb4671ef",
    name: "Canon EOS 1500D",
    price: 5000000,
    stock: 4,
    images: [
      "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=800&q=80",
    ],
    category: {
      id: "cat-dslr",
      name: "DSLR",
    },
  },
  {
    id: "cam-004",
    name: "Sony Alpha A6400",
    price: 10500000,
    stock: 2,
    images: [
      "https://images.unsplash.com/photo-1516724562728-afc824a36e84?auto=format&fit=crop&w=800&q=80",
    ],
    category: {
      id: "cat-mirrorless",
      name: "Mirrorless",
    },
  },
  {
    id: "cam-005",
    name: "Fujifilm X-T30 II",
    price: 11000000,
    stock: 1,
    images: [
      "https://images.unsplash.com/photo-1519183071298-a2962be90b8e?auto=format&fit=crop&w=800&q=80",
    ],
    category: {
      id: "cat-mirrorless",
      name: "Mirrorless",
    },
  },
  {
    id: "cam-006",
    name: "Sony Alpha A7 III",
    price: 18000000,
    stock: 2,
    images: [
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80",
    ],
    category: {
      id: "cat-fullframe",
      name: "Full Frame",
    },
  },
  {
    id: "cam-007",
    name: "Canon EOS 90D",
    price: 14000000,
    stock: 1,
    images: [
      "https://images.unsplash.com/photo-1502982720700-bfff97f2ecac?auto=format&fit=crop&w=800&q=80",
    ],
    category: {
      id: "cat-dslr",
      name: "DSLR",
    },
  },
  {
    id: "cam-008",
    name: "Panasonic Lumix GH5",
    price: 12500000,
    stock: 2,
    images: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80",
    ],
    category: {
      id: "cat-mirrorless",
      name: "Mirrorless",
    },
  },
  {
    id: "cam-009",
    name: "Canon EOS R6",
    price: 23000000,
    stock: 1,
    images: [
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80",
    ],
    category: {
      id: "cat-fullframe",
      name: "Full Frame",
    },
  },
  {
    id: "cam-010",
    name: "Nikon Z50",
    price: 9500000,
    stock: 3,
    images: [
      "https://images.unsplash.com/photo-1510127034890-ba27508e9f1c?auto=format&fit=crop&w=800&q=80",
    ],
    category: {
      id: "cat-mirrorless",
      name: "Mirrorless",
    },
  },
];

export const mockCameraResponse = {
  data: mockCameras,
  paging: {
    page: 1,
    per_page: 20,
    total: mockCameras.length,
    total_pages: 1,
  },
};
