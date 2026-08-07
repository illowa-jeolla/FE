const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const port = Number(process.env.PORT || 8080);
const root = __dirname;
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
`);

function ensureColumn(table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all()
    .some((entry) => entry.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

ensureColumn("destinations", "transport", "TEXT");
ensureColumn("destinations", "companion", "TEXT");
ensureColumn("jobs", "job_kind", "TEXT NOT NULL DEFAULT 'general'");
ensureColumn("users", "nickname", "TEXT");
ensureColumn("posts", "is_demo", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("posts", "images_data", "TEXT");
ensureColumn("posts", "hashtags", "TEXT");
ensureColumn("jobs", "map_demo", "INTEGER NOT NULL DEFAULT 0");

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

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(password, user) {
  const saved = Buffer.from(user.password_hash, "hex");
  const entered = Buffer.from(hashPassword(password, user.password_salt).hash, "hex");
  return saved.length === entered.length && crypto.timingSafeEqual(saved, entered);
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
    companion: destination.companion
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
    const reviewCount = db.prepare("SELECT COUNT(*) AS count FROM posts WHERE region = ?").get(region).count;
    const reviews = db.prepare(`
      SELECT posts.id, posts.concept, posts.content, posts.created_at, users.username,
             COALESCE(users.nickname, users.username) AS nickname
      FROM posts JOIN users ON users.id = posts.user_id
      WHERE posts.region = ?
      ORDER BY posts.created_at DESC, posts.id DESC
      LIMIT 5
    `).all(region);
    sendJson(response, 200, {
      region,
      destinationCount: destination.destinationCount,
      averageRating: Number(destination.averageRating || 0),
      reviewCount: Number(reviewCount || 0),
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
      WHERE posts.created_at >= datetime('now', '-24 hours')
      ${region ? "AND posts.region = ?" : ""}
      ORDER BY posts.created_at DESC, posts.id DESC
    `).all(...(region ? [region] : []));

    const comments = db.prepare(`
      SELECT comments.*, users.username, COALESCE(users.nickname, users.username) AS nickname
      FROM comments
      JOIN users ON users.id = comments.user_id
      JOIN posts ON posts.id = comments.post_id
      WHERE posts.created_at >= datetime('now', '-24 hours')
      ${region ? "AND posts.region = ?" : ""}
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
      INSERT INTO posts (user_id, region, concept, content, image_data, images_data, hashtags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      String(body.region).trim(),
      String(body.concept || "").trim(),
      String(body.content).trim(),
      imageData,
      JSON.stringify(images),
      JSON.stringify(hashtags)
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
    const region = (url.searchParams.get("region") || "").trim();
    const gatherings = db.prepare(`
      SELECT gatherings.*, users.username,
             (SELECT COUNT(*) FROM gathering_participants
              WHERE gathering_id = gatherings.id) AS participant_count
      FROM gatherings JOIN users ON users.id = gatherings.user_id
      WHERE datetime(event_time) >= datetime('now')
      ${region ? "AND gatherings.region = ?" : ""}
      ORDER BY event_time ASC
    `).all(...(region ? [region] : []));
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
      INSERT INTO gatherings (user_id, title, region, location, concept, event_time, capacity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      String(body.title).trim(),
      String(body.region).trim(),
      String(body.location).trim(),
      String(body.concept || "").trim(),
      String(body.eventTime).trim(),
      capacity
    );
    db.prepare("INSERT INTO gathering_participants (gathering_id, user_id) VALUES (?, ?)")
      .run(result.lastInsertRowid, user.id);
    sendJson(response, 201, { id: Number(result.lastInsertRowid) });
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

  if (request.method === "POST" && url.pathname === "/api/auth/register") {
    const { username = "", password = "", nickname = "" } = await readJson(request);
    if (username.trim().length < 4 || password.length < 8 || nickname.trim().length < 2 || nickname.trim().length > 20) {
      sendJson(response, 400, { message: "아이디는 4자 이상, 비밀번호는 8자 이상, 닉네임은 2~20자로 입력해 주세요." });
      return true;
    }

    try {
      const { hash, salt } = hashPassword(password);
      db.prepare("INSERT INTO users (username, password_hash, password_salt, nickname) VALUES (?, ?, ?, ?)")
        .run(username.trim(), hash, salt, nickname.trim());
      sendJson(response, 201, { message: "회원가입이 완료되었습니다." });
    } catch (error) {
      const duplicate = String(error.message).includes("UNIQUE");
      sendJson(response, duplicate ? 409 : 500, {
        message: duplicate ? "이미 사용 중인 아이디입니다." : "회원가입을 처리하지 못했습니다."
      });
    }
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    const { username = "", password = "" } = await readJson(request);
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username.trim());
    if (!user || !verifyPassword(password, user)) {
      sendJson(response, 401, { message: "아이디 또는 비밀번호를 확인해 주세요." });
      return true;
    }

    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, user.id);
    sendJson(response, 200, { token, username: user.username, nickname: user.nickname || user.username });
    return true;
  }

  return false;
}

function serveFile(request, response, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(root, `.${decodeURIComponent(requested)}`);
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
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
    ".webp": "image/webp"
  };
  const extension = path.extname(filePath);
  const contentType = types[extension] || "application/octet-stream";
  const cacheControl = extension === ".html" ? "no-cache" : "public, max-age=3600";
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
