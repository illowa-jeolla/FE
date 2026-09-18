import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { clearApiCache, postJson } from "../api/client";
import { saveLoginSession } from "../auth/session";
import { AUTH_API, authApiUrl } from "../config";

function KakaoIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.25c-5.3 0-9.6 3.4-9.6 7.6 0 2.7 1.8 5.05 4.5 6.4l-1.15 4.22c-.1.38.32.68.65.46l4.95-3.28c.22.02.43.02.65.02 5.3 0 9.6-3.4 9.6-7.82S17.3 3.25 12 3.25Z" /></svg>;
}

function GoogleIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.55h3.24c1.9-1.75 2.98-4.33 2.98-7.42Z" />
    <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.35l-3.24-2.55c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.63A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.39 13.93A6.02 6.02 0 0 1 6.07 12c0-.67.11-1.32.32-1.93V7.44H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.56l3.35-2.63Z" />
    <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.44l3.35 2.63C7.18 7.7 9.39 5.94 12 5.94Z" />
  </svg>;
}

export default function AuthPage() {
  const [view, setView] = useState("login");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [socialLoginStarting, setSocialLoginStarting] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedReturnTo = searchParams.get("returnTo") || "/";
  const returnTo = requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//") ? requestedReturnTo : "/";

  useEffect(() => {
    document.body.classList.add("auth-page");
    return () => document.body.classList.remove("auth-page");
  }, []);

  function startSocialLogin(provider) {
    if (socialLoginStarting) return;
    if (!AUTH_API.enabled) {
      setError(true);
      setMessage(`${provider} 로그인을 사용할 수 없습니다.`);
      return;
    }
    sessionStorage.setItem("authReturnTo", returnTo);
    setSocialLoginStarting(true);
    setError(false);
    setMessage(`${provider === "kakao" ? "카카오" : "Google"} 로그인 페이지로 이동하고 있어요.`);
    window.location.assign(authApiUrl(AUTH_API.endpoints[provider]));
  }

  async function login(event) {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const url = authApiUrl(AUTH_API.endpoints.login);
    try {
      setBusy(true);
      setError(false); setMessage("로그인 중입니다.");
      const data = await postJson(url, { email: values.email.trim().toLowerCase(), password: values.password });
      clearApiCache();
      saveLoginSession(data);
      navigate(returnTo, { replace: true });
    } catch (requestError) {
      setError(true); setMessage(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function signup(event) {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (values.password !== values.passwordConfirm) {
      setError(true); setMessage("비밀번호가 일치하지 않습니다."); return;
    }
    try {
      setBusy(true);
      setError(false); setMessage("계정을 만들고 있습니다.");
      const url = authApiUrl(AUTH_API.endpoints.signup);
      const email = values.email.trim().toLowerCase();
      const data = await postJson(url, { email, password: values.password, nickname: values.nickname });
      clearApiCache();
      saveLoginSession({ ...data, email, nickname: values.nickname });
      navigate(returnTo, { replace: true });
    } catch (requestError) {
      setError(true); setMessage(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="onboarding-main">
      <section className="onboarding-content" aria-labelledby="onboarding-title">
        <img className="onboarding-logo" src="/mobile-assets/ilowa-jeolla-logo-cropped.png" alt="일로와 전라" />
        <h1 id="onboarding-title" className="sr-only">일로와 전라 시작하기</h1>
        <p className="onboarding-copy">전라도 여행과 일자리를 한 곳에서 찾아요<br />나에게 꼭 맞는 로컬 라이프를 시작해요</p>
        <div className="onboarding-actions">
          <button className="onboarding-login kakao" type="button" disabled={socialLoginStarting} onClick={() => startSocialLogin("kakao")}><span className="onboarding-provider-icon"><KakaoIcon /></span><span>Kakao로 시작하기</span></button>
          <button className="onboarding-login google" type="button" disabled={socialLoginStarting} onClick={() => startSocialLogin("google")}><span className="onboarding-provider-icon"><GoogleIcon /></span><span>Google로 시작하기</span></button>
        </div>
        <div className="onboarding-divider"><span>또는 이메일로 계속하기</span></div>
        <form className="local-auth-form" onSubmit={view === "login" ? login : signup}>
          {view === "signup" && <input name="nickname" autoComplete="nickname" maxLength="50" placeholder="닉네임" aria-label="닉네임" required />}
          <input type="email" name="email" autoComplete="email" placeholder="이메일" aria-label="이메일" required />
          <input type="password" name="password" autoComplete={view === "login" ? "current-password" : "new-password"} minLength="8" placeholder="비밀번호 (8자 이상)" aria-label="비밀번호" required />
          {view === "signup" && <input type="password" name="passwordConfirm" autoComplete="new-password" minLength="8" placeholder="비밀번호 확인" aria-label="비밀번호 확인" required />}
          <button className="local-auth-submit" type="submit" disabled={busy || socialLoginStarting}>{busy ? "처리 중…" : view === "login" ? "이메일로 로그인" : "회원가입"}</button>
        </form>
        <button className="local-auth-switch" type="button" disabled={busy} onClick={() => { setView(view === "login" ? "signup" : "login"); setError(false); setMessage(""); }}>
          {view === "login" ? "처음이신가요? 회원가입" : "이미 계정이 있나요? 로그인"}
        </button>
        <p className={`onboarding-message${error ? " is-error" : ""}`} role="status" aria-live="polite">{message}</p>
      </section>
    </main>
  );
}
