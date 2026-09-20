import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import RegionIllustrationMap from "../components/RegionIllustrationMap";
import AuthenticatedImage from "../components/AuthenticatedImage";
import { getTravelPosts } from "../api/travelPosts";
import { postImages } from "./communityUtils";
import "../styles/home-refresh.css";

const destinations = [
  { name: "여수", meta: "바다 · 야경", image: "/images/jeolla-coast-background.png", path: "/recommend", action: "여행 추천 만들기" },
  { name: "순천", meta: "정원 · 생태", image: "/images/suncheon-garden-v1.png", path: "/recommend", action: "여행 추천 만들기" },
  { name: "목포", meta: "항구 · 근대문화", image: "/images/local-jobs-folk-performance.png", path: "/recommend", action: "여행 추천 만들기" },
  { name: "담양", meta: "대나무 · 산책", image: "/images/local-jobs-traditional.jpeg", path: "/recommend", action: "여행 추천 만들기" },
  { name: "보성", meta: "차밭 · 초록", image: "/images/boseong-green-tea-v1.png", path: "/recommend", action: "여행 추천 만들기" },
  { name: "신안", meta: "섬 · 고요함", image: "/images/island-coast-cutout.png", path: "/recommend", action: "여행 추천 만들기" }
];

const themes = [
  ["자연", "숲과 들판 사이, 천천히 걷는 하루", "/images/community-nature-v2.png", "/recommend"],
  ["바다", "수평선이 가까운 남도의 오후", "/images/community-sea-v2.png", "/recommend"],
  ["맛집", "지역의 맛을 가장 가까이에서", "/images/community-food-v2.png", "/jobs"],
  ["역사", "오래된 골목과 새로운 시선", "/images/community-history-v2.png", "/community"]
];

const introGallery = [
  ["여수", "/images/jeolla-coast-background.png"],
  ["순천", "/images/island-coast-cutout.png"],
  ["담양", "/images/local-jobs-traditional.jpeg"],
  ["전남의 하루", "/images/home-hanok-village-v1.png"]
];

function Reveal({ children, className = "" }) { return <div className={`home-reveal ${className}`}>{children}</div>; }

