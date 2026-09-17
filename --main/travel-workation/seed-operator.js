const sqlite=require('node:sqlite');
const db=new sqlite.DatabaseSync('data/workation.db');
const userId=2;
const assets=['assets/JvLTt.jpeg','assets/lX3GW.jpeg','assets/J6aHjc.jpeg','assets/u3OD9c.jpeg','assets/bI7WI.jpeg'];

const guideDefs=[
  {title:'여수 맞춤 여행 가이드',region:'여수',hotel:'여수 베네치아 호텔&스위트',tripStart:'2026-08-12',tripEnd:'2026-08-14',conditions:{region:'여수',hotel:'여수 베네치아 호텔',start:'2026-08-12',end:'2026-08-14',themes:['자연·힐링','로컬 미식'],transport:'대중교통',companion:'혼자'},summary:'바다 접근성과 저녁 동선이 좋은 여수 핵심 코스입니다.',tip:'버스 배차와 케이블카 운영시간을 현장에서 다시 확인하세요.',spots:[
    {name:'여수세계박람회장 스카이타워',address:'전라남도 여수시 박람회길 1',category:'전망·휴식',description:'엑스포역 인근에서 시작하기 좋은 전망 포인트입니다.',time:'10:00',stayMinutes:45,distanceFromPreviousKm:1.2,travelMinutes:15,imageUrl:assets[0],x:18,y:35},
    {name:'오동도',address:'전라남도 여수시 수정동 산 1-11',category:'자연·힐링',description:'동백숲과 바다 산책이 어우러진 대표 코스입니다.',time:'11:10',stayMinutes:90,distanceFromPreviousKm:2.3,travelMinutes:25,imageUrl:assets[1],x:34,y:56},
    {name:'이순신광장',address:'전라남도 여수시 선어시장길 6',category:'역사·산책',description:'원도심의 바다와 간식을 함께 즐기기 좋아요.',time:'14:00',stayMinutes:45,distanceFromPreviousKm:1.9,travelMinutes:24,imageUrl:assets[2],x:50,y:70},
    {name:'고소동 천사벽화골목',address:'전라남도 여수시 고소동 268',category:'전망·골목산책',description:'언덕 골목에서 여수 바다를 내려다볼 수 있어요.',time:'15:00',stayMinutes:60,distanceFromPreviousKm:0.7,travelMinutes:12,imageUrl:assets[3],x:66,y:45},
    {name:'여수 낭만포차거리',address:'전라남도 여수시 하멜로 102',category:'로컬 미식·야경',description:'밤바다와 해산물 안주로 마무리하는 장소입니다.',time:'18:30',stayMinutes:90,distanceFromPreviousKm:1.0,travelMinutes:13,imageUrl:assets[4],x:81,y:63}
  ]},
  {title:'전주 맞춤 여행 가이드',region:'전주',hotel:'전주한옥마을 관광안내소',tripStart:'2026-08-01',tripEnd:'2026-08-02',conditions:{region:'전주',hotel:'전주한옥마을 관광안내소',start:'2026-08-01',end:'2026-08-02',themes:['전통','로컬 미식'],transport:'도보',companion:'친구'},summary:'도보 중심으로 한옥마을과 시장을 엮은 전주 코스입니다.',tip:'주말에는 골목이 혼잡하니 오전 동선부터 시작하는 편이 좋아요.',spots:[
    {name:'전주한옥마을',address:'전북특별자치도 전주시 완산구 기린대로',category:'전통마을',description:'골목 산책과 간식 탐방의 시작점이에요.',time:'10:00',stayMinutes:60,distanceFromPreviousKm:0,travelMinutes:0,imageUrl:assets[2],x:18,y:35},
    {name:'경기전',address:'전주시 완산구 태조로 44',category:'역사',description:'고즈넉한 정원과 역사 공간을 천천히 둘러봐요.',time:'11:15',stayMinutes:50,distanceFromPreviousKm:0.4,travelMinutes:8,imageUrl:assets[3],x:34,y:56},
    {name:'남부시장 청년몰',address:'전주시 완산구 풍남문1길',category:'시장·미식',description:'전주의 생활 먹거리와 작은 상점을 함께 봅니다.',time:'12:30',stayMinutes:80,distanceFromPreviousKm:0.5,travelMinutes:7,imageUrl:assets[4],x:50,y:70},
    {name:'청연루',address:'전주시 완산구 동서학동',category:'수변 산책',description:'전주천과 누정을 보는 여유로운 산책지예요.',time:'14:10',stayMinutes:40,distanceFromPreviousKm:1.1,travelMinutes:17,imageUrl:assets[0],x:66,y:45},
    {name:'자만벽화마을',address:'전주시 완산구 교동',category:'골목·전망',description:'벽화와 한옥마을 지붕 풍경이 좋은 마무리 코스입니다.',time:'15:10',stayMinutes:60,distanceFromPreviousKm:1.2,travelMinutes:17,imageUrl:assets[1],x:81,y:63}
  ]},
  {title:'순천 맞춤 여행 가이드',region:'순천',hotel:'순천역 관광안내소',tripStart:'2026-08-18',tripEnd:'2026-08-19',conditions:{region:'순천',hotel:'순천역 관광안내소',start:'2026-08-18',end:'2026-08-19',themes:['자연·힐링','사진'],transport:'대중교통',companion:'연인'},summary:'정원과 습지, 일몰까지 연결되는 순천 코스입니다.',tip:'습지 구간은 해 질 무렵 바람이 강해질 수 있어요.',spots:[
    {name:'순천만국가정원',address:'순천시 국가정원1호길 47',category:'정원',description:'꽃과 정원 구성이 아름다운 대표 관광지예요.',time:'10:00',stayMinutes:90,distanceFromPreviousKm:2.1,travelMinutes:20,imageUrl:assets[4],x:18,y:35},
    {name:'순천드라마촬영장',address:'순천시 비례골길 24',category:'촬영지',description:'복고 분위기의 골목과 세트장이 인상적입니다.',time:'12:00',stayMinutes:60,distanceFromPreviousKm:3.2,travelMinutes:18,imageUrl:assets[2],x:34,y:56},
    {name:'문화의거리',address:'순천시 중앙동',category:'골목·카페',description:'소규모 상점과 카페가 모여 있는 산책 코스입니다.',time:'13:30',stayMinutes:50,distanceFromPreviousKm:1.4,travelMinutes:10,imageUrl:assets[0],x:50,y:70},
    {name:'순천만습지',address:'순천시 순천만길 513-25',category:'습지',description:'갈대밭과 노을 풍경이 유명한 자연 코스예요.',time:'15:00',stayMinutes:80,distanceFromPreviousKm:6.5,travelMinutes:25,imageUrl:assets[1],x:66,y:45},
    {name:'와온해변',address:'순천시 해룡면 와온길',category:'바다·일몰',description:'한적하게 일몰을 보기 좋은 해변입니다.',time:'17:30',stayMinutes:70,distanceFromPreviousKm:4.2,travelMinutes:18,imageUrl:assets[3],x:81,y:63}
  ]}
];

