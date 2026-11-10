import { useMutation, useQueryClient } from "@tanstack/react-query";

import { importCameras } from "./import-api.js";

/**
 * Dipakai untuk pemeriksaan ({ rows, dryRun: true }) dan import sungguhan.
 * Daftar produk dan kategori disegarkan hanya setelah import sungguhan.
 */
export function useImportCameras() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: importCameras,
    onSuccess: (_data, variables) => {
      if (variables?.dryRun) return;
      queryClient.invalidateQueries({ queryKey: ["cameras"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}