export default function HomePage() {
  const page = useRef(null);
  const [sharedPosts, setSharedPosts] = useState([]);
  useEffect(() => { let active = true; getTravelPosts({ page: 0, size: 30 }).then((data) => { if (active) setSharedPosts(Array.isArray(data?.content) ? data.content : Array.isArray(data?.posts) ? data.posts : []); }).catch(() => {}); return () => { active = false; }; }, []);
  const sharedThemes = [
    ["자연", "자연 속에서 발견한 오늘의 여행", "/images/community-nature-v2.png"],
    ["바다", "수평선 가까이에서 보낸 하루", "/images/community-sea-v2.png"],
    ["맛집", "전남의 맛을 기록한 여행", "/images/community-food-v2.png"],
    ["역사", "오래된 골목과 새로운 시선", "/images/community-history-v2.png"]
  ].map(([name, copy, fallback]) => {
    const post = sharedPosts.find((item) => `${item.title || ""} ${item.concept || ""} ${item.content || ""}`.includes(name));
    return { name, copy: post?.title || copy, fallback, post, image: postImages(post || {})[0] };
  });
  useEffect(() => {
    const root = page.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root?.querySelectorAll(".home-reveal").forEach((item) => item.classList.add("is-visible"));
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }), { threshold: 0.14 });
    root.querySelectorAll(".home-reveal").forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return <main ref={page} className="home-main home-refresh">
    <section className="home-editorial-hero" aria-labelledby="home-title">
      <div className="home-hero-photo" aria-hidden="true" /><div className="home-hero-overlay" aria-hidden="true" />
      <div className="home-hero-copy"><p className="home-eyebrow">JEOLLANAMDO · TRAVEL CURATION</p><h1 id="home-title"><span className="home-hero-line home-hero-line--first">당신의 하루를</span><span className="home-hero-line home-hero-line--second"><em>당신의 방식으로</em></span></h1><p className="home-hero-lede">취향에 맞는 여행지를 발견하고,<br />머무는 곳에서 새로운 일상을 시작해보세요.</p><div className="home-hero-actions"><Link className="home-cta-button" to="/recommend">여행 추천 시작하기 <span aria-hidden="true">↗</span></Link><a className="home-text-link" href="#destinations">전남 둘러보기 <span aria-hidden="true">↓</span></a></div></div>
      <div className="home-hero-index" aria-hidden="true"><span>SCROLL TO EXPLORE</span><b>01 / 06</b></div>
    </section>
    <section className="home-intro-section"><Reveal><p className="home-eyebrow">ONE PLACE, MANY DIRECTIONS</p><h2><span>여행의 이유는 달라도,</span><span><em>시작은 전남</em>에서</span></h2><p className="home-intro-copy">바다와 정원, 골목과 섬. 일로와전라는 여행자의 취향과 지역의 매력을 이어 한 번의 검색으로 나만의 전남을 찾게 해요.</p></Reveal><div className="home-intro-gallery" aria-label="전남 여행 풍경"><div className="home-intro-gallery-track">{[...introGallery, ...introGallery].map(([name, image], index) => <div className="home-intro-gallery-card" key={`${name}-${index}`}><img src={image} alt={`${name} 여행 풍경`} /></div>)}</div></div></section>
    <section id="destinations" className="home-destination-section"><Reveal className="home-section-heading"><p className="home-eyebrow">PLACES TO BEGIN</p><h2>어디로 떠나볼까요?</h2><p>지금 가장 만나고 싶은 전남의 장면을 골라보세요.</p></Reveal><div className="home-destination-rail">{destinations.map((item, index) => <Link className="home-destination-card" to={`${item.path}?region=${encodeURIComponent(item.name)}`} key={item.name}><img src={item.image} alt={`${item.name} 여행 풍경`} loading={index > 1 ? "lazy" : "eager"} /><span className="home-card-number">0{index + 1}</span><div><p>{item.meta}</p><h3>{item.name}</h3><span>{item.action} <b aria-hidden="true">↗</b></span></div></Link>)}</div></section>
    <section className="home-service-section"><Reveal className="home-section-heading"><p className="home-eyebrow">A BETTER WAY TO TRAVEL</p><h2>여행을 고르는 순간부터<br />동선이 달라집니다.</h2></Reveal><div className="home-service-list"><Reveal className="home-service-row"><div className="home-service-visual home-service-visual--map"><div className="home-map-label">전남 여행 동선 <b>01</b></div><RegionIllustrationMap items={[]} /></div><div className="home-service-copy"><span>01 · PERSONAL ROUTE</span><h3>숙소 위치를 중심으로<br />가장 자연스러운 동선</h3><p>머무는 곳과 여행 날짜를 바탕으로 이동 시간을 줄이고, 하루의 리듬을 살린 여행 가이드를 만들어드려요.</p><Link to="/recommend">나만의 동선 만들기 ↗</Link></div></Reveal><Reveal className="home-service-row home-service-row--reverse"><div className="home-service-visual home-service-visual--photo"><img src="/images/curated-places-jeonnam-v1.png" alt="전남의 해안 마을과 전통 풍경" loading="lazy" /><span>LOCAL MOMENTS</span></div><div className="home-service-copy"><span>02 · CURATED PLACES</span><h3>취향에 맞는 장소를<br />한 번에 발견하기</h3><p>자연, 맛집, 역사, 바다. 좋아하는 테마를 고르면 전남의 매력적인 장소를 한 화면에 모아볼 수 있어요.</p><Link to="/community">여행 이야기 둘러보기 ↗</Link></div></Reveal></div></section>
    <section className="home-theme-section"><Reveal className="home-section-heading"><p className="home-eyebrow">FROM OUR COMMUNITY</p><h2>오늘의 여행 공유</h2><p>여행 공유 게시글의 제목과 내용에서 자연·바다·맛집·역사를 찾아 최신 기록을 보여드려요.</p></Reveal><div className="home-theme-grid">{sharedThemes.map(({ name, copy, fallback, post, image }, index) => <Link className="home-theme-card" to={post ? `/community/${post.postId || post.id}` : "/community"} key={name}>{image ? <AuthenticatedImage src={image} alt={`${name} 여행 공유`} /> : <img src={fallback} alt={`${name} 여행 풍경`} loading="lazy" />}<div><span>0{index + 1}</span><h3>{name}</h3><p>{copy}</p></div></Link>)}</div></section>
    <section className="home-final-cta"><div className="home-final-cta-photo" aria-hidden="true" /><div className="home-final-cta-overlay" aria-hidden="true" /><Reveal><p className="home-eyebrow">YOUR NEXT JEOLLA</p><h2>이번 여행,<br /><em>어디로 떠날까요?</em></h2><Link className="home-cta-button" to="/recommend">여행 추천 시작하기 <span aria-hidden="true">↗</span></Link></Reveal></section>
  </main>;
}
