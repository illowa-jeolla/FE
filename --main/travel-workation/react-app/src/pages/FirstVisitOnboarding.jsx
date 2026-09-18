import { useEffect, useRef, useState } from "react";
import { animate, createScope, createTimeline, stagger } from "animejs";

// To replay the introduction in development: localStorage.removeItem("illowa:onboarding:seen:v1"); location.reload();
export const ONBOARDING_SEEN_KEY = "illowa:onboarding:seen:v1";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function FirstVisitOnboarding({ initialChoice, onSelect }) {
  const root = useRef(null);
  const [showChoice, setShowChoice] = useState(initialChoice);
  const [replay, setReplay] = useState(0);

  function finishIntro() {
    localStorage.setItem(ONBOARDING_SEEN_KEY, "1");
    setShowChoice(true);
  }

  useEffect(() => {
    if (showChoice) {
      if (prefersReducedMotion()) return;
      const animation = animate(root.current, { opacity: [0, 1], y: [10, 0], duration: 380, ease: "out(3)" });
      return () => animation.revert();
    }

    if (prefersReducedMotion()) {
      finishIntro();
      return;
    }

    const scope = createScope({ root }).add(() => {
      const first = root.current.querySelector(".welcome-scene-one");
      const second = root.current.querySelector(".welcome-scene-two");
      const third = root.current.querySelector(".welcome-scene-three");
      createTimeline({ defaults: { ease: "out(3)" }, onComplete: finishIntro })
        .add(first, { opacity: [0, 1], duration: 160 })
        .add(first.querySelector(".welcome-logo"), { opacity: [0, 1], scale: [0.88, 1], duration: 650 }, "<")
        .add(first.querySelector(".welcome-line"), { opacity: [0, 1], y: [16, 0], duration: 540 }, "<+=250")
        .add(first, { opacity: [1, 0], duration: 330, delay: 520 })
        .add(second, { opacity: [0, 1], duration: 180 })
        .add(second.querySelectorAll(".welcome-step"), { opacity: [0, 1], x: [-12, 0], delay: stagger(140), duration: 440 }, "<+=70")
        .add(second.querySelector(".welcome-line"), { opacity: [0, 1], y: [14, 0], duration: 420 }, "<+=460")
        .add(second, { opacity: [1, 0], duration: 330, delay: 540 })
        .add(third, { opacity: [0, 1], duration: 220 })
        .add(third.querySelector(".welcome-final"), { opacity: [0, 1], y: [18, 0], scale: [0.96, 1], duration: 650 }, "<+=80")
        .add(third, { opacity: [1, 0], duration: 300, delay: 680 });
    });
    return () => scope.revert();
  }, [showChoice, replay]);

  function select(mode) {
    if (prefersReducedMotion()) {
      onSelect(mode);
      return;
    }
    animate(root.current, { opacity: [1, 0], y: [0, -8], duration: 260, ease: "in(2)", onComplete: () => onSelect(mode) });
  }

  function replayIntro() {
    localStorage.removeItem(ONBOARDING_SEEN_KEY);
    setShowChoice(false);
    setReplay((value) => value + 1);
  }

  return (
    <main className="welcome-main">
      <section ref={root} className={`welcome-content ${showChoice ? "welcome-choice" : "welcome-intro"}`} aria-label="일로와 전라 소개">
        {showChoice ? (
          <>
            <img className="welcome-choice-logo" src="/mobile-assets/ilowa-jeolla-logo-cropped.png" alt="일로와 전라" />
            <h1>나에게 꼭 맞는 로컬 라이프를 시작해요</h1>
            <p>전라도 여행과 일자리를 한 곳에서 찾아요</p>
            <div className="welcome-choice-actions">
              <button type="button" className="welcome-choice-primary" onClick={() => select("signup")}>처음이신가요?</button>
              <button type="button" className="welcome-choice-secondary" onClick={() => select("login")}>이미 계정이 있습니다</button>
            </div>
            <button type="button" className="welcome-replay" onClick={replayIntro}>소개 다시 보기</button>
          </>
        ) : (
          <>
            <div className="welcome-scenes" aria-live="off">
              <div className="welcome-scene welcome-scene-one">
                <img className="welcome-logo" src="/mobile-assets/ilowa-jeolla-logo-cropped.png" alt="일로와 전라" />
                <p className="welcome-line">전라도에서 새로운 일상을 발견하세요</p>
              </div>
              <div className="welcome-scene welcome-scene-two">
                <div className="welcome-steps">
                  <span className="welcome-step">여행하고</span><span className="welcome-step">머물고</span><span className="welcome-step">일하고</span>
                </div>
                <p className="welcome-line">전라에서 새로운 기회를 찾아보세요</p>
              </div>
              <div className="welcome-scene welcome-scene-three">
                <p className="welcome-final">나에게 꼭 맞는<br />로컬 라이프를 시작해요</p>
              </div>
            </div>
            <button type="button" className="welcome-skip" onClick={finishIntro}>건너뛰기</button>
          </>
        )}
      </section>
    </main>
  );
}