const guides=[];
for (const g of guideDefs){
  const guide={region:g.region,hotel:{name:g.hotel,address:g.hotel,latitude:34.75,longitude:127.74,x:10,y:22},summary:g.summary,totalDistanceKm:g.spots.reduce((a,s)=>a+Number(s.distanceFromPreviousKm||0),0),totalMinutes:g.spots.reduce((a,s)=>a+Number(s.stayMinutes||0)+Number(s.travelMinutes||0),0),tip:g.tip,spots:g.spots,aiEnabled:true,model:'gpt-5.6-terra',tripStart:g.tripStart,tripEnd:g.tripEnd,conditions:g.conditions};
  let row=db.prepare('select id from saved_guides where user_id=? and title=?').get(userId,g.title);
  const id=row?row.id:Number(db.prepare("insert into saved_guides (user_id,title,region,hotel,guide_json,created_at) values (?,?,?,?,?,datetime('now'))").run(userId,g.title,g.region,g.hotel,JSON.stringify(guide)).lastInsertRowid);
  guides.push({id,title:g.title,region:g.region,guide});
}

const reviews=[
  {g:guides[0],rating:5,content:'오동도랑 낭만포차 동선이 좋았고 밤바다 분위기가 정말 좋았어요.',images:[assets[0],assets[1]],created:'2026-08-03 10:00:00'},
  {g:guides[1],rating:4,content:'전주 한옥마을에서 시장까지 이어지는 흐름이 자연스러워서 만족스러웠어요.',images:[assets[2],assets[4]],created:'2026-08-04 11:00:00'}
];
for (const r of reviews){
  if(!db.prepare('select 1 from guide_reviews where user_id=? and guide_id=?').get(userId,r.g.id)) {
    db.prepare('insert into guide_reviews (user_id,guide_id,region,title,guide_json,rating,content,created_at,image_data,images_data) values (?,?,?,?,?,?,?,?,?,?)').run(userId,r.g.id,r.g.region,r.g.title,JSON.stringify(r.g.guide),r.rating,r.content,r.created,r.images[0],JSON.stringify(r.images));
  }
}

