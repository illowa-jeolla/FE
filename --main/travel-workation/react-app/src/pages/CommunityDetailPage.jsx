import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { hasSession } from "../auth/session";
import { FormMessage, PageIntro, Status } from "../components/UI";
import { useApi } from "../hooks/useApi";
import { postImages } from "./communityUtils";

export default function CommunityDetailPage() {
  const { id } = useParams();
  const { data: post, loading, error, run } = useApi(`/api/posts/${id}`);
  const [message, setMessage] = useState("");
  async function addComment(event) {
    event.preventDefault(); if (!hasSession()) { setMessage("로그인 후 댓글을 남길 수 있어요."); return; }
    const content = new FormData(event.currentTarget).get("content");
    try { await apiRequest(`/api/posts/${id}/comments`, { method: "POST", body: JSON.stringify({ content }) }); event.currentTarget.reset(); setMessage("댓글을 등록했습니다."); await run(); } catch (e) { setMessage(e.message); }
  }
  const comments = post?.comments || [];
  const images = post ? postImages(post) : [];
  return <main className="page-shell-react narrow-react"><Status loading={loading} error={error} empty={!post}>{post && <><PageIntro eyebrow={`${post.region} · TRAVEL STORY`} title={post.concept} description={`${post.nickname || post.username || "여행자"} · ${post.created_at?.slice?.(0, 10) || "방금"}`} action={<Link className="secondary-action-react" to="/community">목록으로</Link>} /><article className="post-detail-react">{images.length > 0 && <div className="post-gallery-react">{images.map((image, index) => <img src={image} alt={`여행 사진 ${index + 1}`} key={index} />)}</div>}<p>{post.content}</p></article><section className="comments-react"><div className="section-row-react"><h2>댓글</h2><b>{comments.length}</b></div><div>{comments.map((comment) => <article key={comment.id}><strong>{comment.nickname || comment.username || "여행자"}</strong><p>{comment.content}</p><small>{comment.created_at?.slice?.(0, 16)}</small></article>)}</div><form onSubmit={addComment}><textarea name="content" maxLength="300" placeholder="여행 이야기에 댓글을 남겨보세요" required /><button className="primary-action-react">댓글 등록</button></form><FormMessage message={message} /></section></>}</Status></main>;
}
