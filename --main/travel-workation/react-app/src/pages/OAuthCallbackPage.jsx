import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { refreshAccessToken } from "../api/client";

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oauthError = searchParams.get("error_description") || searchParams.get("error");
  const [message, setMessage] = useState("로그인 정보를 확인하고 있습니다.");

  useEffect(() => {
    let active = true;
    document.body.classList.add("auth-page");
    if (oauthError) {
      sessionStorage.removeItem("authReturnTo");
      setMessage(`소셜 로그인을 완료하지 못했습니다. (${oauthError})`);
      return () => { active = false; document.body.classList.remove("auth-page"); };
    }
    refreshAccessToken()
      .then(() => {
        if (!active) return;
        setMessage("로그인이 완료되었습니다.");
        const requestedReturnTo = sessionStorage.getItem("authReturnTo") || "/";
        sessionStorage.removeItem("authReturnTo");
        const returnTo = requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//") ? requestedReturnTo : "/";
        navigate(returnTo, { replace: true });
      })
      .catch((error) => {
        if (active) setMessage(error.message || "소셜 로그인을 완료하지 못했습니다.");
      });
    return () => { active = false; document.body.classList.remove("auth-page"); };
  }, [navigate, oauthError]);

  return <main className="auth-main"><section className="auth-panel"><div className="page-status is-visible">{message}</div></section></main>;
}
