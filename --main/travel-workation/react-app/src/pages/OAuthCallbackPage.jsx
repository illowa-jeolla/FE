import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { refreshAccessToken } from "../api/client";

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("로그인 정보를 확인하고 있습니다.");

  useEffect(() => {
    let active = true;
    refreshAccessToken()
      .then(() => {
        if (!active) return;
        setMessage("로그인이 완료되었습니다.");
        navigate("/", { replace: true });
      })
      .catch((error) => {
        if (active) setMessage(error.message || "소셜 로그인을 완료하지 못했습니다.");
      });
    return () => { active = false; };
  }, [navigate]);

  return <main className="auth-main"><section className="auth-panel"><div className="page-status is-visible">{message}</div></section></main>;
}
