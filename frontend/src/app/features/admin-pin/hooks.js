import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateCurrentPin } from "./api.js";

export function useUpdateCurrentPin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCurrentPin,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["current-user"],
      });
    },
  });
}
