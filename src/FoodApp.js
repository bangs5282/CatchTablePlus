import { useState, useEffect, useRef } from "react";

// ───────── 더미 데이터 ─────────
const CATEGORIES = ["전체", "한식", "중식", "일식", "양식", "카페", "분식"];

const RESTAURANTS = [
  { id: 1, name: "한우마을", category: "한식", rating: 4.8, reviewCount: 312, distance: "120m", wait: "15분", image: "🥩", tags: ["런치특선", "예약가능"], lat: 37.501, lng: 127.026 },
  { id: 2, name: "스시오마카세", category: "일식", rating: 4.9, reviewCount: 201, distance: "230m", wait: "30분", image: "🍣", tags: ["오마카세", "예약필수"], lat: 37.502, lng: 127.025 },
  { id: 3, name: "베이징덕", category: "중식", rating: 4.5, reviewCount: 178, distance: "340m", wait: "5분", image: "🦆", tags: ["단체석"], lat: 37.500, lng: 127.027 },
  { id: 4, name: "파스타리아", category: "양식", rating: 4.6, reviewCount: 95, distance: "450m", wait: "20분", image: "🍝", tags: ["와인바"], lat: 37.503, lng: 127.024 },
  { id: 5, name: "달빛카페", category: "카페", rating: 4.7, reviewCount: 430, distance: "80m", wait: "즉시", image: "☕", tags: ["디저트", "루프탑"], lat: 37.501, lng: 127.028 },
  { id: 6, name: "분식천국", category: "분식", rating: 4.3, reviewCount: 560, distance: "150m", wait: "즉시", image: "🍱", tags: ["저렴", "포장"], lat: 37.502, lng: 127.023 },
];

const SEATS = [
  { id: "A1", type: "창가", capacity: 2, x: 10, y: 12, reservations: 0 },
  { id: "A2", type: "창가", capacity: 2, x: 10, y: 30, reservations: 2 },
  { id: "A3", type: "창가", capacity: 2, x: 10, y: 48, reservations: 1 },
  { id: "B1", type: "일반", capacity: 4, x: 40, y: 12, reservations: 0 },
  { id: "B2", type: "일반", capacity: 4, x: 40, y: 35, reservations: 4 },
  { id: "B3", type: "일반", capacity: 4, x: 40, y: 58, reservations: 0 },
  { id: "C1", type: "룸", capacity: 6, x: 68, y: 20, reservations: 3 },
  { id: "C2", type: "룸", capacity: 8, x: 68, y: 55, reservations: 0 },
];

const MENU = {
  추천: [
    { id: 1, name: "시그니처 코스", price: 85000, desc: "셰프 추천 9가지 코스", img: "⭐" },
    { id: 2, name: "계절 특선", price: 45000, desc: "오늘의 신선한 재료", img: "🌿" },
  ],
  메인: [
    { id: 3, name: "안심 스테이크", price: 58000, desc: "1++ 한우 안심 200g", img: "🥩" },
    { id: 4, name: "갈비찜", price: 38000, desc: "24시간 숙성 소갈비", img: "🍖" },
    { id: 5, name: "된장 삼겹", price: 22000, desc: "직화 삼겹살 200g", img: "🐷" },
  ],
  사이드: [
    { id: 6, name: "공기밥", price: 2000, desc: "", img: "🍚" },
    { id: 7, name: "된장찌개", price: 5000, desc: "구수한 재래 된장", img: "🫕" },
    { id: 8, name: "계란찜", price: 4000, desc: "부드러운 뚝배기", img: "🥚" },
  ],
  음료: [
    { id: 9, name: "막걸리", price: 6000, desc: "지역 양조장 생막걸리", img: "🍶" },
    { id: 10, name: "소주", price: 5000, desc: "", img: "🥃" },
    { id: 11, name: "탄산수", price: 3000, desc: "", img: "💧" },
  ],
};

