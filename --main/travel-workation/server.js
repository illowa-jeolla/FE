const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const port = Number(process.env.PORT || 8080);
const root = __dirname;
const dbPath = process.env.WORKATION_DB_PATH || path.join(root, "data", "workation.db");

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
      if (body.length > 2_000_000) request.destroy();
    });
    request.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); }
      catch { reject(new Error("올바른 JSON 형식이 아닙니다.")); }
    });
    request.on("error", reject);
  });
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
    ? db.prepare("SELECT id, username FROM users WHERE id = ?").get(userId)
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

async function handleApi(request, response, url) {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
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

    sendJson(response, 200, {
      prompt: `전라도 관광 데이터에서 ${companions.join(", ")}과 함께 ${transports.join(", ")}으로 이동하며 즐길 ${themes.join(", ")} 테마 여행지를 추천해 주세요.`,
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
      SELECT posts.id, posts.concept, posts.content, posts.created_at, users.username
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
    sendJson(response, 201, { ...entry, score: localFitScore(entry) });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/posts") {
    const region = (url.searchParams.get("region") || "").trim();
    const posts = db.prepare(`
      SELECT posts.*, users.username
      FROM posts JOIN users ON users.id = posts.user_id
      WHERE posts.created_at >= datetime('now', '-24 hours')
      ${region ? "AND posts.region = ?" : ""}
      ORDER BY posts.created_at DESC, posts.id DESC
    `).all(...(region ? [region] : []));

    const comments = db.prepare(`
      SELECT comments.*, users.username
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

  if (request.method === "POST" && url.pathname === "/api/posts") {
    const user = requireUser(request, response);
    if (!user) return true;
    const body = await readJson(request);
    const imageData = String(body.imageData || "");
    if (!body.region || !String(body.content || "").trim()) {
      sendJson(response, 400, { message: "지역과 여행 내용을 입력해 주세요." });
      return true;
    }
    if (imageData && (!/^data:image\/(png|jpeg|webp);base64,/.test(imageData) || imageData.length > 1_400_000)) {
      sendJson(response, 400, { message: "사진은 1MB 이하 이미지로 등록해 주세요." });
      return true;
    }
    const result = db.prepare(`
      INSERT INTO posts (user_id, region, concept, content, image_data)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      user.id,
      String(body.region).trim(),
      String(body.concept || "").trim(),
      String(body.content).trim(),
      imageData
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
    const { username = "", password = "" } = await readJson(request);
    if (username.trim().length < 4 || password.length < 8) {
      sendJson(response, 400, { message: "아이디는 4자 이상, 비밀번호는 8자 이상이어야 합니다." });
      return true;
    }

    try {
      const { hash, salt } = hashPassword(password);
      db.prepare("INSERT INTO users (username, password_hash, password_salt) VALUES (?, ?, ?)")
        .run(username.trim(), hash, salt);
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
    sendJson(response, 200, { token, username: user.username });
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
