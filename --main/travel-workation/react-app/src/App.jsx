import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import SiteLayout from "./components/SiteLayout";
import AuthPage from "./pages/AuthPage";
import CommunityPage from "./pages/CommunityPage";
import CommunityWritePage from "./pages/CommunityWritePage";
import DestinationDetailPage from "./pages/DestinationDetailPage";
import GatheringsPage from "./pages/GatheringsPage";
import GatheringWritePage from "./pages/GatheringWritePage";
import GuideTrashPage from "./pages/GuideTrashPage";
import GuideDraftsPage from "./pages/GuideDraftsPage";
import MyGatheringsPage from "./pages/MyGatheringsPage";
import HomePage from "./pages/HomePage";
import JunnamJobDetailPage from "./pages/JunnamJobDetailPage";
import TourJobDetailPage from "./pages/TourJobDetailPage";
import LocalFitPage from "./pages/LocalFitPage";
import MapPage from "./pages/MapPage";
import MyPage from "./pages/MyPage";
import RecommendPage from "./pages/RecommendPage";
import TravelGuidePage from "./pages/TravelGuidePage";
import OAuthCallbackPage from "./pages/OAuthCallbackPage";
import { hasSession } from "./auth/session";

function RequireAuth({ children }) {
  const location = useLocation();
  if (!hasSession()) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/auth?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }
  return children;
}

function LegacyCommunityPostRedirect() {
  const { id } = useParams();
  return <Navigate to={`/community?post=${encodeURIComponent(id || "")}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<RequireAuth><SiteLayout /></RequireAuth>}>
        <Route index element={<HomePage />} />
        <Route path="recommend" element={<RecommendPage />} />
        <Route path="travel-guide" element={<TravelGuidePage />} />
        <Route path="travel-guide/:guideId" element={<TravelGuidePage />} />
        <Route path="travel-guide/draft/:draftId" element={<TravelGuidePage />} />
        <Route path="map" element={<Navigate to="/jobs" replace />} />
        <Route path="destinations/:id" element={<DestinationDetailPage />} />
        <Route path="jobs" element={<MapPage />} />
        <Route path="jobs/tour/:employmentInfoNo" element={<TourJobDetailPage />} />
        <Route path="jobs/junnam/:jobKey" element={<JunnamJobDetailPage />} />
        <Route path="jobs/:id" element={<Navigate to="/jobs" replace />} />
        <Route path="local-fit" element={<LocalFitPage />} />
        <Route path="community" element={<CommunityPage />} />
        <Route path="community/:id/edit" element={<CommunityWritePage />} />
        <Route path="community/:id" element={<LegacyCommunityPostRedirect />} />
        <Route path="gatherings" element={<GatheringsPage />} />
        <Route path="gatherings/write" element={<GatheringWritePage />} />
        <Route path="gatherings/:id/edit" element={<GatheringWritePage />} />
        <Route path="gatherings/mine" element={<MyGatheringsPage />} />
        <Route path="mypage" element={<MyPage />} />
        <Route path="mypage/trash" element={<GuideTrashPage />} />
        <Route path="mypage/drafts" element={<GuideDraftsPage />} />
      </Route>
      <Route path="auth" element={<AuthPage />} />
      <Route path="oauth/callback" element={<OAuthCallbackPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
