import BrandCharacter from "./BrandCharacter";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { externalJobDetailPath } from "../api/jobs";

export function PageIntro({ eyebrow, title, description, action }) {
  return (
    <header className="page-intro">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function Status({ loading, error, empty, children, loadingVariant = "character" }) {
  const [plainPhase, setPlainPhase] = useState(loadingVariant === "plain" && loading ? "loading" : "hidden");
  const hasShownPlainLoading = useRef(loadingVariant === "plain" && loading);

  useEffect(() => {
    if (loadingVariant !== "plain") return undefined;
    if (loading) {
      hasShownPlainLoading.current = true;
      setPlainPhase("loading");
      return undefined;
    }
    if (error || empty) {
      setPlainPhase("hidden");
      return undefined;
    }
    if (!hasShownPlainLoading.current) {
      setPlainPhase("hidden");
      return undefined;
    }
    setPlainPhase("success");
    const leaveTimer = window.setTimeout(() => setPlainPhase("leaving"), 650);
    const hideTimer = window.setTimeout(() => setPlainPhase("hidden"), 910);
    return () => { window.clearTimeout(leaveTimer); window.clearTimeout(hideTimer); };
  }, [loading, loadingVariant, error, empty]);

  if (loadingVariant === "plain" && plainPhase !== "hidden") return <div className={`page-status job-detail-loading is-visible is-${plainPhase}`} role="status">{plainPhase === "loading" ? <i aria-hidden="true" /> : <b aria-hidden="true">✓</b>}<strong>{plainPhase === "loading" ? "LOADING" : "성공"}</strong><span>{plainPhase === "loading" ? "일자리를 불러오는 중입니다." : "일자리를 불러왔습니다."}</span></div>;
  if (loading) return <div className="page-status is-visible" role="status"><BrandCharacter pose="loading" />데이터를 불러오는 중입니다.</div>;
  if (error) return <div className="page-status is-visible is-error" role="alert"><BrandCharacter pose="error" />{error}</div>;
  if (empty) return <div className="page-status is-visible"><BrandCharacter pose="empty" />조건에 맞는 결과가 없습니다.</div>;
  return children;
}

export function JobCard({ job, compact = false }) {
  return (
    <article className={`job-card-react${compact ? " is-compact" : ""}`}>
      <div className="card-label-row"><span>{job.category || "관광 일자리"}</span><b>{job.region}</b></div>
      <h3>{job.title}</h3>
      <p>{job.companyName || job.company_name}</p>
      <div className="chip-row">
        {[job.workType, job.workTime, job.duration].filter(Boolean).map((item) => <span key={item}>{item}</span>)}
      </div>
      <footer><strong>{job.pay || "상세 조건 확인"}</strong><Link to={externalJobDetailPath(job)}>상세 보기 →</Link></footer>
    </article>
  );
}

export function Modal({ open, title, onClose, children, actions }) {
  if (!open) return null;
  return (
    <div className="modal-react" role="presentation">
      <button className="modal-backdrop-react" type="button" aria-label="닫기" onClick={onClose} />
      <section className="modal-dialog-react" role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button type="button" aria-label="닫기" onClick={onClose}>×</button></header>
        <div className="modal-content-react">{children}</div>
        {actions && <footer>{actions}</footer>}
      </section>
    </div>
  );
}

export function EmptyCard({ title, description, action }) {
  return <div className="page-status is-visible"><BrandCharacter pose="empty" /><strong>{title}</strong><p>{description}</p>{action}</div>;
}

export function FormMessage({ message, error }) {
  if (!message) return null;
  return <p className={`form-message-react${error ? " is-error" : ""}`} role="status">{message}</p>;
}