const posts=[
  {region:'여수',concept:'여수 밤바다 산책',content:'돌산대교 야경이 예뻐서 저녁 산책 코스로 추천해요.',image:assets[0],guideId:guides[0].id,rating:5},
  {region:'전주',concept:'전주 골목 투어',content:'한옥마을 안쪽 골목과 청년몰까지 이어서 걷기 좋았어요.',image:assets[2],guideId:guides[1].id,rating:4},
  {region:'순천',concept:'순천 일몰 코스',content:'와온해변까지 이어지는 동선 덕분에 사진 찍기 좋았어요.',image:assets[1],guideId:guides[2].id,rating:5}
];
for (const p of posts){
  if(!db.prepare('select 1 from posts where user_id=? and concept=?').get(userId,p.concept)) {
    db.prepare("insert into posts (user_id,region,concept,content,image_data,created_at,is_demo,hashtags,rating,guide_id) values (?,?,?,?,?,datetime('now'),0,?,?,?)").run(userId,p.region,p.concept,p.content,p.image,'#워케이션 #'+p.region,p.rating,p.guideId);
  }
}

for (const jobId of [7,8,9]) {
  db.prepare("insert or ignore into favorite_jobs (user_id,job_id,created_at) values (?,?,datetime('now'))").run(userId,jobId);
}
for (const jobId of [7,8,10]) {
  if(!db.prepare('select 1 from job_applications where user_id=? and job_id=?').get(userId,jobId)) {
    db.prepare("insert into job_applications (user_id,job_id,created_at) values (?,?,datetime('now'))").run(userId,jobId);
  }
}

const ownGatherings=[
  {title:'여수 밤바다 포토 워크',region:'여수',location:'여수 해양공원',concept:'사진 산책',event_time:'2026-08-20T19:00',capacity:4,description:'돌산대교 야경 포인트를 함께 걷는 저녁 모임입니다.',confirmed:1,created:'2026-08-03 09:00:00'}
];
for (const g of ownGatherings){
  let row=db.prepare('select id from gatherings where user_id=? and title=?').get(userId,g.title);
  const id=row?row.id:Number(db.prepare('insert into gatherings (user_id,title,region,location,concept,event_time,capacity,created_at,description,confirmed) values (?,?,?,?,?,?,?,?,?,?)').run(userId,g.title,g.region,g.location,g.concept,g.event_time,g.capacity,g.created,g.description,g.confirmed).lastInsertRowid);
  db.prepare("insert or ignore into gathering_participants (gathering_id,user_id,created_at) values (?,?,datetime('now'))").run(id,userId);
}

const otherGatherings=[
  {user_id:3,title:'여수 별바다 선셋 모임',region:'여수',location:'종포해양공원',concept:'선셋 산책',event_time:'2026-08-21T18:30',capacity:6,description:'노을 시간에 맞춰 산책하는 모임입니다.',confirmed:0,created:'2026-08-03 10:00:00'}
];
for (const g of otherGatherings){
  let row=db.prepare('select id from gatherings where user_id=? and title=?').get(g.user_id,g.title);
  const id=row?row.id:Number(db.prepare('insert into gatherings (user_id,title,region,location,concept,event_time,capacity,created_at,description,confirmed) values (?,?,?,?,?,?,?,?,?,?)').run(g.user_id,g.title,g.region,g.location,g.concept,g.event_time,g.capacity,g.created,g.description,g.confirmed).lastInsertRowid);
  db.prepare("insert or ignore into gathering_participants (gathering_id,user_id,created_at) values (?,?,datetime('now'))").run(id,g.user_id);
  db.prepare("insert or ignore into gathering_participants (gathering_id,user_id,created_at) values (?,?,datetime('now'))").run(id,userId);
}

console.log('seeded operator data');
