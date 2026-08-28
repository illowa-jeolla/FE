(function () {
  window.AUTH_API_CONFIG = Object.freeze({
    enabled: true,
    origin: "",
    basePath: "/api/v1",
    endpoints: Object.freeze({
      signup: "/auth/signup",
      login: "/auth/login",
      kakao: "/auth/kakao",
      kakaoCallback: "/auth/kakao/callback",
      google: "/auth/google",
      googleCallback: "/auth/google/callback",
      csrf: "/auth/csrf",
      refresh: "/auth/refresh",
      logout: "/auth/logout"
    })
  });
})();
