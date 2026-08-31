import { Navigate, Route, Routes } from "react-router-dom";
import SiteLayout from "./components/SiteLayout";
import AuthPage from "./pages/AuthPage";
import CommunityDetailPage from "./pages/CommunityDetailPage";
import CommunityPage from "./pages/CommunityPage";
import CommunityWritePage from "./pages/CommunityWritePage";
import DestinationDetailPage from "./pages/DestinationDetailPage";
import GatheringsPage from "./pages/GatheringsPage";
import GatheringWritePage from "./pages/GatheringWritePage";
import GuideTrashPage from "./pages/GuideTrashPage";
import GuideDraftsPage from "./pages/GuideDraftsPage";
import MyGatheringsPage from "./pages/MyGatheringsPage";
import HomePage from "./pages/HomePage";
import JobDetailPage from "./pages/JobDetailPage";
import JunnamJobDetailPage from "./pages/JunnamJobDetailPage";
import JobsPage from "./pages/JobsPage";
import LocalFitPage from "./pages/LocalFitPage";
import MapPage from "./pages/MapPage";
import MyPage from "./pages/MyPage";
import RecommendPage from "./pages/RecommendPage";
import TravelGuidePage from "./pages/TravelGuidePage";
import OAuthCallbackPage from "./pages/OAuthCallbackPage";

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="auth" element={<AuthPage />} />
        <Route path="oauth/callback" element={<OAuthCallbackPage />} />
        <Route path="recommend" element={<RecommendPage />} />
        <Route path="travel-guide" element={<TravelGuidePage />} />
        <Route path="travel-guide/:guideId" element={<TravelGuidePage />} />
        <Route path="travel-guide/draft/:draftId" element={<TravelGuidePage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="destinations/:id" element={<DestinationDetailPage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="jobs/junnam/:jobKey" element={<JunnamJobDetailPage />} />
        <Route path="jobs/:id" element={<JobDetailPage />} />
        <Route path="local-fit" element={<LocalFitPage />} />
        <Route path="community" element={<CommunityPage />} />
        <Route path="community/write" element={<CommunityWritePage />} />
        <Route path="community/:id" element={<CommunityDetailPage />} />
        <Route path="gatherings" element={<GatheringsPage />} />
        <Route path="gatherings/write" element={<GatheringWritePage />} />
        <Route path="gatherings/mine" element={<MyGatheringsPage />} />
        <Route path="mypage" element={<MyPage />} />
        <Route path="mypage/trash" element={<GuideTrashPage />} />
        <Route path="mypage/drafts" element={<GuideDraftsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
