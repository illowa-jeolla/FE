import { useEffect, useRef, useState } from "react";

export default function AuthenticatedImage({ src, alt = "", ...props }) {
  const [displaySrc, setDisplaySrc] = useState(src);
  const [retried, setRetried] = useState(false);
  const authenticatedBlobRef = useRef("");

  useEffect(() => {
    if (authenticatedBlobRef.current) {
      URL.revokeObjectURL(authenticatedBlobRef.current);
      authenticatedBlobRef.current = "";
    }
    setDisplaySrc(src); setRetried(false);
  }, [src]);
  useEffect(() => () => {
    if (authenticatedBlobRef.current) URL.revokeObjectURL(authenticatedBlobRef.current);
  }, []);

  async function retryWithAuthentication() {
    if (retried || !src) return;
    setRetried(true);
    try {
      const token = sessionStorage.getItem("accessToken");
      const response = await fetch(src, { credentials: "include", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(String(src).includes("ngrok-free") ? { "ngrok-skip-browser-warning": "1" } : {}) } });
      if (!response.ok) throw new Error(`이미지 요청 실패 (${response.status})`);
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) throw new Error("이미지 형식의 응답이 아닙니다.");
      if (authenticatedBlobRef.current) URL.revokeObjectURL(authenticatedBlobRef.current);
      authenticatedBlobRef.current = URL.createObjectURL(blob);
      setDisplaySrc(authenticatedBlobRef.current);
    } catch (error) { console.error("게시글 이미지를 불러오지 못했습니다.", { src, message: error.message }); }
  }

  return <img {...props} src={displaySrc} alt={alt} onError={retryWithAuthentication} />;
}
