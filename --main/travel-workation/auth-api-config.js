(function () {
  window.AUTH_API_CONFIG = Object.freeze({
    // Set to true after the backend origin and CORS policy are ready.
ㅏ    enabled: false,
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
