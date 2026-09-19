import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/app.css";
import "../../styles.css";
import "../../feature-pages.css";
import "../../mypage.css";
import "../../auth.css";
import "../../home-redesign.css";
import "./styles/brand.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
