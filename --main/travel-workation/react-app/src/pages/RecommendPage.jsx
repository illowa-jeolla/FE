import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { mapRegions } from "../data/regions";

const themes = ["자연·힐링", "로컬 미식", "감성 사진", "역사·문화"];
const guideProfiles = [
  { id: "local", name: "김하늘 가이드", specialty: "로컬 명소·산책" },
  { id: "food", name: "박소윤 가이드", specialty: "남도 미식·시장" },
  { id: "culture", name: "이도현 가이드", specialty: "역사·문화 해설" }
];

export default function RecommendPage() {
  const navigate = useNavigate();
  const [selectedThemes, setSelectedThemes] = useState(["자연·힐링", "로컬 미식"]);
  const [hotel, setHotel] = useState("");
  const [hotelOpen, setHotelOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const selectedGuide = guideProfiles.find((guide) => guide.id === values.guideId);
    const conditions = { ...values, themes: selectedThemes, selectedGuide, hotel: values.hotel || `${values.region || "전라도"} 추천 숙소` };
    sessionStorage.setItem("travelGuideConditions", JSON.stringify(conditions));
    navigate("/travel-guide", { state: conditions });
  }

  const hotelSuggestions = ["여수 베네치아 호텔", "순천만 스테이", "군산 근대마을 게스트하우스"];

  return <main className="travel-guide-main react-travel-guide-main">
    <section className="travel-guide-hero"><div><span className="travel-guide-eyebrow">LOCAL TRAVEL GUIDE</span><h1>머무는 곳에서 시작하는<br /><em>가벼운 전라도 여행</em></h1></div></section>
    <form className="travel-search-bar react-guide-search-react" onSubmit={submit}>
      <div className="travel-search-side-heading"><span className="travel-guide-eyebrow">TRIP DETAILS</span><b>여행 조건</b><h2>여행 정보 입력</h2></div>
      <label className="travel-search-field travel-search-region"><span>여행 지역 <small>선택</small></span><div><i className="travel-field-icon travel-field-icon-location" aria-hidden="true" /><input name="region" list="react-region-list" placeholder="전라도 전체" autoComplete="off" /></div></label>
      <datalist id="react-region-list">{mapRegions.map((region) => <option value={region} key={region} />)}</datalist>
      <label className="travel-search-field travel-search-start"><span>출발 <small>선택</small></span><div><i className="travel-field-icon travel-field-icon-calendar" aria-hidden="true" /><input name="start" type="date" value={startDate} onInput={(event) => setStartDate(event.currentTarget.value)} onChange={(event) => setStartDate(event.currentTarget.value)} required /></div></label>
      <label className="travel-search-field travel-search-end"><span>도착 <small>선택</small></span><div><i className="travel-field-icon travel-field-icon-calendar" aria-hidden="true" /><input name="end" type="date" value={endDate} min={startDate || undefined} onInput={(event) => setEndDate(event.currentTarget.value)} onChange={(event) => setEndDate(event.currentTarget.value)} required /></div></label>
      <button className="travel-search-field travel-hotel-trigger" type="button" onClick={() => setHotelOpen(true)}><span>숙소 위치</span><div><i className="travel-field-icon travel-field-icon-hotel" aria-hidden="true" /><strong>{hotel || "숙소 위치 검색하기"}</strong></div></button>
      <input type="hidden" name="hotel" value={hotel} />
      <label className="travel-search-field travel-search-guide"><span>여행 가이드 <small>{startDate && endDate ? "선택" : "날짜 입력 후 선택"}</small></span><div><i className="travel-field-icon travel-field-icon-guide" aria-hidden="true" /><select name="guideId" defaultValue="" disabled={!startDate || !endDate} required><option value="" disabled>가이드를 선택하세요</option>{guideProfiles.map((guide) => <option value={guide.id} key={guide.id}>{guide.name} · {guide.specialty}</option>)}</select></div></label>
      <button className="travel-guide-submit" type="submit">맞춤 여행 추천받기 <span>→</span></button>
      <section className="travel-preferences" aria-labelledby="react-travel-preference-title"><header><div><span className="travel-guide-eyebrow">TRAVEL STYLE</span><h2 id="react-travel-preference-title">어떤 여행을 원하시나요?</h2></div></header><div className="travel-preference-grid">
        <fieldset className="recommend-choice-group recommend-choice-group--theme"><legend><strong>여행 테마</strong><span>여러 개 선택 가능</span></legend><div className="recommend-options">{themes.map((theme) => <label key={theme}><input type="checkbox" name="themes" value={theme} checked={selectedThemes.includes(theme)} onChange={() => setSelectedThemes((current) => current.includes(theme) ? current.filter((item) => item !== theme) : [...current, theme])} /><span>{theme}</span></label>)}</div></fieldset>
        <fieldset className="recommend-choice-group recommend-choice-group--transport"><legend><strong>이동 방식</strong><span>하나 선택</span></legend><div className="recommend-options recommend-options--three">{["대중교통", "자가용", "도보 중심"].map((item, index) => <label key={item}><input type="radio" name="transport" value={item} defaultChecked={index === 0} /><span>{item}</span></label>)}</div></fieldset>
        <fieldset className="recommend-choice-group recommend-choice-group--companion"><legend><strong>누구와 함께</strong><span>하나 선택</span></legend><div className="recommend-options">{["혼자", "연인", "친구", "가족"].map((item) => <label key={item}><input type="radio" name="companion" value={item} defaultChecked={item === "친구"} /><span>{item}</span></label>)}</div></fieldset>
      </div></section>
    </form>
    {hotelOpen && <div className="hotel-search-backdrop" role="presentation"><section className="hotel-search-dialog" role="dialog" aria-modal="true" aria-labelledby="react-hotel-title"><header><div><span className="travel-guide-eyebrow">STAY LOCATION</span><h2 id="react-hotel-title">어디에 머무시나요?</h2></div><button type="button" aria-label="닫기" onClick={() => setHotelOpen(false)}>×</button></header><p>숙소를 기준으로 가까운 관광지와 효율적인 이동 경로를 추천해 드려요.</p><label className="hotel-search-input"><span>⌕</span><input value={hotel} onChange={(event) => setHotel(event.target.value)} placeholder="호텔명 또는 주소를 검색하세요" autoFocus /></label><div className="hotel-search-results react-hotel-results"><small>추천 숙소</small>{hotelSuggestions.map((item) => <button type="button" key={item} onClick={() => { setHotel(item); setHotelOpen(false); }}>{item}<span>선택 →</span></button>)}</div></section></div>}
  </main>;
}
