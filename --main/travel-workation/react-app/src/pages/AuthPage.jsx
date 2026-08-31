import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { postJson } from "../api/client";
import { saveLoginSession } from "../auth/session";
import { AUTH_API, authApiUrl } from "../config";

export default function AuthPage() {
  const [view, setView] = useState("login");
  const [message, setMessage] = useState("로그인하면 저장한 기록을 이어볼 수 있어요.");
  const [error, setError] = useState(false);
  const [socialLoginStarting, setSocialLoginStarting] = useState(false);
  const navigate = useNavigate();

  function startSocialLogin(provider) {
    if (socialLoginStarting) return;
    if (!AUTH_API.enabled) {
      setError(true);
      setMessage(`${provider} 로그인을 사용할 수 없습니다.`);
      return;
    }
    setSocialLoginStarting(true);
    setError(false);
    setMessage("카카오 로그인 페이지로 이동하고 있습니다.");
    window.location.assign(authApiUrl(AUTH_API.endpoints[provider]));
  }

  async function login(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const url = authApiUrl(AUTH_API.endpoints.login);
    try {
      setError(false); setMessage("로그인 중입니다.");
      const data = await postJson(url, { email: values.email.trim().toLowerCase(), password: values.password });
      saveLoginSession(data);
      navigate("/");
    } catch (requestError) {
      setError(true); setMessage(requestError.message);
    }
  }

  async function signup(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (values.password !== values.passwordConfirm) {
      setError(true); setMessage("비밀번호가 일치하지 않습니다."); return;
    }
    try {
      setError(false); setMessage("계정을 만들고 있습니다.");
      const url = authApiUrl(AUTH_API.endpoints.signup);
      const email = values.email.trim().toLowerCase();
      const data = await postJson(url, { email, password: values.password, nickname: values.nickname });
      saveLoginSession({ ...data, email, nickname: values.nickname });
      navigate("/");
    } catch (requestError) {
      setError(true); setMessage(requestError.message);
    }
  }

  return (
    <main className="auth-main">
      <section className="auth-intro">
        <p className="eyebrow">여행과 일을 한 계정으로</p>
        <h1>전라도에서 시작할<br />새로운 하루를 준비하세요</h1>
        <p>관심 지역과 지원 공고를 안전하게 관리해요.</p>
      </section>
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-tabs" role="tablist" aria-label="계정 메뉴">
          <button className={`auth-tab${view === "login" ? " is-active" : ""}`} type="button" role="tab" aria-selected={view === "login"} onClick={() => { setView("login"); setMessage(""); }}>로그인</button>
          <button className={`auth-tab${view === "signup" ? " is-active" : ""}`} type="button" role="tab" aria-selected={view === "signup"} onClick={() => { setView("signup"); setMessage(""); }}>회원가입</button>
        </div>
        {view === "login" ? (
          <form className="auth-form" onSubmit={login}>
            <div><p className="auth-label">다시 만나 반가워요</p><h2 id="auth-title">로그인</h2></div>
            <label>이메일<input type="email" name="email" autoComplete="email" placeholder="name@example.com" required /></label>
            <label>비밀번호<input type="password" name="password" autoComplete="current-password" minLength="8" placeholder="8자 이상 입력해 주세요" required /></label>
            <button className="button button-primary" type="submit">로그인</button>
            <div className="auth-socials"><p className="auth-divider">또는 간편 로그인</p><button className="social-button kakao" type="button" disabled={socialLoginStarting} onClick={() => startSocialLogin("kakao")}>카카오로 계속하기</button><button className="social-button google" type="button" disabled={socialLoginStarting} onClick={() => startSocialLogin("google")}>Google로 계속하기</button></div>
          </form>
        ) : (
          <form className="auth-form" onSubmit={signup}>
            <div><p className="auth-label">처음 오셨나요?</p><h2>회원가입</h2></div>
            <label>이메일<input type="email" name="email" autoComplete="email" placeholder="name@example.com" required /></label>
            <label>닉네임<input name="nickname" autoComplete="nickname" maxLength="50" placeholder="서비스에서 사용할 이름" required /></label>
            <label>비밀번호<input type="password" name="password" autoComplete="new-password" minLength="8" placeholder="8자 이상 입력해 주세요" required /></label>
            <label>비밀번호 확인<input type="password" name="passwordConfirm" autoComplete="new-password" minLength="8" placeholder="비밀번호를 한 번 더 입력해 주세요" required /></label>
            <button className="button button-primary" type="submit">계정 만들기</button>
          </form>
        )}
        <p className={`auth-message${error ? " is-error" : ""}`} role="status" aria-live="polite">{message}</p>
      </section>
    </main>
  );
}
