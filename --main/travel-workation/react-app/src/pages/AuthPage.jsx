import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { postJson } from "../api/client";
import { saveLoginSession } from "../auth/session";
import { AUTH_API, authApiUrl } from "../config";

export default function AuthPage() {
  const [view, setView] = useState("login");
  const [message, setMessage] = useState("로그인하면 저장한 기록을 이어볼 수 있어요.");
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  async function login(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const url = AUTH_API.enabled ? authApiUrl(AUTH_API.endpoints.login) : "/api/auth/login";
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
      await postJson("/api/auth/register", { email: values.email.trim().toLowerCase(), password: values.password, nickname: values.nickname });
      event.currentTarget.reset(); setView("login"); setMessage("회원가입이 완료되었습니다. 로그인해 주세요.");
    } catch (requestError) {
      setError(true); setMessage(requestError.message);
    }
  }

  return (
    <main className="auth-main-react">
      <section className="auth-intro-react">
        <span>여행과 일을 한 계정으로</span>
        <h1>전라도에서 시작할<br />새로운 하루를 준비하세요</h1>
        <p>관심 지역과 지원 공고를 안전하게 관리해요.</p>
        <img src="/assets/jeonnam-workation-hero.png" alt="바다가 보이는 전라도 워케이션 공간" />
      </section>
      <section className="auth-panel-react">
        <div className="auth-tabs-react" role="tablist" aria-label="계정 메뉴">
          <button className={view === "login" ? "is-active" : ""} type="button" onClick={() => { setView("login"); setMessage(""); }}>로그인</button>
          <button className={view === "signup" ? "is-active" : ""} type="button" onClick={() => { setView("signup"); setMessage(""); }}>회원가입</button>
        </div>
        {view === "login" ? (
          <form className="auth-form-react" onSubmit={login}>
            <div><span>다시 만나 반가워요</span><h2>로그인</h2></div>
            <label>이메일<input type="email" name="email" autoComplete="email" placeholder="name@example.com" required /></label>
            <label>비밀번호<input type="password" name="password" autoComplete="current-password" minLength="8" placeholder="8자 이상 입력해 주세요" required /></label>
            <button className="auth-submit" type="submit">로그인</button>
            <p className="social-divider">또는 간편 로그인</p>
            <button className="social-login kakao" type="button" onClick={() => setMessage("카카오 로그인은 연동 준비 중입니다.")}>카카오로 계속하기</button>
            <button className="social-login naver" type="button" onClick={() => setMessage("네이버 로그인은 연동 준비 중입니다.")}>네이버로 계속하기</button>
          </form>
        ) : (
          <form className="auth-form-react" onSubmit={signup}>
            <div><span>처음 오셨나요?</span><h2>회원가입</h2></div>
            <label>이메일<input type="email" name="email" autoComplete="email" placeholder="name@example.com" required /></label>
            <label>닉네임<input name="nickname" autoComplete="nickname" minLength="2" maxLength="20" placeholder="서비스에서 사용할 이름" required /></label>
            <label>비밀번호<input type="password" name="password" autoComplete="new-password" minLength="8" placeholder="8자 이상 입력해 주세요" required /></label>
            <label>비밀번호 확인<input type="password" name="passwordConfirm" autoComplete="new-password" minLength="8" placeholder="비밀번호를 한 번 더 입력해 주세요" required /></label>
            <button className="auth-submit" type="submit">계정 만들기</button>
          </form>
        )}
        <p className={`auth-message-react${error ? " is-error" : ""}`} role="status">{message}</p>
      </section>
    </main>
  );
}
