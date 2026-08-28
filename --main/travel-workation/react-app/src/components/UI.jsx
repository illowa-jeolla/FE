import { Link } from "react-router-dom";

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

export function Status({ loading, error, empty, children }) {
  if (loading) return <div className="page-status is-visible">데이터를 불러오는 중입니다.</div>;
  if (error) return <div className="page-status is-visible is-error">{error}</div>;
  if (empty) return <div className="page-status is-visible">조건에 맞는 결과가 없습니다.</div>;
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
      <footer><strong>{job.pay || "급여 협의"}</strong><Link to={`/jobs/${job.id}`}>상세 보기 →</Link></footer>
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
  return <div className="page-status is-visible"><strong>{title}</strong><p>{description}</p>{action}</div>;
}

export function FormMessage({ message, error }) {
  if (!message) return null;
  return <p className={`form-message-react${error ? " is-error" : ""}`} role="status">{message}</p>;
}
