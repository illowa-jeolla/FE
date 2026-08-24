const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const port = Number(process.env.PORT || 8080);
const root = __dirname;
const reactRoot = path.join(root, "react-dist");
const dbPath = process.env.WORKATION_DB_PATH || path.join(root, "data", "workation.db");

const envPath = path.join(root, ".env");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT,
    title TEXT NOT NULL,
    company_name TEXT,
    work_type TEXT,
    work_time TEXT,
    duration TEXT,
    region TEXT NOT NULL,
    location TEXT,
    pay TEXT,
    detail_url TEXT,
    rating REAL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS destinations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    region TEXT NOT NULL,
    category TEXT,
    description TEXT,
    image_url TEXT,
    search_volume INTEGER NOT NULL DEFAULT 0,
    rating REAL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS region_analysis (
    region TEXT PRIMARY KEY,
    visitor_count INTEGER NOT NULL DEFAULT 0,
    search_volume INTEGER NOT NULL DEFAULT 0,
    average_stay_days REAL,
    interest_index REAL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS local_fit_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    destination_name TEXT NOT NULL,
    region TEXT NOT NULL,
    concept TEXT NOT NULL,
    transport TEXT,
    companion TEXT,
    immersion INTEGER NOT NULL,
    discovery INTEGER NOT NULL,
    convenience INTEGER NOT NULL,
    connection INTEGER NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    region TEXT NOT NULL,
    concept TEXT,
    content TEXT NOT NULL,
    image_data TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS gatherings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    region TEXT NOT NULL,
    location TEXT NOT NULL,
    concept TEXT,
    event_time TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 4,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS gathering_participants (
    gathering_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (gathering_id, user_id),
    FOREIGN KEY (gathering_id) REFERENCES gatherings(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS saved_guides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    region TEXT NOT NULL,
    hotel TEXT,
    guide_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS job_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    job_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, job_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (job_id) REFERENCES jobs(id)
  );

  CREATE TABLE IF NOT EXISTS favorite_jobs (
    user_id INTEGER NOT NULL,
    job_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, job_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (job_id) REFERENCES jobs(id)
  );

  CREATE TABLE IF NOT EXISTS guide_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    guide_id INTEGER NOT NULL,
    region TEXT NOT NULL,
    title TEXT NOT NULL,
    guide_json TEXT NOT NULL,
    rating INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, guide_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_jobs_active_region_created
    ON jobs(active, region, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_destinations_active_search
    ON destinations(active, search_volume DESC, rating DESC, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_destinations_active_region
    ON destinations(active, region);
  CREATE INDEX IF NOT EXISTS idx_local_fit_user_created
    ON local_fit_entries(user_id, created_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_posts_region_created
    ON posts(region, created_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_comments_post_created
    ON comments(post_id, created_at ASC);
  CREATE INDEX IF NOT EXISTS idx_gatherings_region_time
    ON gatherings(region, event_time ASC);
  CREATE INDEX IF NOT EXISTS idx_gathering_participants_gathering
    ON gathering_participants(gathering_id);
  CREATE INDEX IF NOT EXISTS idx_saved_guides_user_created
    ON saved_guides(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_job_applications_user_created
    ON job_applications(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_favorite_jobs_user_created
    ON favorite_jobs(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_guide_reviews_region_created
    ON guide_reviews(region, created_at DESC);
`);

function ensureColumn(table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all()
    .some((entry) => entry.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

ensureColumn("destinations", "transport", "TEXT");
ensureColumn("destinations", "companion", "TEXT");
ensureColumn("destinations", "address", "TEXT");
ensureColumn("destinations", "phone", "TEXT");
ensureColumn("destinations", "opening_hours", "TEXT");
ensureColumn("destinations", "homepage_url", "TEXT");
ensureColumn("destinations", "parking", "TEXT");
ensureColumn("destinations", "latitude", "REAL");
ensureColumn("destinations", "longitude", "REAL");
ensureColumn("destinations", "source_name", "TEXT");
ensureColumn("destinations", "source_id", "TEXT");
ensureColumn("jobs", "job_kind", "TEXT NOT NULL DEFAULT 'general'");
ensureColumn("users", "nickname", "TEXT");
ensureColumn("posts", "is_demo", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("posts", "images_data", "TEXT");
ensureColumn("posts", "hashtags", "TEXT");
ensureColumn("posts", "rating", "REAL");
ensureColumn("posts", "guide_id", "INTEGER");
ensureColumn("guide_reviews", "image_data", "TEXT");
ensureColumn("guide_reviews", "images_data", "TEXT");
ensureColumn("jobs", "map_demo", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("gatherings", "description", "TEXT");
ensureColumn("gatherings", "confirmed", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("saved_guides", "deleted_at", "TEXT");

function seedCommunityDemoData() {
  const existing = db.prepare("SELECT COUNT(*) AS count FROM posts WHERE is_demo = 1").get().count;
  if (existing) return;
  const demoNames = ["남도산책", "바다기록", "골목여행"];
  const userIds = demoNames.map((username) => {
    let user = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
    if (!user) {
      const { hash, salt } = hashPassword(`demo-${username}-1234`);
      const result = db.prepare("INSERT INTO users (username, password_hash, password_salt, nickname) VALUES (?, ?, ?, ?)")
        .run(username, hash, salt, username);
      user = { id: Number(result.lastInsertRowid) };
    }
    return user.id;
  });
  const demos = [
    ["여수", "노을을 품은 드라이브", "창밖으로 번지는 남도 노을을 천천히 따라가 봤어요.", "assets/JvLTt.jpeg", "-38 minutes"],
    ["담양", "정원과 골목 사이", "초록빛 정원과 조용한 골목을 함께 걷기 좋은 오후예요.", "assets/J6aHjc.jpeg", "-1 hours"],
    ["순천", "안개 가득한 아침 풍경", "습지 위로 낮게 내려앉은 안개가 오래 기억에 남아요.", "assets/OZ3bs.jpeg", "-2 hours"],
    ["보성", "초록으로 채운 하루", "녹차밭 능선을 따라 걷다 보면 마음까지 차분해져요.", "assets/bI7WI.jpeg", "-4 hours"],
    ["목포", "유달산 아래 바다 산책", "바다와 오래된 도시 풍경을 한 번에 만난 산책길입니다.", "assets/fVkV4.jpeg", "-6 hours"],
    ["신안", "보랏빛 섬 여행", "색다른 섬 풍경과 해안길을 여유롭게 둘러봤어요.", "assets/lX3GW.jpeg", "-9 hours"],
    ["전주", "한옥마을 저녁 골목", "관광객이 줄어든 저녁의 한옥 골목은 또 다른 분위기예요.", "assets/s6jB4w.jpeg", "-13 hours"],
    ["군산", "시간이 머무는 건물들", "근대 건축과 작은 가게를 천천히 이어 걷는 여행이에요.", "assets/u3OD9c.jpeg", "-18 hours"]
  ];
  const postIds = demos.map((demo, index) => Number(db.prepare(`
    INSERT INTO posts (user_id, region, concept, content, image_data, created_at, is_demo)
    VALUES (?, ?, ?, ?, ?, datetime('now', ?), 1)
  `).run(userIds[index % userIds.length], ...demo).lastInsertRowid));
  const comment = db.prepare("INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, datetime('now', '-10 minutes'))");
  comment.run(postIds[0], userIds[1], "노을 색감이 정말 좋네요!");
  comment.run(postIds[1], userIds[2], "다음 담양 여행 때 가보고 싶어요.");
  comment.run(postIds[3], userIds[0], "초록 풍경이 시원해 보여요.");
  comment.run(postIds[6], userIds[1], "저녁 골목 분위기가 궁금해요.");
}

seedCommunityDemoData();

function seedMapDemoData() {
  const regions = ["전주", "군산", "남원", "목포", "광주", "순천", "여수", "보성", "완도"];
  const companies = { 전주: "전주한옥스테이", 군산: "군산시간여행협동조합", 남원: "남원관광문화센터", 목포: "목포해양관광", 광주: "광주로컬콘텐츠랩", 순천: "순천만생태여행", 여수: "여수오션리조트", 보성: "보성녹차마을", 완도: "완도해양치유센터" };
  if (!db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE map_demo = 1").get().count) {
    const insertJob = db.prepare(`INSERT INTO jobs (category, title, company_name, work_type, work_time, duration, region, location, pay, rating, job_kind, active, map_demo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'tourism', 1, 1)`);
    regions.forEach((region, index) => {
      insertJob.run("관광 운영", `${region} 여행 프로그램 운영 매니저`, companies[region], "주 5일", "09:00~18:00", "3개월 이상", region, `${region} 관광 생활권`, "월 230만원", 4.5 + (index % 4) * 0.1);
      insertJob.run("콘텐츠·서비스", `${region} 로컬 콘텐츠·고객 응대 스태프`, companies[region], "주 3~4일", "시간 협의", "1개월 이상", region, `${region} 주요 관광지 인근`, "시급 12,000원", 4.3 + (index % 3) * 0.2);
    });
  }
  const reviewer = db.prepare("SELECT id FROM users WHERE username = '남도산책'").get();
  if (!reviewer) return;
  const images = ["assets/s6jB4w.jpeg", "assets/u3OD9c.jpeg", "assets/J6aHjc.jpeg"];
  const insertReview = db.prepare(`INSERT INTO posts (user_id, region, concept, content, image_data, created_at, is_demo, hashtags) VALUES (?, ?, ?, ?, ?, datetime('now', '-5 hours'), 1, ?)`);
  regions.forEach((region, index) => {
    if (!db.prepare("SELECT 1 FROM posts WHERE region = ? LIMIT 1").get(region)) insertReview.run(reviewer.id, region, `${region} 로컬 여행 후기`, `${region}의 관광지와 골목을 천천히 둘러봤어요. 이동 동선이 편하고 지역 분위기를 가까이에서 느끼기 좋았습니다.`, images[index % images.length], JSON.stringify([region, "로컬여행", "여행후기"]));
  });
}

seedMapDemoData();

const sessions = new Map();
const reviewSummaryCache = new Map();

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  });
  response.end(JSON.stringify(data));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 8_000_000) request.destroy();
    });
    request.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); }
      catch { reject(new Error("올바른 JSON 형식이 아닙니다.")); }
    });
    request.on("error", reject);
  });
}

function responseText(payload) {
  if (typeof payload.output_text === "string") return payload.output_text.trim();
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) return content.text.trim();
    }
  }
  return "";
}

async function generateAiText({ instructions, input, fallback, maxOutputTokens = 220 }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { text: fallback, aiEnabled: false, error: "OPENAI_API_KEY가 설정되지 않았습니다." };
  const models = [...new Set([process.env.OPENAI_MODEL || "gpt-5.6-terra", "chat-latest"] )];
  let lastError = "OpenAI API 요청 실패";

  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    try {
      const apiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          instructions,
          input,
          reasoning: { effort: "low" },
          text: { verbosity: "low" },
          max_output_tokens: maxOutputTokens,
          store: false
        }),
        signal: controller.signal
      });
      const payload = await apiResponse.json().catch(() => ({}));
      if (!apiResponse.ok) {
        lastError = payload.error?.message || `OpenAI API 오류 (${apiResponse.status})`;
        console.error(`OpenAI API (${model}):`, lastError);
        if ([401, 403, 429].includes(apiResponse.status)) break;
        continue;
      }
      const text = responseText(payload);
      if (text) return { text, aiEnabled: true, model };
      lastError = "AI가 빈 답변을 반환했습니다.";
    } catch (error) {
      lastError = error.name === "AbortError" ? "AI 답변 제한 시간(90초)을 초과했습니다." : error.message;
      console.error(`OpenAI API (${model}):`, lastError);
    } finally {
      clearTimeout(timeout);
    }
  }

  return { text: fallback, aiEnabled: false, error: lastError };
}

async function generateAiTravelGuide(conditions) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  const model = process.env.OPENAI_MODEL || "gpt-5.6-terra";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        instructions: `당신은 대한민국 전라도 전문 여행 플래너입니다. 반드시 웹 검색으로 현재 실제 운영 중인 관광지와 숙소 위치를 확인하세요. 공식 관광 사이트, 지자체, 한국관광공사 등 신뢰할 수 있는 최신 출처를 우선 사용하세요. 사용자가 숙소를 입력하면 그 숙소의 실제 위치를 기준으로 가까운 관광지 5곳을 고르고, 이동 거리와 방향을 고려해 불필요한 왕복이 적은 순서로 배열하세요. 숙소가 없으면 입력 지역의 중심 관광 거점에서 시작하세요. excludedSpots에 장소가 있으면 가능한 한 제외해 이전 추천과 다른 코스를 만드세요. 폐업 여부나 위치를 확인할 수 없는 장소는 제외하세요. 각 장소의 imageUrl에는 공식 관광 사이트나 신뢰할 수 있는 공개 페이지에서 확인한 실제 장소 사진의 직접 HTTPS 이미지 주소를 넣고, 확인할 수 없으면 빈 문자열을 넣으세요. 거리와 시간은 합리적인 추정치임을 tip에 밝히세요. 정확히 5곳을 반환하고 위경도는 숫자로 반환하세요.`,
        input: JSON.stringify(conditions),
        tools: [{ type: "web_search" }],
        reasoning: { effort: "low" },
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "travel_guide",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["region", "hotel", "summary", "totalDistanceKm", "totalMinutes", "tip", "spots"],
              properties: {
                region: { type: "string" },
                hotel: {
                  type: "object", additionalProperties: false,
                  required: ["name", "address", "latitude", "longitude"],
                  properties: { name: { type: "string" }, address: { type: "string" }, latitude: { type: "number" }, longitude: { type: "number" } }
                },
                summary: { type: "string" }, totalDistanceKm: { type: "number" }, totalMinutes: { type: "number" }, tip: { type: "string" },
                spots: {
                  type: "array", minItems: 5, maxItems: 5,
                  items: {
                    type: "object", additionalProperties: false,
                    required: ["name", "address", "category", "description", "time", "stayMinutes", "latitude", "longitude", "distanceFromPreviousKm", "travelMinutes", "sourceTitle", "sourceUrl", "imageUrl"],
                    properties: {
                      name: { type: "string" }, address: { type: "string" }, category: { type: "string" }, description: { type: "string" }, time: { type: "string" },
                      stayMinutes: { type: "number" }, latitude: { type: "number" }, longitude: { type: "number" }, distanceFromPreviousKm: { type: "number" }, travelMinutes: { type: "number" },
                      sourceTitle: { type: "string" }, sourceUrl: { type: "string" }, imageUrl: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        },
        max_output_tokens: 3600,
        store: false
      }),
      signal: controller.signal
    });
    const payload = await apiResponse.json().catch(() => ({}));
    if (!apiResponse.ok) throw new Error(payload.error?.message || `OpenAI API 오류 (${apiResponse.status})`);
    const cleaned = responseText(payload).replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const guide = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
    if (!Array.isArray(guide.spots) || guide.spots.length !== 5) throw new Error("AI가 관광지 5곳을 반환하지 않았습니다.");
    guide.spots = guide.spots.map((spot) => ({
      name: String(spot.name || "").trim(),
      address: String(spot.address || "").trim(),
      category: String(spot.category || "관광 · 여행").trim(),
      description: String(spot.description || "").trim(),
      time: String(spot.time || "").trim(),
      stayMinutes: Math.max(20, Math.min(360, Number(spot.stayMinutes) || 60)),
      latitude: Number(spot.latitude), longitude: Number(spot.longitude),
      distanceFromPreviousKm: Math.max(0, Number(spot.distanceFromPreviousKm) || 0),
      travelMinutes: Math.max(0, Number(spot.travelMinutes) || 0),
      sourceTitle: String(spot.sourceTitle || "정보 출처").trim(),
      sourceUrl: /^https?:\/\//.test(String(spot.sourceUrl || "")) ? String(spot.sourceUrl) : "",
      imageUrl: /^https:\/\//.test(String(spot.imageUrl || "")) ? String(spot.imageUrl) : ""
    }));
    if (guide.spots.some((spot) => !spot.name || !Number.isFinite(spot.latitude) || !Number.isFinite(spot.longitude))) throw new Error("관광지 위치 정보를 확인하지 못했습니다.");
    guide.totalMinutes = guide.spots.reduce((total, spot) => total + spot.stayMinutes + spot.travelMinutes, 0);
    guide.totalDistanceKm = Number(guide.spots.reduce((total, spot) => total + spot.distanceFromPreviousKm, 0).toFixed(1));
    guide.hotel = {
      name: String(guide.hotel?.name || conditions.hotel || "추천 출발지").trim(),
      address: String(guide.hotel?.address || "").trim(),
      latitude: Number(guide.hotel?.latitude), longitude: Number(guide.hotel?.longitude)
    };
    return { ...guide, aiEnabled: true, model };
  } catch (error) {
    if (error.name === "AbortError") throw new Error("여행지 검색 시간이 초과되었습니다. 다시 시도해 주세요.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

const gatheringConceptCache = new Map();
const gatheringConceptGroups = [
  ["펍", "술", "술집", "맥주", "와인", "바", "칵테일", "포차", "회식"],
  ["맛집", "미식", "식사", "음식", "먹방", "디저트", "카페", "커피"],
  ["산책", "걷기", "트레킹", "등산", "하이킹", "둘레길", "야경"],
  ["전시", "미술", "예술", "공연", "뮤지컬", "영화", "문화"],
  ["사진", "촬영", "포토", "인생샷"],
  ["바다", "해변", "해수욕", "서핑", "요트", "낚시"],
  ["친목", "교류", "네트워킹", "파티", "수다", "모임"],
  ["러닝", "달리기", "운동", "자전거", "라이딩", "요가"]
];

function normalizedConcept(value) {
  return String(value || "").toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

function editDistance(left, right) {
  const a = normalizedConcept(left);
  const b = normalizedConcept(right);
  if (!a) return b.length;
  if (!b) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

function fallbackGatheringIds(query, gatherings) {
  const normalizedQuery = normalizedConcept(query);
  const relatedWords = new Set([normalizedQuery]);
  for (const group of gatheringConceptGroups) {
    if (group.some((word) => normalizedQuery.includes(normalizedConcept(word)) || editDistance(normalizedQuery, word) <= 1)) {
      group.forEach((word) => relatedWords.add(normalizedConcept(word)));
    }
  }
  return gatherings.map((gathering) => {
    const searchable = normalizedConcept(`${gathering.title} ${gathering.concept} ${gathering.location} ${gathering.description}`);
    let score = [...relatedWords].some((word) => word && searchable.includes(word)) ? 10 : 0;
    const candidates = [gathering.concept, gathering.title].flatMap((value) => String(value || "").split(/\s+/)).filter(Boolean);
    for (const candidate of candidates) {
      const normalizedCandidate = normalizedConcept(candidate);
      const longest = Math.max(normalizedQuery.length, normalizedCandidate.length);
      if (longest && 1 - editDistance(normalizedQuery, normalizedCandidate) / longest >= 0.58) score = Math.max(score, 6);
    }
    return { id: gathering.id, score };
  }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score).map((entry) => entry.id);
}

async function selectGatheringsByConcept(query, gatherings) {
  if (!query || !gatherings.length) return gatherings;
  const fallbackIds = fallbackGatheringIds(query, gatherings);
  const cacheKey = `${normalizedConcept(query)}:${gatherings.map((item) => `${item.id}:${item.title}:${item.concept}`).join("|")}`;
  let selectedIds = gatheringConceptCache.get(cacheKey);
  if (!selectedIds) {
    const ai = process.env.ENABLE_GATHERING_AI === "true"
      ? await generateAiText({
        instructions: "사용자가 찾는 게더링 콘셉트와 의미가 같거나 자연스럽게 연결되는 후보만 고르세요. 오타, 띄어쓰기, 동의어, 상위·하위 활동을 고려하세요. 후보에 없는 ID를 만들지 마세요. 설명 없이 관련도 높은 순서의 숫자 ID만 쉼표로 반환하세요. 관련 후보가 전혀 없으면 빈 문자열을 반환하세요.",
        input: JSON.stringify({ query, candidates: gatherings.map(({ id, title, concept, location, description }) => ({ id, title, concept, location, description })) }),
        fallback: fallbackIds.join(","),
        maxOutputTokens: 100
      })
      : { text: fallbackIds.join(","), aiEnabled: false };
    const validIds = new Set(gatherings.map((item) => Number(item.id)));
    selectedIds = [...new Set(String(ai.text || "").match(/\d+/g)?.map(Number) || [])].filter((id) => validIds.has(id));
    if (!selectedIds.length && fallbackIds.length) selectedIds = fallbackIds;
    gatheringConceptCache.set(cacheKey, selectedIds);
    if (gatheringConceptCache.size > 100) gatheringConceptCache.delete(gatheringConceptCache.keys().next().value);
  }
  const byId = new Map(gatherings.map((item) => [Number(item.id), item]));
  return selectedIds.map((id) => byId.get(id)).filter(Boolean);
}

function attachGatheringParticipants(gatherings) {
  if (!gatherings.length) return gatherings;
  const placeholders = gatherings.map(() => "?").join(",");
  const participants = db.prepare(`
    SELECT gathering_participants.gathering_id AS gatheringId,
           COALESCE(users.nickname, users.username) AS nickname
    FROM gathering_participants JOIN users ON users.id = gathering_participants.user_id
    WHERE gathering_participants.gathering_id IN (${placeholders})
    ORDER BY gathering_participants.created_at ASC
  `).all(...gatherings.map((item) => item.id));
  const grouped = new Map();
  for (const participant of participants) {
    const names = grouped.get(participant.gatheringId) || [];
    names.push(participant.nickname);
    grouped.set(participant.gatheringId, names);
  }
  for (const gathering of gatherings) gathering.participants = grouped.get(gathering.id) || [];
  return gatherings;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(password, user) {
  const saved = Buffer.from(user.password_hash, "hex");
  const entered = Buffer.from(hashPassword(password, user.password_salt).hash, "hex");
  return saved.length === entered.length && crypto.timingSafeEqual(saved, entered);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getAuthenticatedUser(request) {
  const authorization = request.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const userId = sessions.get(token);
  return userId
    ? db.prepare("SELECT id, username, nickname FROM users WHERE id = ?").get(userId)
    : null;
}

function requireUser(request, response) {
  const user = getAuthenticatedUser(request);
  if (!user) sendJson(response, 401, { message: "로그인이 필요한 기능입니다." });
  return user;
}

function mapJob(job) {
  return {
    id: job.id,
    category: job.category,
    title: job.title,
    companyName: job.company_name,
    workType: job.work_type,
    workTime: job.work_time,
    duration: job.duration,
    region: job.region,
    location: job.location,
    pay: job.pay,
    detailUrl: job.detail_url,
    rating: job.rating,
    jobKind: job.job_kind || "general"
  };
}

function getJobs(searchParams) {
  const filters = {
    region: searchParams.get("region"),
    duration: searchParams.get("duration"),
    work_type: searchParams.get("workType"),
    work_time: searchParams.get("time")
  };
  const entries = Object.entries(filters).filter(([, value]) => value);
  const where = entries.map(([column]) => `${column} = ?`).join(" AND ");
  const sql = `SELECT * FROM jobs WHERE active = 1${where ? ` AND ${where}` : ""} ORDER BY created_at DESC`;

  return db.prepare(sql).all(...entries.map(([, value]) => value)).map(mapJob);
}

function mapDestination(destination) {
  return {
    id: destination.id,
    name: destination.name,
    region: destination.region,
    category: destination.category,
    description: destination.description,
    imageUrl: destination.image_url,
    searchVolume: destination.search_volume,
    rating: destination.rating,
    transport: destination.transport,
    companion: destination.companion,
    address: destination.address,
    phone: destination.phone,
    openingHours: destination.opening_hours,
    homepageUrl: destination.homepage_url,
    parking: destination.parking,
    latitude: destination.latitude,
    longitude: destination.longitude,
    sourceName: destination.source_name,
    sourceId: destination.source_id
  };
}

function normalizedList(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
    : [];
}

function localFitScore(entry) {
  return Math.round((
    entry.immersion
    + entry.discovery
    + entry.convenience
    + entry.connection
  ) / 4 * 20);
}

function localFitMatchScore({ body, priorities, candidateJobs, candidatePlaces }) {
  let score = 60;
  const requestedRegion = String(body.region || "").trim();
  const concept = String(body.concept || "").trim().toLowerCase();
  const conceptTokens = concept.split(/[\s,./·]+/).filter((token) => token.length >= 2);
  const jobText = candidateJobs
    .map((job) => `${job.title || ""} ${job.company_name || ""} ${job.work_type || ""}`.toLowerCase())
    .join(" ");

  if (candidatePlaces.some((place) => requestedRegion.includes("전체") || String(place.region).includes(requestedRegion))) score += 8;
  else if (candidatePlaces.length) score += 3;

  if (candidateJobs.length) score += 3;
  score += Math.min(8, conceptTokens.filter((token) => jobText.includes(token)).length * 4);
  score += Math.min(12, priorities.length * 3);

  if (String(body.destinationName || "").trim().length >= 4) score += 3;
  const noteLength = String(body.note || "").trim().length;
  if (noteLength >= 10) score += 4;
  else if (noteLength >= 3) score += 2;

  score += Math.min(6, candidatePlaces.length * 2);
  const ratings = [...candidateJobs, ...candidatePlaces]
    .map((item) => Number(item.rating))
    .filter(Number.isFinite);
  if (ratings.length) {
    const averageRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    score += Math.max(0, Math.min(4, Math.round((averageRating - 3) * 2)));
  }

  return Math.max(60, Math.min(95, Math.round(score)));
}

async function handleApi(request, response, url) {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/ai/status") {
    sendJson(response, 200, {
      configured: Boolean(process.env.OPENAI_API_KEY),
      model: process.env.OPENAI_MODEL || "gpt-5.6-terra"
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/stats") {
    const jobStats = db.prepare(`
      SELECT COUNT(*) AS jobCount,
             COUNT(DISTINCT region) AS regionCount,
             ROUND(AVG(rating), 1) AS averageRating
      FROM jobs WHERE active = 1
    `).get();
    const destinationStats = db.prepare(`
      SELECT COUNT(DISTINCT region) AS regionCount,
             ROUND(AVG(rating), 1) AS averageRating
      FROM destinations WHERE active = 1
    `).get();
    sendJson(response, 200, {
      jobCount: jobStats.jobCount,
      regionCount: Math.max(jobStats.regionCount, destinationStats.regionCount),
      averageRating: destinationStats.averageRating ?? jobStats.averageRating
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/destinations") {
    const region = String(url.searchParams.get("region") || "").trim();
    const destinations = region
      ? db.prepare(`
          SELECT * FROM destinations
          WHERE active = 1 AND region = ?
          ORDER BY search_volume DESC, rating DESC, created_at DESC
        `).all(region)
      : db.prepare(`
          SELECT * FROM destinations
          WHERE active = 1
          ORDER BY search_volume DESC, rating DESC, created_at DESC
        `).all();
    sendJson(response, 200, destinations.map(mapDestination));
    return true;
  }

  const destinationDetailMatch = url.pathname.match(/^\/api\/destinations\/(\d+)$/);
  if (request.method === "GET" && destinationDetailMatch) {
    const destination = db.prepare("SELECT * FROM destinations WHERE id = ? AND active = 1")
      .get(Number(destinationDetailMatch[1]));
    if (!destination) {
      sendJson(response, 404, { message: "관광지를 찾을 수 없습니다." });
      return true;
    }
    sendJson(response, 200, mapDestination(destination));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/destinations/trending") {
    const requestedLimit = Number(url.searchParams.get("limit") || 6);
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 20)
      : 6;
    const destinations = db.prepare(`
      SELECT * FROM destinations
      WHERE active = 1
      ORDER BY search_volume DESC, rating DESC, created_at DESC
      LIMIT ?
    `).all(limit).map(mapDestination);
    sendJson(response, 200, destinations);
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/travel-guide") {
    const body = await readJson(request);
    const requestedRegion = String(body.region || "").trim().slice(0, 80);
    const randomRegions = ["여수", "순천", "목포", "전주", "광주", "군산", "남원", "담양", "해남", "보성", "완도"];
    const selectedRegion = !requestedRegion || requestedRegion.includes("전체")
      ? randomRegions[Math.floor(Math.random() * randomRegions.length)]
      : requestedRegion;
    const conditions = {
      region: selectedRegion,
      hotel: String(body.hotel || "").trim().slice(0, 160),
      start: String(body.start || "").trim().slice(0, 10),
      end: String(body.end || "").trim().slice(0, 10),
      themes: normalizedList(body.themes).slice(0, 6),
      transport: String(body.transport || "대중교통").trim().slice(0, 40),
      companion: String(body.companion || "친구").trim().slice(0, 40),
      attempt: Math.max(1, Math.min(3, Number(body.attempt) || 1)),
      excludedSpots: normalizedList(body.excludedSpots).slice(0, 10)
    };
    try {
      const guide = await generateAiTravelGuide(conditions);
      sendJson(response, 200, guide);
    } catch (error) {
      console.error("여행 가이드 생성:", error.message);
      sendJson(response, 502, { message: error.message || "실제 관광지 정보를 검색하지 못했습니다." });
    }
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/destinations/recommend") {
    const body = await readJson(request);
    const themes = normalizedList(body.themes);
    const transports = normalizedList(body.transports);
    const companions = normalizedList(body.companions);
    const retry = Math.min(Math.max(Number(body.retry) || 0, 0), 2);
    if (!themes.length || !transports.length || !companions.length) {
      sendJson(response, 400, { message: "테마, 교통, 동행 유형을 각각 하나 이상 선택해 주세요." });
      return true;
    }

    const conditions = [];
    const values = [];
    if (String(body.region || "").trim()) {
      conditions.push("region = ?");
      values.push(String(body.region).trim());
    }
    conditions.push(`(${themes.map(() => "category LIKE ?").join(" OR ")})`);
    values.push(...themes.map((theme) => `%${theme}%`));
    conditions.push(`(COALESCE(transport, '') = '' OR ${transports.map(() => "transport LIKE ?").join(" OR ")})`);
    values.push(...transports.map((transport) => `%${transport}%`));
    conditions.push(`(COALESCE(companion, '') = '' OR ${companions.map(() => "companion LIKE ?").join(" OR ")})`);
    values.push(...companions.map((companion) => `%${companion}%`));

    const destinations = db.prepare(`
      SELECT * FROM destinations
      WHERE active = 1 AND ${conditions.join(" AND ")}
      ORDER BY search_volume DESC, rating DESC, created_at DESC
      LIMIT 3 OFFSET ?
    `).all(...values, retry * 3).map(mapDestination);

    const fallbackPrompt = `${companions.join(", ")}과 함께 ${transports.join(", ")}으로 이동하며 즐기는 ${themes.join(", ")} 중심의 전라도 여행이에요.`;
    const ai = await generateAiText({
      instructions: "당신은 전라도 관광 큐레이터입니다. 제공된 취향과 후보 관광지만 사용해 추천 이유를 자연스러운 한국어 2문장으로 작성하세요. 과장하거나 없는 정보를 만들지 마세요.",
      input: JSON.stringify({ themes, transports, companions, destinations: destinations.map(({ name, region, category, description, rating }) => ({ name, region, category, description, rating })) }),
      fallback: fallbackPrompt
    });

    sendJson(response, 200, {
      prompt: ai.text,
      aiEnabled: ai.aiEnabled,
      retry,
      maxRetries: 2,
      destinations
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/regions/analysis") {
    const region = (url.searchParams.get("region") || "").trim();
    if (!region) {
      sendJson(response, 400, { message: "분석할 지역을 선택해 주세요." });
      return true;
    }

    const analysis = db.prepare("SELECT * FROM region_analysis WHERE region = ?").get(region);
    if (!analysis) {
      sendJson(response, 404, { message: `${region}에 등록된 지역 분석 데이터가 없습니다.` });
      return true;
    }

    const jobCount = db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE active = 1 AND region = ?").get(region).count;
    const destinationCount = db.prepare("SELECT COUNT(*) AS count FROM destinations WHERE active = 1 AND region = ?").get(region).count;
    sendJson(response, 200, {
      region: analysis.region,
      visitorCount: analysis.visitor_count,
      searchVolume: analysis.search_volume,
      averageStayDays: analysis.average_stay_days,
      interestIndex: analysis.interest_index,
      jobCount,
      destinationCount,
      updatedAt: analysis.updated_at
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/courses/recommend") {
    const {
      region = "",
      duration = "당일",
      interest = "",
      transport = "대중교통"
    } = await readJson(request);
    const durationLimits = { "당일": 3, "1주": 5, "1개월": 7 };
    if (!durationLimits[duration]) {
      sendJson(response, 400, { message: "지원하지 않는 여행 기간입니다." });
      return true;
    }

    const conditions = [];
    const values = [];
    if (String(region).trim()) {
      conditions.push("region = ?");
      values.push(String(region).trim());
    }
    if (String(interest).trim()) {
      conditions.push("category = ?");
      values.push(String(interest).trim());
    }
    const where = conditions.length ? ` AND ${conditions.join(" AND ")}` : "";
    const course = db.prepare(`
      SELECT * FROM destinations
      WHERE active = 1${where}
      ORDER BY search_volume DESC, rating DESC, created_at DESC
      LIMIT ?
    `).all(...values, durationLimits[duration]).map(mapDestination);

    sendJson(response, 200, {
      conditions: {
        region: String(region).trim(),
        duration,
        interest: String(interest).trim(),
        transport: String(transport).trim()
      },
      course
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/jobs") {
    sendJson(response, 200, getJobs(url.searchParams));
    return true;
  }

  const jobDetailMatch = url.pathname.match(/^\/api\/jobs\/(\d+)$/);
  if (request.method === "GET" && jobDetailMatch) {
    const job = db.prepare("SELECT * FROM jobs WHERE id = ? AND active = 1").get(Number(jobDetailMatch[1]));
    if (!job) {
      sendJson(response, 404, { message: "일자리 정보를 찾을 수 없습니다." });
      return true;
    }
    sendJson(response, 200, mapJob(job));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/regions/summary") {
    const region = (url.searchParams.get("region") || "").trim();
    if (!region) {
      sendJson(response, 400, { message: "지역을 선택해 주세요." });
      return true;
    }
    const destination = db.prepare(`
      SELECT COUNT(*) AS destinationCount,
             COALESCE(ROUND(AVG(rating), 1), 0) AS averageRating
      FROM destinations WHERE active = 1 AND region = ?
    `).get(region);
    const reviewStats = db.prepare("SELECT COUNT(*) AS count, ROUND(AVG(rating), 1) AS averageRating FROM guide_reviews WHERE region = ?").get(region);
    const reviews = db.prepare(`
      SELECT guide_reviews.id, guide_reviews.title AS concept, guide_reviews.content, guide_reviews.rating, guide_reviews.image_data AS imageData, guide_reviews.images_data AS imagesData, guide_reviews.created_at, users.username,
             COALESCE(users.nickname, users.username) AS nickname
      FROM guide_reviews JOIN users ON users.id = guide_reviews.user_id
      WHERE guide_reviews.region = ?
      ORDER BY guide_reviews.created_at DESC, guide_reviews.id DESC
      LIMIT 5
    `).all(region);
    for (const review of reviews) {
      try { review.images = JSON.parse(review.imagesData || "[]"); } catch { review.images = review.imageData ? [review.imageData] : []; }
      delete review.imagesData;
    }
    sendJson(response, 200, {
      region,
      destinationCount: destination.destinationCount,
      averageRating: Number(reviewStats.averageRating ?? destination.averageRating ?? 0),
      reviewCount: Number(reviewStats.count || 0),
      reviews
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/jobs/recommend") {
    const source = url.searchParams.get("source") || "region";
    let region = (url.searchParams.get("region") || "").trim();
    if (source === "local-fit") {
      const user = requireUser(request, response);
      if (!user) return true;
      const latest = db.prepare(`
        SELECT region FROM local_fit_entries
        WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 1
      `).get(user.id);
      if (!latest) {
        sendJson(response, 404, { message: "먼저 로컬 핏 여행 기록을 등록해 주세요." });
        return true;
      }
      region = latest.region;
    }
    if (!region) {
      sendJson(response, 400, { message: "추천 기준 지역을 선택해 주세요." });
      return true;
    }

    const filters = new URLSearchParams({ region });
    for (const key of ["duration", "workType", "time"]) {
      const value = url.searchParams.get(key);
      if (value) filters.set(key, value);
    }
    const allJobs = getJobs(filters);
    const shortJobs = allJobs.filter((job) => {
      const searchable = `${job.category || ""} ${job.title || ""}`;
      return job.jobKind === "short" || /(행사|축제|팝업|단기)/.test(searchable);
    });
    const selected = shortJobs.length ? shortJobs : allJobs;
    sendJson(response, 200, {
      region,
      source,
      recommendationType: shortJobs.length ? "short" : "general",
      jobs: selected
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/local-fit") {
    const user = requireUser(request, response);
    if (!user) return true;
    const entries = db.prepare(`
      SELECT * FROM local_fit_entries
      WHERE user_id = ? ORDER BY created_at DESC, id DESC
    `).all(user.id).map((entry) => ({ ...entry, score: localFitScore(entry) }));
    const averageScore = entries.length
      ? Math.round(entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length)
      : null;
    sendJson(response, 200, { entries, averageScore });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/local-fit") {
    const user = requireUser(request, response);
    if (!user) return true;
    const body = await readJson(request);
    const priorities = normalizedList(body.priorities);
    const metrics = ["immersion", "discovery", "convenience", "connection"]
      .map((key) => Number(body[key]));
    if (!body.destinationName || !body.region || !body.concept
      || metrics.some((value) => !Number.isInteger(value) || value < 1 || value > 5)) {
      sendJson(response, 400, { message: "여행지, 지역, 콘셉트와 네 가지 점수를 모두 입력해 주세요." });
      return true;
    }
    const result = db.prepare(`
      INSERT INTO local_fit_entries (
        user_id, destination_name, region, concept, transport, companion,
        immersion, discovery, convenience, connection, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      String(body.destinationName).trim(),
      String(body.region).trim(),
      String(body.concept).trim(),
      String(body.transport || "").trim(),
      String(body.companion || "").trim(),
      ...metrics,
      String(body.note || "").trim()
    );
    const entry = db.prepare("SELECT * FROM local_fit_entries WHERE id = ?").get(result.lastInsertRowid);
    const requestedRegion = String(body.region || "").trim();
    const useAllRegions = requestedRegion.includes("전체");
    const candidateJobs = useAllRegions
      ? db.prepare("SELECT title, company_name, region, work_type, rating FROM jobs WHERE active = 1 ORDER BY rating DESC LIMIT 4").all()
      : db.prepare("SELECT title, company_name, region, work_type, rating FROM jobs WHERE active = 1 AND region LIKE ? ORDER BY rating DESC LIMIT 4").all(`%${requestedRegion}%`);
    const candidatePlaces = useAllRegions
      ? db.prepare("SELECT name, region, category, description, image_url, rating FROM destinations WHERE active = 1 ORDER BY rating DESC LIMIT 4").all()
      : db.prepare("SELECT name, region, category, description, image_url, rating FROM destinations WHERE active = 1 AND region LIKE ? ORDER BY rating DESC LIMIT 4").all(`%${requestedRegion}%`);
    const fallbackJob = db.prepare("SELECT title, company_name, region, work_type, rating FROM jobs WHERE active = 1 ORDER BY rating DESC LIMIT 1").get();
    const fallbackPlace = db.prepare("SELECT name, region, category, description, image_url, rating FROM destinations WHERE active = 1 ORDER BY rating DESC LIMIT 1").get();
    const recommendedJob = candidateJobs[0] || fallbackJob || null;
    const recommendedPlace = candidatePlaces[0] || fallbackPlace || null;
    const nearbyPlaces = (candidatePlaces.length ? candidatePlaces : (recommendedPlace ? [recommendedPlace] : [])).slice(0, 3);
    const score = localFitMatchScore({ body, priorities, candidateJobs, candidatePlaces });
    const fallbackResidence = {
      residenceName: recommendedPlace ? `${recommendedPlace.region} ${recommendedPlace.name} 인근 생활권` : `${body.region} 추천 생활권`,
      reason: recommendedPlace?.description || `${body.concept} 관심사와 선택한 생활 우선순위를 함께 비교해 고른 지역입니다.`,
      advantages: priorities.length ? priorities.slice(0, 3) : ["생활 편의", "일자리 접근", "관광 접근"],
      caution: "실제 주거비와 이동 시간은 계약 전에 다시 확인해 주세요.",
      summary: `${body.region}에서 생활 조건과 일자리, 관광 접근성을 함께 만족하는 정착 후보를 골랐어요.`
    };
    const ai = await generateAiText({
      instructions: `당신은 전라도 정착과 워케이션을 돕는 전문 지역 매칭 상담가입니다. 사용자의 모든 조건(희망 생활권, 선호 지역, 관심 일자리, 생활 우선순위, 체류 조건)과 제공된 실제 관광지·일자리 후보를 빠짐없이 비교하세요. 가장 적합한 거주지는 시·군보다 상세한 읍·면·동 또는 관광지 인근 생활권 단위로 제안하세요. 왜 이 거주지를 골랐는지, 사용자가 체감할 생활 장점, 확인할 점을 구체적으로 설명하세요. 제공되지 않은 교통시간·가격·시설명 같은 사실은 만들어내지 마세요. 반드시 마크다운 없이 다음 JSON만 출력하세요: {"residenceName":"상세 거주지역","reason":"선정 이유 2~3문장","advantages":["장점1","장점2","장점3"],"caution":"생활 전 확인할 점 1문장","summary":"전체 매칭 요약 2문장"}`,
      input: JSON.stringify({ conditions: { ...body, priorities }, score, candidateJobs, candidatePlaces }),
      fallback: JSON.stringify(fallbackResidence),
      maxOutputTokens: 520
    });
    let aiResidence = fallbackResidence;
    try {
      const cleaned = ai.text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
      const jsonStart = cleaned.indexOf("{");
      const jsonEnd = cleaned.lastIndexOf("}");
      const parsed = JSON.parse(jsonStart >= 0 && jsonEnd > jsonStart ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned);
      aiResidence = {
        residenceName: String(parsed.residenceName || fallbackResidence.residenceName).trim(),
        reason: String(parsed.reason || fallbackResidence.reason).trim(),
        advantages: normalizedList(parsed.advantages).slice(0, 3),
        caution: String(parsed.caution || fallbackResidence.caution).trim(),
        summary: String(parsed.summary || fallbackResidence.summary).trim()
      };
      if (!aiResidence.advantages.length) aiResidence.advantages = fallbackResidence.advantages;
    } catch {
      aiResidence = fallbackResidence;
    }
    sendJson(response, 201, {
      id: entry.id,
      score,
      aiSummary: aiResidence.summary,
      aiEnabled: ai.aiEnabled,
      aiError: ai.error || null,
      aiModel: ai.model || null,
      recommendation: {
        residence: recommendedPlace ? {
          name: aiResidence.residenceName,
          description: aiResidence.reason,
          advantages: aiResidence.advantages,
          caution: aiResidence.caution,
          imageUrl: recommendedPlace.image_url || ""
        } : null,
        job: recommendedJob ? {
          title: recommendedJob.title,
          companyName: recommendedJob.company_name || "지역 기업",
          region: recommendedJob.region,
          workType: recommendedJob.work_type || "지역 일자리"
        } : null,
        places: nearbyPlaces.map((place) => ({ name: place.name, region: place.region, category: place.category }))
      }
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/regions/reviews") {
    const region = (url.searchParams.get("region") || "").trim();
    if (!region) {
      sendJson(response, 400, { message: "지역을 선택해 주세요." });
      return true;
    }
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 10));
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
    const total = db.prepare("SELECT COUNT(*) AS count FROM guide_reviews WHERE region = ?").get(region).count;
    const reviews = db.prepare(`
      SELECT guide_reviews.id, guide_reviews.title AS concept, guide_reviews.content, guide_reviews.rating,
             guide_reviews.image_data AS imageData, guide_reviews.images_data AS imagesData,
             guide_reviews.created_at AS createdAt, users.username,
             COALESCE(users.nickname, users.username) AS nickname
      FROM guide_reviews JOIN users ON users.id = guide_reviews.user_id
      WHERE guide_reviews.region = ?
      ORDER BY guide_reviews.created_at DESC, guide_reviews.id DESC
      LIMIT ? OFFSET ?
    `).all(region, limit, offset);
    for (const review of reviews) {
      try { review.images = JSON.parse(review.imagesData || "[]"); } catch { review.images = review.imageData ? [review.imageData] : []; }
      delete review.imagesData;
    }
    sendJson(response, 200, { region, total, reviews, hasMore: offset + reviews.length < total });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/regions/review-summary") {
    const region = (url.searchParams.get("region") || "").trim();
    if (!region) { sendJson(response, 400, { message: "지역을 선택해 주세요." }); return true; }
    const reviews = db.prepare(`SELECT rating, content FROM guide_reviews WHERE region = ? ORDER BY created_at DESC, id DESC LIMIT 30`).all(region);
    if (!reviews.length) { sendJson(response, 404, { message: "AI가 요약할 여행 리뷰가 아직 없습니다." }); return true; }
    const average = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length;
    const cacheKey = `opinion-v2:${region}:${reviews.length}:${reviews.map((review) => `${review.rating}:${review.content}`).join("|")}`;
    if (reviewSummaryCache.has(cacheKey)) { sendJson(response, 200, reviewSummaryCache.get(cacheKey)); return true; }
    const fallback = `${region} 여행 리뷰 ${reviews.length}개의 평균 별점은 ${average.toFixed(1)}점입니다. 전반적인 만족도를 참고하되, 여행 시기와 선호하는 활동에 따라 경험이 달라질 수 있어요.`;
    const result = await generateAiText({
      instructions: `당신은 지역 여행 리뷰 의견 분석가입니다. 제공된 실제 리뷰와 별점만 근거로 한국어로 요약하세요.
첫 문장에는 여행자들의 전반적인 의견이 긍정적·중립적·엇갈림·부정적 중 어디에 가까운지 설명하세요.
그다음에는 사용자들이 가장 자주 이야기하는 주제 2~3개를 중요도 순으로 설명하세요. 예: 경관, 이동, 먹거리, 혼잡도, 편의시설, 친절도. 실제 리뷰에 등장하지 않은 주제는 언급하지 마세요.
각 주제에 대해 어떤 점을 좋게 보았고 어떤 점을 아쉽게 보았는지 구분해 4~6문장으로 종합하세요.
같은 의견이 여러 리뷰에서 반복되었다면 '여러 리뷰에서', 한 리뷰에만 있다면 '일부 리뷰에서'처럼 표본 수준을 정직하게 표현하세요. 정확한 개수나 비율은 입력으로 확인되는 경우에만 사용하세요.
리뷰가 1~2개뿐이면 표본이 적어 일반화하기 어렵다는 문장을 포함하세요. 리뷰에 없는 사실, 장소 정보, 원인, 해결책은 만들지 마세요. 제목이나 마크다운 목록 없이 자연스러운 문단으로 작성하세요.`,
      input: JSON.stringify({ region, reviewCount: reviews.length, averageRating: Number(average.toFixed(1)), reviews }),
      fallback,
      maxOutputTokens: 420
    });
    const payload = { region, reviewCount: reviews.length, averageRating: Number(average.toFixed(1)), summary: result.text, aiEnabled: result.aiEnabled };
    reviewSummaryCache.set(cacheKey, payload);
    sendJson(response, 200, payload);
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/local-fit/detail") {
    const user = requireUser(request, response);
    if (!user) return true;
    const body = await readJson(request);
    const typeLabels = { residence: "거주지역", job: "일자리", places: "관광지" };
    const type = String(body.type || "").trim();
    const name = String(body.name || "").trim();
    if (!typeLabels[type] || !name) {
      sendJson(response, 400, { message: "상세 정보를 확인할 추천 항목이 없습니다." });
      return true;
    }
    const ai = await generateAiText({
      instructions: `당신은 전라도 정착과 여행을 돕는 지역 상담가입니다. 선택한 ${typeLabels[type]}에 대해 사용자가 실제로 비교하는 데 도움이 되는 한국어 설명을 작성하세요. 제공된 데이터만 근거로 사용하고 모르는 가격, 거리, 영업시간은 만들지 마세요. ① 추천 이유 ② 생활 또는 업무·여행 장점 ③ 이용하거나 정착하기 전 확인할 점을 각각 한 문단으로 작성하세요. 전체 5~7문장으로 간결하게 답하세요.`,
      input: JSON.stringify({ selectedType: typeLabels[type], selectedName: name, context: body.context || {} }),
      fallback: `${name}에 대한 AI 상세 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.`,
      maxOutputTokens: 520
    });
    sendJson(response, 200, { title: name, detail: ai.text, aiEnabled: ai.aiEnabled, aiError: ai.error || null });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/posts") {
    const region = (url.searchParams.get("region") || "").trim();
    const posts = db.prepare(`
      SELECT posts.*, users.username, COALESCE(users.nickname, users.username) AS nickname
      FROM posts JOIN users ON users.id = posts.user_id
      ${region ? "WHERE posts.region = ?" : ""}
      ORDER BY posts.created_at DESC, posts.id DESC
    `).all(...(region ? [region] : []));

    const comments = db.prepare(`
      SELECT comments.*, users.username, COALESCE(users.nickname, users.username) AS nickname
      FROM comments
      JOIN users ON users.id = comments.user_id
      JOIN posts ON posts.id = comments.post_id
      ${region ? "WHERE posts.region = ?" : ""}
      ORDER BY comments.created_at ASC, comments.id ASC
    `).all(...(region ? [region] : []));
    const commentsByPost = new Map();
    for (const comment of comments) {
      const postComments = commentsByPost.get(comment.post_id) || [];
      postComments.push(comment);
      commentsByPost.set(comment.post_id, postComments);
    }
    for (const post of posts) {
      post.comments = commentsByPost.get(post.id) || [];
      post.comment_count = post.comments.length;
    }
    sendJson(response, 200, posts);
    return true;
  }

  const postDetailMatch = url.pathname.match(/^\/api\/posts\/(\d+)$/);
  if (request.method === "GET" && postDetailMatch) {
    const post = db.prepare(`
      SELECT posts.*, users.username, COALESCE(users.nickname, users.username) AS nickname
      FROM posts JOIN users ON users.id = posts.user_id WHERE posts.id = ?
    `).get(Number(postDetailMatch[1]));
    if (!post) {
      sendJson(response, 404, { message: "여행 기록을 찾을 수 없습니다." });
      return true;
    }
    post.comments = db.prepare(`
      SELECT comments.*, users.username, COALESCE(users.nickname, users.username) AS nickname
      FROM comments JOIN users ON users.id = comments.user_id
      WHERE comments.post_id = ? ORDER BY comments.created_at ASC, comments.id ASC
    `).all(post.id);
    sendJson(response, 200, post);
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/posts") {
    const user = requireUser(request, response);
    if (!user) return true;
    const body = await readJson(request);
    const images = (Array.isArray(body.imageData) ? body.imageData : [body.imageData])
      .map((image) => String(image || "").trim()).filter(Boolean).slice(0, 5);
    const imageData = images[0] || "";
    const hashtags = String(body.hashtags || "").split(/[#,\s]+/)
      .map((tag) => tag.trim()).filter(Boolean).slice(0, 5);
    if (!body.region || !String(body.content || "").trim()) {
      sendJson(response, 400, { message: "지역과 여행 내용을 입력해 주세요." });
      return true;
    }
    if (images.some((image) => !/^data:image\/(png|jpeg|webp);base64,/.test(image) || image.length > 1_400_000)) {
      sendJson(response, 400, { message: "사진은 최대 5장, 각 1MB 이하로 등록해 주세요." });
      return true;
    }
    const result = db.prepare(`
      INSERT INTO posts (user_id, region, concept, content, image_data, images_data, hashtags, rating, guide_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      String(body.region).trim(),
      String(body.concept || "").trim(),
      String(body.content).trim(),
      imageData,
      JSON.stringify(images),
      JSON.stringify(hashtags),
      body.rating ? Math.max(1, Math.min(5, Number(body.rating))) : null,
      body.guideId && db.prepare("SELECT 1 FROM saved_guides WHERE id = ? AND user_id = ?").get(Number(body.guideId), user.id) ? Number(body.guideId) : null
    );
    sendJson(response, 201, { id: Number(result.lastInsertRowid) });
    return true;
  }

  const commentsMatch = url.pathname.match(/^\/api\/posts\/(\d+)\/comments$/);
  if (commentsMatch && request.method === "GET") {
    const comments = db.prepare(`
      SELECT comments.*, users.username
      FROM comments JOIN users ON users.id = comments.user_id
      WHERE comments.post_id = ? ORDER BY comments.created_at ASC
    `).all(Number(commentsMatch[1]));
    sendJson(response, 200, comments);
    return true;
  }
  if (commentsMatch && request.method === "POST") {
    const user = requireUser(request, response);
    if (!user) return true;
    const { content = "" } = await readJson(request);
    if (!String(content).trim()) {
      sendJson(response, 400, { message: "댓글 내용을 입력해 주세요." });
      return true;
    }
    db.prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)")
      .run(Number(commentsMatch[1]), user.id, String(content).trim());
    sendJson(response, 201, { message: "댓글이 등록되었습니다." });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/gatherings") {
    const currentUser = getAuthenticatedUser(request);
    const mine = url.searchParams.get("mine") === "true";
    const includePast = mine && url.searchParams.get("includePast") === "true";
    const region = (url.searchParams.get("region") || "").trim();
    const location = (url.searchParams.get("location") || "").trim();
    const date = (url.searchParams.get("date") || "").trim();
    const startDate = (url.searchParams.get("startDate") || "").trim();
    const endDate = (url.searchParams.get("endDate") || "").trim();
    const time = (url.searchParams.get("time") || "").trim();
    const dateScope = url.searchParams.get("dateScope") === "from" ? "from" : "exact";
    const concept = (url.searchParams.get("concept") || "").trim();
    if (mine && !currentUser) {
      sendJson(response, 401, { message: "로그인이 필요합니다." });
      return true;
    }
    const filters = includePast ? [] : ["datetime(event_time) >= datetime('now')"];
    const parameters = [currentUser?.id || 0, currentUser?.id || 0];
    if (startDate && endDate && startDate > endDate) {
      sendJson(response, 400, { message: "종료일은 시작일보다 빠를 수 없습니다." });
      return true;
    }
    if (region) { filters.push("gatherings.region = ?"); parameters.push(region); }
    if (mine) { filters.push("gatherings.user_id = ?"); parameters.push(currentUser.id); }
    if (location) { filters.push("gatherings.location LIKE ?"); parameters.push(`%${location}%`); }
    if (startDate || endDate) {
      if (startDate) { filters.push("date(gatherings.event_time) >= date(?)"); parameters.push(startDate); }
      if (endDate) { filters.push("date(gatherings.event_time) <= date(?)"); parameters.push(endDate); }
    } else if (date) {
      filters.push(dateScope === "from" ? "date(gatherings.event_time) >= date(?)" : "date(gatherings.event_time) = date(?)");
      parameters.push(date);
    }
    if (time) { filters.push("time(gatherings.event_time) >= time(?)"); parameters.push(time); }
    let gatherings = db.prepare(`
      SELECT gatherings.*, users.username, COALESCE(users.nickname, users.username) AS nickname,
             (SELECT COUNT(*) FROM gathering_participants
              WHERE gathering_id = gatherings.id) AS participant_count,
             EXISTS(SELECT 1 FROM gathering_participants
              WHERE gathering_id = gatherings.id AND user_id = ?) AS joined,
             CASE WHEN gatherings.user_id = ? THEN 1 ELSE 0 END AS owned
      FROM gatherings JOIN users ON users.id = gatherings.user_id
      WHERE ${filters.length ? filters.join(" AND ") : "1 = 1"}
      ORDER BY event_time ASC
    `).all(...parameters);
    if (concept) gatherings = await selectGatheringsByConcept(concept, gatherings);
    attachGatheringParticipants(gatherings);
    sendJson(response, 200, gatherings);
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/gatherings") {
    const user = requireUser(request, response);
    if (!user) return true;
    const body = await readJson(request);
    const capacity = Number(body.capacity);
    if (!body.title || !body.region || !body.location || !body.eventTime
      || !Number.isInteger(capacity) || capacity < 2 || capacity > 20) {
      sendJson(response, 400, { message: "모임 정보와 2~20명의 정원을 정확히 입력해 주세요." });
      return true;
    }
    const result = db.prepare(`
      INSERT INTO gatherings (user_id, title, region, location, concept, description, event_time, capacity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      String(body.title).trim(),
      String(body.region).trim(),
      String(body.location).trim(),
      String(body.concept || "").trim(),
      String(body.description || "").trim().slice(0, 500),
      String(body.eventTime).trim(),
      capacity
    );
    db.prepare("INSERT INTO gathering_participants (gathering_id, user_id) VALUES (?, ?)")
      .run(result.lastInsertRowid, user.id);
    sendJson(response, 201, { id: Number(result.lastInsertRowid) });
    return true;
  }

  const gatheringDeleteMatch = url.pathname.match(/^\/api\/gatherings\/(\d+)$/);
  const gatheringConfirmMatch = url.pathname.match(/^\/api\/gatherings\/(\d+)\/confirm$/);
  if (gatheringConfirmMatch && request.method === "PATCH") {
    const user = requireUser(request, response);
    if (!user) return true;
    const gatheringId = Number(gatheringConfirmMatch[1]);
    const gathering = db.prepare("SELECT confirmed FROM gatherings WHERE id = ? AND user_id = ?").get(gatheringId, user.id);
    if (!gathering) { sendJson(response, 404, { message: "확정 상태를 변경할 내 게더링을 찾지 못했습니다." }); return true; }
    const confirmed = gathering.confirmed ? 0 : 1;
    db.prepare("UPDATE gatherings SET confirmed = ? WHERE id = ?").run(confirmed, gatheringId);
    sendJson(response, 200, { message: confirmed ? "게더링을 확정했습니다." : "게더링 확정을 해제했습니다.", confirmed: Boolean(confirmed) });
    return true;
  }

  if (gatheringDeleteMatch && request.method === "DELETE") {
    const user = requireUser(request, response);
    if (!user) return true;
    const gatheringId = Number(gatheringDeleteMatch[1]);
    const gathering = db.prepare("SELECT user_id AS userId FROM gatherings WHERE id = ?").get(gatheringId);
    if (!gathering) { sendJson(response, 404, { message: "게더링을 찾을 수 없습니다." }); return true; }
    if (Number(gathering.userId) !== Number(user.id)) { sendJson(response, 403, { message: "내가 만든 게더링만 취소할 수 있습니다." }); return true; }
    db.exec("BEGIN");
    try {
      db.prepare("DELETE FROM gathering_participants WHERE gathering_id = ?").run(gatheringId);
      db.prepare("DELETE FROM gatherings WHERE id = ?").run(gatheringId);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    sendJson(response, 200, { message: "게더링을 취소했습니다." });
    return true;
  }

  const joinMatch = url.pathname.match(/^\/api\/gatherings\/(\d+)\/join$/);
  if (joinMatch && request.method === "POST") {
    const user = requireUser(request, response);
    if (!user) return true;
    const gatheringId = Number(joinMatch[1]);
    const gathering = db.prepare(`
      SELECT gatherings.*,
             (SELECT COUNT(*) FROM gathering_participants
              WHERE gathering_id = gatherings.id) AS participant_count
      FROM gatherings WHERE id = ?
    `).get(gatheringId);
    if (!gathering) {
      sendJson(response, 404, { message: "모임을 찾을 수 없습니다." });
      return true;
    }
    if (gathering.confirmed) {
      sendJson(response, 409, { message: "확정된 게더링에는 새로 참여할 수 없습니다." });
      return true;
    }
    if (gathering.participant_count >= gathering.capacity) {
      sendJson(response, 409, { message: "모임 정원이 마감되었습니다." });
      return true;
    }
    try {
      db.prepare("INSERT INTO gathering_participants (gathering_id, user_id) VALUES (?, ?)")
        .run(gatheringId, user.id);
      sendJson(response, 201, { message: "게더링에 참여했습니다." });
    } catch {
      sendJson(response, 409, { message: "이미 참여한 게더링입니다." });
    }
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/me") {
    const user = requireUser(request, response);
    if (!user) return true;
    const trips = db.prepare(`SELECT id, guide_id AS guideId, region, title AS destinationName, content AS note, rating, image_data AS imageData, images_data AS imagesData, guide_json AS guideJson, created_at AS createdAt FROM guide_reviews WHERE user_id = ? ORDER BY created_at DESC, id DESC`).all(user.id).map((entry) => ({ ...entry, images: JSON.parse(entry.imagesData || "[]"), guide: JSON.parse(entry.guideJson || "{}"), imagesData: undefined, guideJson: undefined }));
    const guides = db.prepare("SELECT id, title, region, hotel, guide_json AS guideJson, created_at AS createdAt FROM saved_guides WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC, id DESC").all(user.id).map((entry) => ({ ...entry, guide: JSON.parse(entry.guideJson || "{}"), guideJson: undefined }));
    const posts = db.prepare("SELECT id, region, concept, content, image_data AS imageData, created_at AS createdAt FROM posts WHERE user_id = ? ORDER BY created_at DESC, id DESC").all(user.id);
    const gatherings = db.prepare(`
      SELECT gatherings.id, gatherings.title, gatherings.region, gatherings.location, gatherings.concept, gatherings.description, gatherings.confirmed,
             gatherings.event_time AS eventTime, gatherings.capacity,
             COALESCE(users.nickname, users.username) AS creatorNickname,
             CASE WHEN gatherings.user_id = ? THEN 1 ELSE 0 END AS createdByMe,
             (SELECT COUNT(*) FROM gathering_participants WHERE gathering_id = gatherings.id) AS participantCount
      FROM gathering_participants
      JOIN gatherings ON gatherings.id = gathering_participants.gathering_id
      JOIN users ON users.id = gatherings.user_id
      WHERE gathering_participants.user_id = ?
      ORDER BY gatherings.event_time DESC, gatherings.id DESC
    `).all(user.id, user.id);
    attachGatheringParticipants(gatherings);
    const applications = db.prepare(`SELECT job_applications.id, job_applications.created_at AS createdAt, jobs.id AS jobId, jobs.title, jobs.company_name AS companyName, jobs.category, jobs.region, jobs.location, jobs.work_type AS workType, jobs.work_time AS workTime, jobs.duration, jobs.pay FROM job_applications JOIN jobs ON jobs.id = job_applications.job_id WHERE job_applications.user_id = ? ORDER BY job_applications.created_at DESC, job_applications.id DESC`).all(user.id);
    const favoriteJobs = db.prepare(`SELECT favorite_jobs.created_at AS createdAt, jobs.id AS jobId, jobs.title, jobs.company_name AS companyName, jobs.category, jobs.region, jobs.location, jobs.work_type AS workType, jobs.work_time AS workTime, jobs.duration, jobs.pay FROM favorite_jobs JOIN jobs ON jobs.id = favorite_jobs.job_id WHERE favorite_jobs.user_id = ? ORDER BY favorite_jobs.created_at DESC`).all(user.id);
    sendJson(response, 200, { profile: { ...user, email: user.username }, trips, guides, posts, gatherings, applications, favoriteJobs });
    return true;
  }

  if (joinMatch && request.method === "DELETE") {
    const user = requireUser(request, response);
    if (!user) return true;
    const gatheringId = Number(joinMatch[1]);
    const gathering = db.prepare("SELECT user_id AS userId FROM gatherings WHERE id = ?").get(gatheringId);
    if (!gathering) { sendJson(response, 404, { message: "모임을 찾을 수 없습니다." }); return true; }
    if (Number(gathering.userId) === Number(user.id)) { sendJson(response, 400, { message: "운영자는 게더링 참여를 취소할 수 없습니다." }); return true; }
    const result = db.prepare("DELETE FROM gathering_participants WHERE gathering_id = ? AND user_id = ?").run(gatheringId, user.id);
    if (!result.changes) { sendJson(response, 404, { message: "참여 중인 게더링이 아닙니다." }); return true; }
    sendJson(response, 200, { message: "게더링 참여를 취소했습니다." });
    return true;
  }

  if (request.method === "PATCH" && url.pathname === "/api/me") {
    const user = requireUser(request, response);
    if (!user) return true;
    const body = await readJson(request);
    const nickname = String(body.nickname || "").trim();
    if (nickname.length < 2 || nickname.length > 20) { sendJson(response, 400, { message: "닉네임은 2~20자로 입력해 주세요." }); return true; }
    db.prepare("UPDATE users SET nickname = ? WHERE id = ?").run(nickname, user.id);
    sendJson(response, 200, { email: user.username, username: user.username, nickname });
    return true;
  }

  if (request.method === "DELETE" && url.pathname === "/api/me") {
    const user = requireUser(request, response);
    if (!user) return true;
    db.exec("BEGIN");
    try {
      db.prepare("DELETE FROM comments WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?)").run(user.id);
      db.prepare("DELETE FROM comments WHERE user_id = ?").run(user.id);
      db.prepare("DELETE FROM gathering_participants WHERE gathering_id IN (SELECT id FROM gatherings WHERE user_id = ?)").run(user.id);
      db.prepare("DELETE FROM gathering_participants WHERE user_id = ?").run(user.id);
      db.prepare("DELETE FROM gatherings WHERE user_id = ?").run(user.id);
      db.prepare("DELETE FROM job_applications WHERE user_id = ?").run(user.id);
      db.prepare("DELETE FROM favorite_jobs WHERE user_id = ?").run(user.id);
      db.prepare("DELETE FROM guide_reviews WHERE user_id = ?").run(user.id);
      db.prepare("DELETE FROM saved_guides WHERE user_id = ?").run(user.id);
      db.prepare("DELETE FROM local_fit_entries WHERE user_id = ?").run(user.id);
      db.prepare("DELETE FROM posts WHERE user_id = ?").run(user.id);
      db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
    for (const [token, userId] of sessions.entries()) if (userId === user.id) sessions.delete(token);
    sendJson(response, 200, { message: "회원 탈퇴가 완료되었습니다." });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/me/guides") {
    const user = requireUser(request, response);
    if (!user) return true;
    const body = await readJson(request);
    const guide = body.guide && typeof body.guide === "object" ? body.guide : null;
    if (!guide?.region || !Array.isArray(guide.spots)) { sendJson(response, 400, { message: "저장할 여행 가이드 정보가 올바르지 않습니다." }); return true; }
    const title = String(body.title || `${guide.region} 맞춤 여행`).trim().slice(0, 100);
    const result = db.prepare("INSERT INTO saved_guides (user_id, title, region, hotel, guide_json) VALUES (?, ?, ?, ?, ?)").run(user.id, title, String(guide.region).slice(0, 80), String(guide.hotel?.name || "").slice(0, 120), JSON.stringify(guide));
    sendJson(response, 201, { id: Number(result.lastInsertRowid), message: "여행 가이드를 저장했습니다." });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/me/guides/trash") {
    const user = requireUser(request, response);
    if (!user) return true;
    const guides = db.prepare("SELECT id, title, region, hotel, guide_json AS guideJson, created_at AS createdAt, deleted_at AS deletedAt FROM saved_guides WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC, id DESC").all(user.id)
      .map((entry) => ({ ...entry, guide: JSON.parse(entry.guideJson || "{}"), guideJson: undefined }));
    sendJson(response, 200, { guides });
    return true;
  }

  const guideReviewMatch = url.pathname.match(/^\/api\/me\/guides\/(\d+)\/review$/);
  if (request.method === "POST" && guideReviewMatch) {
    const user = requireUser(request, response);
    if (!user) return true;
    const guideId = Number(guideReviewMatch[1]);
    const saved = db.prepare("SELECT id, title, region, guide_json AS guideJson FROM saved_guides WHERE id = ? AND user_id = ? AND deleted_at IS NULL").get(guideId, user.id);
    if (!saved) { sendJson(response, 404, { message: "저장한 여행 가이드를 찾을 수 없습니다." }); return true; }
    const body = await readJson(request);
    const rating = Math.max(1, Math.min(5, Math.round(Number(body.rating) || 0)));
    const content = String(body.content || "").trim().slice(0, 300);
    const images = (Array.isArray(body.imageData) ? body.imageData : [body.imageData]).map((image) => String(image || "").trim()).filter(Boolean).slice(0, 5);
    const imageData = images[0] || "";
    if (!content) { sendJson(response, 400, { message: "간단한 여행 리뷰를 작성해 주세요." }); return true; }
    if (images.some((image) => !/^data:image\/(png|jpeg|webp);base64,/.test(image) || image.length > 1_400_000)) { sendJson(response, 400, { message: "리뷰 사진은 최대 5장, 각 1MB 이하로 등록해 주세요." }); return true; }
    try {
      const result = db.prepare("INSERT INTO guide_reviews (user_id, guide_id, region, title, guide_json, rating, content, image_data, images_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(user.id, guideId, saved.region, saved.title, saved.guideJson, rating, content, imageData, JSON.stringify(images));
      sendJson(response, 201, { id: Number(result.lastInsertRowid), guideId, region: saved.region, destinationName: saved.title, rating, note: content, imageData, images, guide: JSON.parse(saved.guideJson), createdAt: new Date().toISOString() });
    } catch (error) {
      sendJson(response, String(error.message).includes("UNIQUE") ? 409 : 500, { message: String(error.message).includes("UNIQUE") ? "이미 리뷰를 작성한 가이드입니다." : "리뷰를 저장하지 못했습니다." });
    }
    return true;
  }

  const restoreGuideMatch = url.pathname.match(/^\/api\/me\/guides\/(\d+)\/restore$/);
  if (request.method === "PATCH" && restoreGuideMatch) {
    const user = requireUser(request, response);
    if (!user) return true;
    const result = db.prepare("UPDATE saved_guides SET deleted_at = NULL WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL").run(Number(restoreGuideMatch[1]), user.id);
    if (!result.changes) { sendJson(response, 404, { message: "휴지통에서 여행 가이드를 찾을 수 없습니다." }); return true; }
    sendJson(response, 200, { message: "여행 가이드를 복원했습니다." });
    return true;
  }

  const permanentGuideMatch = url.pathname.match(/^\/api\/me\/guides\/(\d+)\/permanent$/);
  if (request.method === "DELETE" && permanentGuideMatch) {
    const user = requireUser(request, response);
    if (!user) return true;
    const guideId = Number(permanentGuideMatch[1]);
    const saved = db.prepare("SELECT id FROM saved_guides WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL").get(guideId, user.id);
    if (!saved) { sendJson(response, 404, { message: "휴지통에서 여행 가이드를 찾을 수 없습니다." }); return true; }
    db.exec("BEGIN");
    try {
      db.prepare("DELETE FROM guide_reviews WHERE guide_id = ? AND user_id = ?").run(guideId, user.id);
      db.prepare("DELETE FROM saved_guides WHERE id = ? AND user_id = ?").run(guideId, user.id);
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
    sendJson(response, 200, { message: "여행 가이드를 영구 삭제했습니다." });
    return true;
  }

  const savedGuideMatch = url.pathname.match(/^\/api\/me\/guides\/(\d+)$/);
  if (request.method === "PATCH" && savedGuideMatch) {
    const user = requireUser(request, response);
    if (!user) return true;
    const body = await readJson(request);
    const title = String(body.title || "").trim().slice(0, 100);
    if (title.length < 2) { sendJson(response, 400, { message: "가이드 이름은 2자 이상 입력해 주세요." }); return true; }
    const result = db.prepare("UPDATE saved_guides SET title = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL").run(title, Number(savedGuideMatch[1]), user.id);
    if (!result.changes) { sendJson(response, 404, { message: "저장한 여행 가이드를 찾을 수 없습니다." }); return true; }
    sendJson(response, 200, { id: Number(savedGuideMatch[1]), title, message: "가이드 이름을 변경했습니다." });
    return true;
  }
  if (request.method === "DELETE" && savedGuideMatch) {
    const user = requireUser(request, response);
    if (!user) return true;
    const result = db.prepare("UPDATE saved_guides SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND deleted_at IS NULL").run(Number(savedGuideMatch[1]), user.id);
    if (!result.changes) { sendJson(response, 404, { message: "저장한 여행 가이드를 찾을 수 없습니다." }); return true; }
    sendJson(response, 200, { message: "여행 가이드를 휴지통으로 이동했습니다." });
    return true;
  }

  const applicationMatch = url.pathname.match(/^\/api\/jobs\/(\d+)\/apply$/);
  if (request.method === "POST" && applicationMatch) {
    const user = requireUser(request, response);
    if (!user) return true;
    const jobId = Number(applicationMatch[1]);
    if (!db.prepare("SELECT 1 FROM jobs WHERE id = ? AND active = 1").get(jobId)) { sendJson(response, 404, { message: "공고를 찾을 수 없습니다." }); return true; }
    db.prepare("INSERT OR IGNORE INTO job_applications (user_id, job_id) VALUES (?, ?)").run(user.id, jobId);
    sendJson(response, 201, { message: "지원한 공고에 저장했습니다." });
    return true;
  }

  const favoriteJobMatch = url.pathname.match(/^\/api\/jobs\/(\d+)\/favorite$/);
  if (favoriteJobMatch && (request.method === "GET" || request.method === "POST" || request.method === "DELETE")) {
    const user = requireUser(request, response);
    if (!user) return true;
    const jobId = Number(favoriteJobMatch[1]);
    if (!db.prepare("SELECT 1 FROM jobs WHERE id = ? AND active = 1").get(jobId)) { sendJson(response, 404, { message: "공고를 찾을 수 없습니다." }); return true; }
    if (request.method === "GET") {
      sendJson(response, 200, { favorite: Boolean(db.prepare("SELECT 1 FROM favorite_jobs WHERE user_id = ? AND job_id = ?").get(user.id, jobId)) });
      return true;
    }
    if (request.method === "POST") db.prepare("INSERT OR IGNORE INTO favorite_jobs (user_id, job_id) VALUES (?, ?)").run(user.id, jobId);
    else db.prepare("DELETE FROM favorite_jobs WHERE user_id = ? AND job_id = ?").run(user.id, jobId);
    sendJson(response, 200, { favorite: request.method === "POST" });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/register") {
    const { email = "", password = "", nickname = "" } = await readJson(request);
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail) || password.length < 8 || nickname.trim().length < 2 || nickname.trim().length > 20) {
      sendJson(response, 400, { message: "올바른 이메일, 8자 이상의 비밀번호, 2~20자의 닉네임을 입력해 주세요." });
      return true;
    }

    try {
      if (db.prepare("SELECT 1 FROM users WHERE LOWER(username) = ?").get(normalizedEmail)) {
        sendJson(response, 409, { message: "이미 사용 중인 이메일입니다." });
        return true;
      }
      const { hash, salt } = hashPassword(password);
      db.prepare("INSERT INTO users (username, password_hash, password_salt, nickname) VALUES (?, ?, ?, ?)")
        .run(normalizedEmail, hash, salt, nickname.trim());
      sendJson(response, 201, { message: "회원가입이 완료되었습니다." });
    } catch (error) {
      const duplicate = String(error.message).includes("UNIQUE");
      sendJson(response, duplicate ? 409 : 500, {
        message: duplicate ? "이미 사용 중인 이메일입니다." : "회원가입을 처리하지 못했습니다."
      });
    }
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    const { email = "", password = "" } = await readJson(request);
    const normalizedEmail = normalizeEmail(email);
    const user = isValidEmail(normalizedEmail)
      ? db.prepare("SELECT * FROM users WHERE LOWER(username) = ?").get(normalizedEmail)
      : null;
    if (!user || !verifyPassword(password, user)) {
      sendJson(response, 401, { message: "이메일 또는 비밀번호를 확인해 주세요." });
      return true;
    }

    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, user.id);
    sendJson(response, 200, { token, email: user.username, username: user.username, nickname: user.nickname || user.username.split("@")[0] });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/search") {
    const query = String(url.searchParams.get("q") || "").trim();
    if (query.length < 2) {
      sendJson(response, 400, { message: "검색어를 두 글자 이상 입력해 주세요." });
      return true;
    }
    const like = `%${query}%`;
    const jobs = db.prepare(`
      SELECT * FROM jobs WHERE active = 1
      AND (title LIKE ? OR company_name LIKE ? OR region LIKE ? OR category LIKE ?)
      ORDER BY rating DESC, created_at DESC LIMIT 8
    `).all(like, like, like, like).map(mapJob);
    const destinations = db.prepare(`
      SELECT * FROM destinations WHERE active = 1
      AND (name LIKE ? OR region LIKE ? OR category LIKE ? OR description LIKE ?)
      ORDER BY search_volume DESC, rating DESC LIMIT 8
    `).all(like, like, like, like).map(mapDestination);
    const posts = db.prepare(`
      SELECT id, region, concept, content FROM posts
      WHERE region LIKE ? OR concept LIKE ? OR content LIKE ?
      ORDER BY created_at DESC LIMIT 8
    `).all(like, like, like);
    const gatherings = db.prepare(`
      SELECT id, title, region, concept, description FROM gatherings
      WHERE title LIKE ? OR region LIKE ? OR concept LIKE ? OR description LIKE ?
      ORDER BY event_time DESC, id DESC LIMIT 8
    `).all(like, like, like, like);
    sendJson(response, 200, { query, jobs, destinations, posts, gatherings });
    return true;
  }

  return false;
}

function serveFile(request, response, pathname) {
  const isReactRoute = pathname === "/app" || pathname.startsWith("/app/");
  const reactIndex = path.join(reactRoot, "index.html");
  let filePath;

  if (isReactRoute && fs.existsSync(reactIndex)) {
    const relativePath = pathname.slice("/app".length) || "/index.html";
    const candidate = path.resolve(reactRoot, `.${decodeURIComponent(relativePath)}`);
    filePath = candidate.startsWith(reactRoot) && fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory()
      ? candidate
      : reactIndex;
  } else {
    const requested = pathname === "/" ? "/index.html" : pathname;
    filePath = path.resolve(root, `.${decodeURIComponent(requested)}`);
  }

  const allowedRoot = isReactRoute ? reactRoot : root;
  if (!filePath.startsWith(allowedRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendJson(response, 404, { message: "페이지를 찾을 수 없습니다." });
    return;
  }

  const types = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".json": "application/json"
  };
  const extension = path.extname(filePath);
  const contentType = types[extension] || "application/octet-stream";
  const cacheControl = [".html", ".js", ".css"].includes(extension) ? "no-cache" : "public, max-age=3600";
  response.writeHead(200, {
    "Content-Type": ["text/html", "text/css", "text/javascript"].includes(contentType)
      ? `${contentType}; charset=utf-8`
      : contentType,
    "Cache-Control": cacheControl
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/") && await handleApi(request, response, url)) return;
    if ((url.pathname === "/" || url.pathname === "/index.html") && fs.existsSync(path.join(reactRoot, "index.html"))) {
      response.writeHead(302, { Location: "/app/", "Cache-Control": "no-cache" });
      response.end();
      return;
    }
    serveFile(request, response, url.pathname);
  } catch (error) {
    sendJson(response, 500, { message: error.message || "서버 오류가 발생했습니다." });
  }
});

server.listen(port, () => {
  console.log(`일로와전라: http://localhost:${port}`);
  console.log(`DB: ${dbPath}`);
});

module.exports = { server, db };