// ───────── 메인 앱 ─────────
export default function App() {
  const [page, setPage] = useState("main"); // main | seat | order | qr
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [orderType, setOrderType] = useState(null); // takeout | reservation
  const [cart, setCart] = useState({});
  const [orderMode, setOrderMode] = useState(null); // preorder | reserveonly

  const navigate = (p, opts = {}) => {
    if (opts.restaurant) setSelectedRestaurant(opts.restaurant);
    if (opts.seat !== undefined) setSelectedSeat(opts.seat);
    if (opts.orderType) setOrderType(opts.orderType);
    if (opts.orderMode) setOrderMode(opts.orderMode);
    setPage(p);
  };

  const addToCart = (item) => {
    setCart(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
  };
  const removeFromCart = (item) => {
    setCart(prev => {
      const next = { ...prev };
      if (next[item.id] > 1) next[item.id]--;
      else delete next[item.id];
      return next;
    });
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {page === "main" && <MainPage navigate={navigate} />}
        {page === "seat" && (
          <SeatPage
            restaurant={selectedRestaurant}
            navigate={navigate}
            setSelectedSeat={setSelectedSeat}
          />
        )}
        {page === "order" && (
          <OrderPage
            restaurant={selectedRestaurant}
            seat={selectedSeat}
            orderType={orderType}
            orderMode={orderMode}
            cart={cart}
            addToCart={addToCart}
            removeFromCart={removeFromCart}
            navigate={navigate}
          />
        )}
        {page === "qr" && <QRPage navigate={navigate} />}
      </div>
    </>
  );
}

// ───────── 메인 페이지 ─────────
function MainPage({ navigate }) {
  const [category, setCategory] = useState("전체");
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const filtered = category === "전체"
    ? RESTAURANTS
    : RESTAURANTS.filter(r => r.category === category);

  const handleRestaurantSelect = (r) => {
    setSelected(r);
    setShowModal(true);
  };

  return (
    <div className="page">
      {/* 헤더 */}
      <div className="header">
        <div>
          <div className="header-location">📍 강남구 역삼동</div>
          <div className="header-title">주변 맛집</div>
        </div>
        <button className="qr-btn" onClick={() => navigate("qr") }>
          <span className="qr-icon">⬛</span>
          QR
        </button>
      </div>

      {/* 카테고리 필터 */}
      <div className="category-scroll">
        {CATEGORIES.map(c => (
          <button
            key={c}
            className={`cat-chip ${category === c ? "active" : ""}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {/* 지도 영역 (더미) */}
      <div className="map-area">
        <div className="map-bg">
          {filtered.map(r => (
            <div
              key={r.id}
              className="map-pin"
              style={{ left: `${(r.lng - 127.02) * 3000 + 10}%`, top: `${(37.504 - r.lat) * 3000 + 5}%` }}
              onClick={() => handleRestaurantSelect(r)}
            >
              <div className="pin-bubble">{r.image}</div>
              <div className="pin-label">{r.name}</div>
            </div>
          ))}
          <div className="map-me">🔵 내위치</div>
        </div>
      </div>

      {/* 음식점 리스트 */}
      <div className="list-section">
        <div className="list-header">
          <span className="list-title">근처 {filtered.length}곳</span>
          <span className="list-sort">거리순 ▾</span>
        </div>
        <div className="restaurant-list">
          {filtered.map(r => (
            <RestaurantCard key={r.id} r={r} onSelect={() => handleRestaurantSelect(r)} />
          ))}
        </div>
      </div>

      {/* 음식점 선택 모달 */}
      {showModal && selected && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-drag" />
            <div className="modal-emoji">{selected.image}</div>
            <div className="modal-name">{selected.name}</div>
            <div className="modal-meta">
              ⭐ {selected.rating} · {selected.distance} · 대기 {selected.wait}
            </div>
            <div className="modal-actions">
              <button
                className="action-btn takeout"
                onClick={() => {
                  setShowModal(false);
                  navigate("order", { restaurant: selected, orderType: "takeout" });
                }}
              >
                <span>🛍</span> 포장 주문
              </button>
              <button
                className="action-btn reserve"
                onClick={() => {
                  setShowModal(false);
                  navigate("seat", { restaurant: selected });
                }}
              >
                <span>📅</span> 예약하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RestaurantCard({ r, onSelect }) {
  return (
    <div className="r-card" onClick={onSelect}>
      <div className="r-img">{r.image}</div>
      <div className="r-info">
        <div className="r-name">{r.name}
          <span className="r-cat">{r.category}</span>
        </div>
        <div className="r-tags">
          {r.tags.map(t => <span key={t} className="tag">{t}</span>)}
        </div>
        <div className="r-meta">
          ⭐ {r.rating} ({r.reviewCount}) · {r.distance} · 대기 <b>{r.wait}</b>
        </div>
      </div>
      <div className="r-arrow">›</div>
    </div>
  );
}

// ───────── 자리 선택 페이지 ─────────
function SeatPage({ restaurant, navigate, setSelectedSeat }) {
  const [hoveredSeat, setHoveredSeat] = useState(null);
  const [chosenSeat, setChosenSeat] = useState(null);
  const [showSeatModal, setShowSeatModal] = useState(false);

  const handleSeatClick = (seat) => {
    if (seat.reservations >= seat.capacity) return;
    setChosenSeat(seat);
    setShowSeatModal(true);
  };

  const getSeatColor = (seat) => {
    if (seat.reservations >= seat.capacity) return "#e5e7eb";
    if (seat.reservations === 0) return "#f0fdf4";
    return "#fef9c3";
  };

  const getSeatBorder = (seat) => {
    if (seat.reservations >= seat.capacity) return "#d1d5db";
    if (seat.reservations === 0) return "#22c55e";
    return "#eab308";
  };

  return (
    <div className="page">
      <div className="nav-header">
        <button className="back-btn" onClick={() => navigate("main")}>←</button>
        <div className="nav-title">{restaurant?.name} · 자리 선택</div>
        <div />
      </div>

      {/* 범례 */}
      <div className="legend">
        <span className="leg-item"><span className="leg-dot" style={{ background: "#22c55e" }} />빈 자리</span>
        <span className="leg-item"><span className="leg-dot" style={{ background: "#eab308" }} />일부 예약</span>
        <span className="leg-item"><span className="leg-dot" style={{ background: "#9ca3af" }} />만석</span>
      </div>

      {/* 좌석 배치도 */}
      <div className="floor-wrap">
        <div className="floor-label">입구 ↓</div>
        <div className="floor-map">
          <div className="kitchen-area">🍳 주방</div>
          {SEATS.map(seat => (
            <div
              key={seat.id}
              className={`seat ${seat.reservations >= seat.capacity ? "full" : "available"}`}
              style={{
                left: `${seat.x}%`,
                top: `${seat.y}%`,
                background: getSeatColor(seat),
                borderColor: getSeatBorder(seat),
              }}
              onClick={() => handleSeatClick(seat)}
            >
              <div className="seat-id">{seat.id}</div>
              <div className="seat-type">{seat.type}</div>
              <div className="seat-count">
                {seat.reservations >= seat.capacity
                  ? "만석"
                  : `${seat.reservations}/${seat.capacity}명`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 자리 선택 모달 */}
      {showSeatModal && chosenSeat && (
        <div className="modal-overlay" onClick={() => setShowSeatModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-drag" />
            <div className="seat-modal-header">
              <div className="seat-modal-id">{chosenSeat.id}</div>
              <div className="seat-modal-info">
                {chosenSeat.type} · {chosenSeat.capacity}인석 · 현재 {chosenSeat.reservations}명 예약
              </div>
            </div>
            <div className="modal-actions" style={{ flexDirection: "column", gap: "10px" }}>
              <button
                className="action-btn reserve"
                onClick={() => {
                  setShowSeatModal(false);
                  setSelectedSeat(chosenSeat);
                  navigate("order", {
                    restaurant,
                    seat: chosenSeat,
                    orderType: "reservation",
                    orderMode: "preorder",
                  });
                }}
              >
                🍽 미리 주문하기
              </button>
              <button
                className="action-btn takeout"
                onClick={() => {
                  setShowSeatModal(false);
                  setSelectedSeat(chosenSeat);
                  navigate("order", {
                    restaurant,
                    seat: chosenSeat,
                    orderType: "reservation",
                    orderMode: "reserveonly",
                  });
                }}
              >
                📅 예약만 하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────── 주문 페이지 ─────────
function OrderPage({ restaurant, seat, orderType, orderMode, cart, addToCart, removeFromCart, navigate }) {
  const [activeTab, setActiveTab] = useState("추천");
  const [showComplete, setShowComplete] = useState(false);

  const totalCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const totalPrice = Object.entries(cart).reduce((sum, [id, qty]) => {
    const allItems = Object.values(MENU).flat();
    const item = allItems.find(m => m.id === parseInt(id));
    return sum + (item?.price || 0) * qty;
  }, 0);

  const isReserveOnly = orderMode === "reserveonly";

  if (showComplete) {
    return (
      <div className="page center-page">
        <div className="complete-wrap">
          <div className="complete-icon">
            {orderType === "takeout" ? "🛍" : "📅"}
          </div>
          <div className="complete-title">
            {isReserveOnly ? "예약 완료!" : "주문 완료!"}
          </div>
          <div className="complete-sub">
            {restaurant?.name}
            {seat ? ` · ${seat.id}석` : ""}
          </div>
          {!isReserveOnly && totalPrice > 0 && (
            <div className="complete-price">{totalPrice.toLocaleString()}원</div>
          )}
          <button className="complete-btn" onClick={() => navigate("main") }>
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page order-page">
      <div className="nav-header">
        <button className="back-btn" onClick={() => navigate(seat ? "seat" : "main")}>←</button>
        <div className="nav-title">
          {restaurant?.name}
          {seat && <span className="seat-badge">{seat.id}석</span>}
        </div>
        <div className="order-type-badge">
          {orderType === "takeout" ? "포장" : "예약"}
        </div>
      </div>

      {isReserveOnly ? (
        <div className="reserve-only-wrap">
          <div className="reserve-info-card">
            <div className="reserve-emoji">📅</div>
            <div className="reserve-title">예약 정보</div>
            <div className="reserve-row"><span>매장</span><b>{restaurant?.name}</b></div>
            <div className="reserve-row"><span>좌석</span><b>{seat?.id} ({seat?.type})</b></div>
            <div className="reserve-row"><span>인원</span><b>{seat?.capacity}인석</b></div>
            <div className="reserve-note">* 메뉴는 현장에서 주문하실 수 있습니다.</div>
          </div>
          <button className="submit-btn" onClick={() => setShowComplete(true)}>
            예약 확정하기
          </button>
        </div>
      ) : (
        <>
          {/* 메뉴 탭 */}
          <div className="menu-tabs">
            {Object.keys(MENU).map(tab => (
              <button
                key={tab}
                className={`menu-tab ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* 메뉴 리스트 */}
          <div className="menu-list">
            {MENU[activeTab].map(item => (
              <div key={item.id} className="menu-item">
                <div className="menu-img">{item.img}</div>
                <div className="menu-info">
                  <div className="menu-name">{item.name}</div>
                  {item.desc && <div className="menu-desc">{item.desc}</div>}
                  <div className="menu-price">{item.price.toLocaleString()}원</div>
                </div>
                <div className="menu-ctrl">
                  {cart[item.id] ? (
                    <>
                      <button className="ctrl-btn minus" onClick={() => removeFromCart(item)}>−</button>
                      <span className="ctrl-count">{cart[item.id]}</span>
                      <button className="ctrl-btn plus" onClick={() => addToCart(item)}>+</button>
                    </>
                  ) : (
                    <button className="add-btn" onClick={() => addToCart(item)}>담기</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 주문 바 */}
          {totalCount > 0 && (
            <div className="order-bar">
              <div className="order-bar-info">
                <span className="order-count">{totalCount}개</span>
                <span className="order-price">{totalPrice.toLocaleString()}원</span>
              </div>
              <button className="order-submit" onClick={() => setShowComplete(true)}>
                {orderType === "takeout" ? "포장 주문하기" : "주문 확정하기"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ───────── QR 페이지 ─────────
function QRPage({ navigate }) {
  return (
    <div className="page center-page">
      <div className="nav-header" style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
        <button className="back-btn" onClick={() => navigate("main")}>←</button>
        <div className="nav-title">QR 스캔</div>
        <div />
      </div>
      <div className="qr-wrap">
        <div className="qr-scanner">
          <div className="qr-corner tl" />
          <div className="qr-corner tr" />
          <div className="qr-corner bl" />
          <div className="qr-corner br" />
          <div className="qr-line" />
          <div className="qr-center-icon">📷</div>
        </div>
        <div className="qr-hint">매장 테이블의 QR코드를<br />스캔해 주세요</div>
      </div>
    </div>
  );
}

// ───────── CSS ─────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

:root {
  --bg: #fafaf8;
  --card: #ffffff;
  --primary: #ff5722;
  --primary-light: #fff3f0;
  --secondary: #ff8a65;
  --text: #1a1a1a;
  --text2: #6b7280;
  --border: #f0ede8;
  --radius: 16px;
  --shadow: 0 2px 12px rgba(0,0,0,0.08);
}

body { background: var(--bg); font-family: 'Noto Sans KR', sans-serif; }

.app {
  max-width: 430px;
  margin: 0 auto;
  min-height: 100vh;
  background: var(--bg);
  position: relative;
  overflow: hidden;
}

.page {
  min-height: 100vh;
  overflow-y: auto;
  padding-bottom: 80px;
}

/* 헤더 */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 20px 12px;
  background: white;
}
.header-location { font-size: 12px; color: var(--text2); }
.header-title { font-size: 22px; font-weight: 800; color: var(--text); }
.qr-btn {
  display: flex; flex-direction: column; align-items: center;
  background: var(--primary-light); border: none; border-radius: 12px;
  padding: 10px 14px; cursor: pointer; gap: 3px;
  font-family: 'Noto Sans KR', sans-serif; font-size: 11px; font-weight: 700;
  color: var(--primary);
}
.qr-icon { font-size: 20px; }

/* 카테고리 */
.category-scroll {
  display: flex; gap: 8px; padding: 12px 16px;
  overflow-x: auto; background: white;
  scrollbar-width: none;
}
.category-scroll::-webkit-scrollbar { display: none; }
.cat-chip {
  white-space: nowrap; padding: 7px 16px; border-radius: 20px;
  border: 1.5px solid var(--border); background: white;
  font-family: 'Noto Sans KR', sans-serif; font-size: 13px; font-weight: 600;
  color: var(--text2); cursor: pointer; transition: all .2s;
}
.cat-chip.active { background: var(--primary); color: white; border-color: var(--primary); }

/* 지도 */
.map-area { padding: 12px 16px; }
.map-bg {
  position: relative; height: 220px; border-radius: 20px;
  background: linear-gradient(135deg, #e8f5e9 0%, #e3f2fd 50%, #fce4ec 100%);
  overflow: hidden; border: 1px solid var(--border);
}
.map-pin {
  position: absolute; transform: translate(-50%, -100%);
  display: flex; flex-direction: column; align-items: center; cursor: pointer;
}
.pin-bubble {
  width: 36px; height: 36px; border-radius: 50% 50% 50% 0%;
  background: white; border: 2px solid var(--primary);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; box-shadow: var(--shadow);
  transform: rotate(-45deg);
}
.pin-bubble > * { transform: rotate(45deg); }
.pin-label {
  background: rgba(255,255,255,0.9); padding: 2px 6px;
  border-radius: 8px; font-size: 10px; font-weight: 700;
  margin-top: 4px; white-space: nowrap; box-shadow: var(--shadow);
}
.map-me {
  position: absolute; left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  font-size: 11px; font-weight: 700; color: #1d4ed8;
  background: white; padding: 3px 8px; border-radius: 10px;
}

/* 리스트 */
.list-section { padding: 0 16px; }
.list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.list-title { font-size: 15px; font-weight: 700; }
.list-sort { font-size: 12px; color: var(--text2); }
.restaurant-list { display: flex; flex-direction: column; gap: 10px; }
.r-card {
  background: var(--card); border-radius: var(--radius); padding: 14px;
  display: flex; align-items: center; gap: 12px;
  box-shadow: var(--shadow); cursor: pointer; border: 1px solid var(--border);
  transition: transform .15s;
}
.r-card:active { transform: scale(0.98); }
.r-img { font-size: 38px; width: 54px; height: 54px; display: flex; align-items: center; justify-content: center; background: var(--bg); border-radius: 12px; }
.r-info { flex: 1; }
.r-name { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 6px; }
.r-cat { font-size: 11px; font-weight: 500; color: var(--primary); background: var(--primary-light); padding: 2px 8px; border-radius: 8px; }
.r-tags { display: flex; gap: 4px; margin: 4px 0; }
.tag { font-size: 11px; color: var(--text2); background: #f3f4f6; padding: 2px 8px; border-radius: 8px; }
.r-meta { font-size: 12px; color: var(--text2); }
.r-arrow { font-size: 22px; color: #d1d5db; }

/* 모달 */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  z-index: 100; display: flex; align-items: flex-end;
  animation: fadeIn .2s;
}
.modal {
  background: white; border-radius: 24px 24px 0 0;
  padding: 20px 24px 40px; width: 100%;
  animation: slideUp .3s cubic-bezier(.32,1,.64,1);
}
.modal-drag {
  width: 40px; height: 4px; background: #e5e7eb;
  border-radius: 4px; margin: 0 auto 20px;
}
.modal-emoji { font-size: 48px; text-align: center; }
.modal-name { font-size: 22px; font-weight: 800; text-align: center; margin: 8px 0 4px; }
.modal-meta { text-align: center; color: var(--text2); font-size: 13px; margin-bottom: 24px; }
.modal-actions { display: flex; gap: 10px; }
.action-btn {
  flex: 1; padding: 16px; border-radius: 14px; border: none;
  font-family: 'Noto Sans KR', sans-serif; font-size: 15px; font-weight: 700;
  cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: opacity .15s;
}
.action-btn:active { opacity: 0.8; }
.action-btn.takeout { background: #f3f4f6; color: var(--text); }
.action-btn.reserve { background: var(--primary); color: white; }

/* 네비게이션 헤더 */
.nav-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; background: white; position: sticky; top: 0; z-index: 10;
  border-bottom: 1px solid var(--border);
}
.back-btn {
  background: none; border: none; font-size: 22px; cursor: pointer; padding: 4px 8px;
  color: var(--text); font-weight: 700;
}
.nav-title { font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.seat-badge { background: var(--primary); color: white; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 20px; }
.order-type-badge { font-size: 12px; font-weight: 700; color: var(--primary); }

/* 범례 */
.legend {
  display: flex; gap: 16px; padding: 12px 20px;
  background: white; border-bottom: 1px solid var(--border);
}
.leg-item { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text2); }
.leg-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }

/* 좌석 배치도 */
.floor-wrap { padding: 16px; }
.floor-label { font-size: 12px; color: var(--text2); text-align: center; margin-bottom: 8px; }
.floor-map {
  position: relative; height: 340px; background: #f8f9fa;
  border-radius: 20px; border: 2px dashed var(--border); overflow: hidden;
}
.kitchen-area {
  position: absolute; right: 0; top: 0; background: #e5e7eb;
  padding: 8px 12px; border-radius: 0 18px 0 12px; font-size: 12px; color: var(--text2);
}
.seat {
  position: absolute; border-radius: 12px; border: 2px solid;
  padding: 8px; text-align: center; cursor: pointer;
  transition: transform .15s, box-shadow .15s;
  min-width: 66px;
}
.seat.available:active { transform: scale(0.95); box-shadow: var(--shadow); }
.seat.full { cursor: not-allowed; opacity: 0.6; }
.seat-id { font-size: 13px; font-weight: 800; }
.seat-type { font-size: 10px; color: var(--text2); }
.seat-count { font-size: 11px; font-weight: 700; margin-top: 2px; }

/* 자리 모달 */
.seat-modal-header { text-align: center; margin-bottom: 20px; }
.seat-modal-id { font-size: 36px; font-weight: 800; }
.seat-modal-info { color: var(--text2); font-size: 14px; }

/* 주문 페이지 */
.order-page { padding-bottom: 120px; }
.menu-tabs {
  display: flex; gap: 0; background: white;
  border-bottom: 1px solid var(--border); overflow-x: auto;
  scrollbar-width: none;
}
.menu-tab {
  padding: 14px 20px; border: none; background: none;
  font-family: 'Noto Sans KR', sans-serif; font-size: 14px; font-weight: 600;
  color: var(--text2); cursor: pointer; white-space: nowrap;
  border-bottom: 2px solid transparent; transition: all .15s;
}
.menu-tab.active { color: var(--primary); border-bottom-color: var(--primary); }
.menu-list { padding: 8px 16px; display: flex; flex-direction: column; gap: 4px; }
.menu-item {
  display: flex; align-items: center; gap: 12px;
  background: white; border-radius: 14px; padding: 14px;
  border: 1px solid var(--border);
}
.menu-img { font-size: 32px; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: var(--bg); border-radius: 10px; }
.menu-info { flex: 1; }
.menu-name { font-size: 14px; font-weight: 700; }
.menu-desc { font-size: 12px; color: var(--text2); margin: 2px 0; }
.menu-price { font-size: 14px; font-weight: 700; color: var(--primary); }
.menu-ctrl { display: flex; align-items: center; gap: 6px; }
.add-btn {
  background: var(--primary); color: white; border: none;
  border-radius: 10px; padding: 8px 14px; font-family: 'Noto Sans KR', sans-serif;
  font-size: 13px; font-weight: 700; cursor: pointer;
}
.ctrl-btn {
  width: 30px; height: 30px; border-radius: 50%; border: 1.5px solid var(--border);
  background: white; font-size: 16px; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.ctrl-btn.plus { background: var(--primary); color: white; border-color: var(--primary); }
.ctrl-count { font-size: 15px; font-weight: 700; min-width: 18px; text-align: center; }

/* 주문 바 */
.order-bar {
  position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 430px; background: white;
  border-top: 1px solid var(--border); padding: 16px 20px 28px;
  display: flex; flex-direction: column; gap: 10px;
}
.order-bar-info { display: flex; justify-content: space-between; }
.order-count { font-size: 13px; color: var(--text2); }
.order-price { font-size: 17px; font-weight: 800; }
.order-submit {
  width: 100%; padding: 16px; background: var(--primary); color: white;
  border: none; border-radius: 14px; font-family: 'Noto Sans KR', sans-serif;
  font-size: 16px; font-weight: 700; cursor: pointer;
}

/* 예약만 */
.reserve-only-wrap { padding: 20px 16px; }
.reserve-info-card {
  background: white; border-radius: 20px; padding: 28px 24px;
  border: 1px solid var(--border); text-align: center; margin-bottom: 20px;
}
.reserve-emoji { font-size: 52px; }
.reserve-title { font-size: 20px; font-weight: 800; margin: 10px 0 20px; }
.reserve-row {
  display: flex; justify-content: space-between; padding: 10px 0;
  border-bottom: 1px solid var(--border); font-size: 14px;
}
.reserve-note { font-size: 12px; color: var(--text2); margin-top: 16px; }
.submit-btn {
  width: 100%; padding: 18px; background: var(--primary); color: white;
  border: none; border-radius: 14px; font-family: 'Noto Sans KR', sans-serif;
  font-size: 16px; font-weight: 700; cursor: pointer;
}

/* 완료 화면 */
.center-page { display: flex; align-items: center; justify-content: center; }
.complete-wrap { text-align: center; padding: 40px 20px; }
.complete-icon { font-size: 80px; animation: bounce .6s ease; }
.complete-title { font-size: 28px; font-weight: 800; margin: 16px 0 8px; }
.complete-sub { font-size: 15px; color: var(--text2); }
.complete-price { font-size: 26px; font-weight: 800; color: var(--primary); margin: 16px 0; }
.complete-btn {
  margin-top: 32px; padding: 16px 32px; background: var(--primary); color: white;
  border: none; border-radius: 14px; font-family: 'Noto Sans KR', sans-serif;
  font-size: 16px; font-weight: 700; cursor: pointer;
}

/* QR */
.qr-wrap { text-align: center; padding: 20px; }
.qr-scanner {
  position: relative; width: 260px; height: 260px; margin: 60px auto 28px;
  background: rgba(0,0,0,0.03); border-radius: 20px; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.qr-corner {
  position: absolute; width: 30px; height: 30px;
  border-color: var(--primary); border-style: solid; border-width: 0;
}
.qr-corner.tl { top: 10px; left: 10px; border-top-width: 4px; border-left-width: 4px; border-radius: 4px 0 0 0; }
.qr-corner.tr { top: 10px; right: 10px; border-top-width: 4px; border-right-width: 4px; border-radius: 0 4px 0 0; }
.qr-corner.bl { bottom: 10px; left: 10px; border-bottom-width: 4px; border-left-width: 4px; border-radius: 0 0 0 4px; }
.qr-corner.br { bottom: 10px; right: 10px; border-bottom-width: 4px; border-right-width: 4px; border-radius: 0 0 4px 0; }
.qr-line {
  position: absolute; left: 14px; right: 14px; height: 2px;
  background: linear-gradient(90deg, transparent, var(--primary), transparent);
  animation: scanLine 2s linear infinite;
}
.qr-center-icon { font-size: 60px; }
.qr-hint { font-size: 15px; color: var(--text2); line-height: 1.7; font-weight: 500; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes bounce { 0%,100% { transform: scale(1); } 50% { transform: scale(1.2); } }
@keyframes scanLine {
  0% { top: 14px; }
  50% { top: calc(100% - 14px); }
  100% { top: 14px; }
}
`;
