import { Navigate } from "react-router-dom";

export default function MyGatheringsPage() {
  return <Navigate to="/mypage?tab=gatherings" replace />;
}
