import { API_URL } from "./api";

// Uploaded photos are saved as "/uploads/..." on our server; older items may have a full https:// link.
export function imageSrc(url) {
  if (!url) return null;
  return url.startsWith("/uploads/") ? `${API_URL}${url}` : url;
}

// Shrinks a photo from the phone's camera (often 4-8 MB) to at most 1280px, as JPEG, in the browser,
// so it uploads quickly on mobile data. Resolves to a "data:image/jpeg;base64,..." string.
export function shrinkImage(file, maxSize = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Please choose a photo"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo"));
    };
    img.src = url;
  });
}
