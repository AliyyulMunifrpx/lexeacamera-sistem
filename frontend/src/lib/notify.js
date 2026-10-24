import toast from "react-hot-toast";

const notify = {
  success(message) {
    toast.success(message);
  },

  error(message) {
    toast.error(message);
  },

  loading(message) {
    return toast.loading(message);
  },

  dismiss(toastId) {
    toast.dismiss(toastId);
  },
};

export default notify;
