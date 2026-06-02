import { useState, useEffect, useRef } from "react";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import QrScanner from 'qr-scanner';

const API_URL = process.env.REACT_APP_API_URL || '';

// ───────── 더미 데이터 ─────────
const CATEGORIES = ["전체", "한식", "중식", "일식", "양식", "카페", "분식"];

// ───────── 메인 앱 ─────────
export default function App() {
  const [page, setPage] = useState("main"); // main | seat | order | qr | payment | login | register | orders | admin | pos
  const [restaurants, setRestaurants] = useState([]);
  const [seats, setSeats] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [orderType, setOrderType] = useState(null); // takeout | reservation
  const [cart, setCart] = useState({});
  const [orderMode, setOrderMode] = useState(null); // preorder | reserveonly
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [paymentContext, setPaymentContext] = useState(null);
  const [pendingQrPayment, setPendingQrPayment] = useState(() => {
    try {
      const url = new URL(window.location.href);
      const restaurantId = parseInt(url.searchParams.get('restaurantId') || '', 10);
      const seatId = String(url.searchParams.get('seatId') || '').trim().toUpperCase();
      if (!Number.isNaN(restaurantId) && seatId) {
        return { restaurantId, seatId };
      }
    } catch (_) {
      // URL 파싱 실패 시 무시
    }
    return null;
  });

  const fetchSeats = () => {
    return fetch(`${API_URL}/seats`)
      .then(r => r.json())
      .then(setSeats)
      .catch(console.error);
  };

  useEffect(() => {
    if (!user) {
      setPage("login");
    } else {
      if (user.type === 'admin') {
        setPage("admin");
      } else if (user.type === 'restaurant_owner') {
        setPage("pos");
      } else {
        setPage("main");
      }

      fetch(`${API_URL}/restaurants`)
        .then(r => r.json())
        .then(setRestaurants)
        .catch(console.error);
      fetchSeats();
    }
  }, [user]);

  const handleQrPayment = ({ restaurantId, seatId }) => {
    const rest = restaurants.find(r => Number(r.id) === Number(restaurantId));
    const seat = seats.find(s => Number(s.restaurantId) === Number(restaurantId) && String(s.id) === String(seatId));

    setPaymentContext({
      restaurantId,
      seatId,
      restaurantName: rest?.name || `매장 #${restaurantId}`,
      seatType: seat?.type || '',
      suggestedAmount: 48000
    });
    setPage('payment');
  };

  useEffect(() => {
    if (!pendingQrPayment || !user) return;

    handleQrPayment(pendingQrPayment);
    setPendingQrPayment(null);

    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('qr');
      url.searchParams.delete('restaurantId');
      url.searchParams.delete('seatId');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    } catch (_) {
      // URL 정리 실패 시 무시
    }
  }, [pendingQrPayment, user, restaurants, seats]);

  const completePayment = async ({ restaurantId, seatId, amount, method }) => {
    try {
      let relatedOrderId = null;
      try {
        const ordersResponse = await fetch(`${API_URL}/orders`);
        const allOrders = await ordersResponse.json();
        const related = [...allOrders]
          .reverse()
          .find(o =>
            Number(o.restaurantId) === Number(restaurantId) &&
            String(o.seatId || '') === String(seatId || '') &&
            String(o.userId || '') === String(user?.id || '') &&
            String(o.status || 'pending') !== 'cancelled' &&
            String(o.paymentStatus || '') !== 'paid'
          );
        relatedOrderId = related?.id || null;
      } catch (e) {
        console.error('Failed to find related order for payment:', e);
      }

      const payRes = await fetch(`${API_URL}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          seatId,
          orderId: relatedOrderId,
          amount,
          method,
          customerId: user?.id,
          status: 'requested'
        })
      });

      if (!payRes.ok) {
        throw new Error('결제 요청 생성 실패');
      }

      const seatRes = await fetch(`${API_URL}/seats/${seatId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservations: 0, restaurantId })
      });

      if (!seatRes.ok) {
        throw new Error('좌석 상태 업데이트 실패');
      }

      await fetchSeats();
      setPaymentContext(null);
      setPage('main');
    } catch (error) {
      console.error('Payment flow error:', error);
      alert('결제 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
    }
  };

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

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    if (userData.type === 'admin') {
      setPage("admin");
    } else if (userData.type === 'restaurant_owner') {
      setPage("pos");
    } else {
      setPage("main");
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    setPage("login");
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {page === "login" && <LoginPage navigate={navigate} login={login} />}
        {page === "register" && <RegisterPage navigate={navigate} login={login} />}
        {page === "main" && <MainPage navigate={navigate} restaurants={restaurants} user={user} logout={logout} />}
        {page === "admin" && <AdminPage user={user} logout={logout} />}
        {page === "pos" && <POSPage user={user} logout={logout} />}
        {page === "qr" && <QRPage navigate={navigate} onPayment={handleQrPayment} />}
        {page === "payment" && (
          <PaymentPage
            navigate={navigate}
            paymentContext={paymentContext}
            onConfirmPayment={completePayment}
          />
        )}
        {page === "seat" && (
          <SeatPage
            restaurant={selectedRestaurant}
            navigate={navigate}
            setSelectedSeat={setSelectedSeat}
            seats={seats.filter(s => selectedRestaurant && s.restaurantId === selectedRestaurant.id)}
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
            user={user}
          />
        )}
        {page === "orders" && <OrdersPage navigate={navigate} user={user} />}
      </div>
    </>
  );
}

// ───────── 메인 페이지 ─────────
function MainPage({ navigate, restaurants, user, logout }) {
  const [category, setCategory] = useState("전체");
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [reviewStatsByRestaurant, setReviewStatsByRestaurant] = useState({});
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerLayerRef = useRef(null);

  const USER_LOCATION = { lat: 37.6199, lng: 127.0593 }; // 광운대학교

  const getDistanceMeters = (lat1, lng1, lat2, lng2) => {
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  const formatDistance = (meters) => {
    if (meters < 1000) return `${meters}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const estimateWait = (restaurant, meters) => {
    const score = restaurant.displayRating ?? restaurant.rating ?? 4.5;
    const demand = (restaurant.displayReviewCount ?? restaurant.reviewCount ?? 100) / 110;
    const distLoad = meters < 250 ? 2 : 0;
    const idBias = (restaurant.id * 3) % 6;
    const waitMin = Math.max(0, Math.round((5 - score) * 8 + demand + distLoad + idBias));
    return waitMin === 0 ? '즉시' : `${waitMin}분`;
  };

  function getRestaurantWithReviewStats(r) {
    const stats = reviewStatsByRestaurant[r.id];
    if (!stats) {
      return {
        ...r,
        displayRating: r.rating,
        displayReviewCount: r.reviewCount,
        recentReviews: []
      };
    }

    return {
      ...r,
      displayRating: stats.avg,
      displayReviewCount: stats.count,
      recentReviews: stats.reviews
    };
  }

  const filtered = category === "전체"
    ? restaurants
    : restaurants.filter(r => r.category === category);

  const enrichedFiltered = filtered
    .map(r => {
      const distanceMeters = getDistanceMeters(USER_LOCATION.lat, USER_LOCATION.lng, r.lat, r.lng);
      const base = getRestaurantWithReviewStats(r);
      return {
        ...base,
        distanceMeters,
        displayDistance: formatDistance(distanceMeters),
        displayWait: estimateWait(base, distanceMeters)
      };
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  const handleRestaurantSelect = (r) => {
    setSelected(getRestaurantWithReviewStats(r));
    setShowModal(true);
  };

  useEffect(() => {
    const loadReviewStats = async () => {
      try {
        const response = await fetch(`${API_URL}/orders`);
        const allOrders = await response.json();

        const ratedOrders = allOrders.filter(o => Number(o.rating) >= 1 && Number(o.rating) <= 5);
        const grouped = {};

        ratedOrders.forEach(o => {
          const rid = o.restaurantId;
          if (!grouped[rid]) {
            grouped[rid] = { sum: 0, count: 0, reviews: [] };
          }
          grouped[rid].sum += Number(o.rating);
          grouped[rid].count += 1;
          grouped[rid].reviews.push({
            orderId: o.id,
            rating: Number(o.rating),
            review: o.review || '',
            time: o.ratedAt || o.timestamp
          });
        });

        const normalized = {};
        Object.keys(grouped).forEach(key => {
          const g = grouped[key];
          normalized[key] = {
            avg: Number((g.sum / g.count).toFixed(1)),
            count: g.count,
            reviews: g.reviews
              .sort((a, b) => new Date(b.time) - new Date(a.time))
              .slice(0, 4)
          };
        });

        setReviewStatsByRestaurant(normalized);
      } catch (error) {
        console.error('Error loading review stats:', error);
      }
    };

    loadReviewStats();
    const timer = setInterval(loadReviewStats, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView([USER_LOCATION.lat, USER_LOCATION.lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    mapInstanceRef.current = map;
    markerLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const markerLayer = markerLayerRef.current;
    if (!map || !markerLayer) return;

    markerLayer.clearLayers();

    enrichedFiltered.forEach(rr => {
      const icon = L.divIcon({
        html: `
          <div style="
            background: white;
            border-radius: 50%;
            width: 56px;
            height: 56px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.15);
            border: 3px solid var(--primary);
            cursor: pointer;
            transition: transform 0.2s;
          " class="marker-icon">
            ${rr.image}
          </div>
          <div style="
            background: white;
            color: #1a1a1a;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
            white-space: nowrap;
            margin-top: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.12);
            text-align: center;
          ">
            ${rr.name}
          </div>
        `,
        className: 'custom-marker',
        iconSize: [60, 80],
        iconAnchor: [30, 80],
        popupAnchor: [0, -80]
      });
      L.marker([rr.lat, rr.lng], { icon }).addTo(markerLayer).bindPopup(`
        <div style="text-align: center; padding: 8px;">
          <div style="font-size: 24px; margin-bottom: 4px;">${rr.image}</div>
          <div style="font-weight: 700; margin-bottom: 4px;">${rr.name}</div>
          <div style="font-size: 12px; color: #666;">${rr.category} · ${rr.displayDistance}</div>
          <div style="font-size: 13px; margin-top: 4px;">⭐ ${rr.displayRating} (${rr.displayReviewCount})</div>
          <div style="font-size: 12px; color: #555;">${rr.displayDistance} · 대기 ${rr.displayWait}</div>
        </div>
      `).on('click', () => handleRestaurantSelect(rr));
    });

    const myIcon = L.icon({
      iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDMTMuMSAyIDE0IDIuOSAxNCA0QzE0IDUuMSAxMy4xIDYgMTIgNkMxMC45IDYgMTAgNS4xIDEwIDRDMTAgMi45IDEwLjkgMiAxMiAyWk0xMiA3QzEzLjY1IDcgMTUgOC4zNSAxNSA5QzE1IDEwLjY1IDEzLjY1IDEyIDEyIDEyQzEwLjM1IDEyIDkgMTAuNjUgOSA5QzkgOC4zNSAxMC4zNSA3IDEyIDdaIiBmaWxsPSIjZDQyNDA0Ii8+Cjwvc3ZnPgo=',
      iconSize: [24, 24]
    });
    L.marker([USER_LOCATION.lat, USER_LOCATION.lng], { icon: myIcon })
      .addTo(markerLayer)
      .bindPopup('내 위치 (광운대학교)');
  }, [enrichedFiltered]);

  return (
    <div className="page">
      {/* 헤더 */}
      <div className="header">
        <div>
          <div className="header-location">📍 광운대학교</div>
          <div className="header-title">캠퍼스 주변 가상 맛집</div>
        </div>
        <div className="header-buttons">
          <span className="user-info">안녕하세요, {user?.username}님</span>
          <button className="orders-btn" onClick={() => navigate("orders")}>
            📋 주문내역
          </button>
          <button className="logout-btn" onClick={logout}>
            로그아웃
          </button>
          <button className="qr-btn" onClick={() => navigate("qr")}>
            <span className="qr-icon">⬛</span>
            QR
          </button>
        </div>
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

      {/* 지도 영역 */}
      <div className="map-area">
        <div ref={mapRef} style={{ height: '220px', width: '100%', borderRadius: '20px' }} />
      </div>

      {/* 음식점 리스트 */}
      <div className="list-section">
        <div className="list-header">
          <span className="list-title">근처 {enrichedFiltered.length}곳</span>
          <span className="list-sort">거리순 ▾</span>
        </div>
        <div className="restaurant-list">
          {enrichedFiltered.map(r => (
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
              ⭐ {selected.displayRating ?? selected.rating} ({selected.displayReviewCount ?? selected.reviewCount}) · {selected.displayDistance ?? selected.distance} · 대기 {selected.displayWait ?? selected.wait}
            </div>
            <div className="review-preview-box">
              <div className="review-preview-title">최근 후기</div>
              {(selected.recentReviews || []).length === 0 ? (
                <div className="review-empty">아직 등록된 후기가 없습니다.</div>
              ) : (
                <div className="review-list-mini">
                  {(selected.recentReviews || []).map(rv => (
                    <div key={rv.orderId || rv.time} className="review-item-mini">
                      <div className="review-stars">{'★'.repeat(rv.rating)}{'☆'.repeat(5 - rv.rating)}</div>
                      <div className="review-text">{rv.review || '만족스러운 식사였어요.'}</div>
                    </div>
                  ))}
                </div>
              )}
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
          ⭐ {r.displayRating ?? r.rating} ({r.displayReviewCount ?? r.reviewCount}) · {r.displayDistance ?? r.distance} · 대기 <b>{r.displayWait ?? r.wait}</b>
        </div>
      </div>
      <div className="r-arrow">›</div>
    </div>
  );
}

// ───────── 자리 선택 페이지 ─────────
function SeatPage({ restaurant, navigate, setSelectedSeat, seats }) {
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
          {seats.map(seat => (
            <div
              key={`${seat.restaurantId}-${seat.id}`}
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
function OrderPage({ restaurant, seat, orderType, orderMode, cart, addToCart, removeFromCart, navigate, user }) {
  const [activeTab, setActiveTab] = useState("추천");
  const [showComplete, setShowComplete] = useState(false);

  const totalCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const totalPrice = Object.entries(cart).reduce((sum, [id, qty]) => {
    const allItems = Object.values(restaurant.menu).flat();
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
          {!isReserveOnly && (
            <div className="complete-note">주문하신 음식은 5분 후에 준비됩니다.</div>
          )}
          {isReserveOnly && (
            <div className="complete-note">예약하신 시간에 방문해 주세요.</div>
          )}
          <button className="complete-btn" onClick={() => navigate("main")}>
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
          <button className="submit-btn" onClick={async () => {
            const orderData = {
              userId: user.id,
              restaurantId: restaurant.id,
              seatId: seat?.id,
              items: {},
              totalPrice: 0,
              type: 'reservation',
              timestamp: new Date().toISOString()
            };
            try {
              await fetch(`${API_URL}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
              });
              // 좌석 예약수 업데이트
              if (seat) {
                await fetch(`${API_URL}/seats/${seat.id}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ reservations: seat.capacity, restaurantId: restaurant.id })
                });
              }
              setShowComplete(true);
            } catch (error) {
              console.error('Reservation failed', error);
            }
          }}>
            예약 확정하기
          </button>
        </div>
      ) : (
        <>
          {/* 메뉴 탭 */}
          <div className="menu-tabs">
            {Object.keys(restaurant.menu).map(tab => (
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
            {restaurant.menu[activeTab].map(item => (
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
              <button className="order-submit" onClick={async () => {
                const orderData = {
                  userId: user.id,
                  restaurantId: restaurant.id,
                  seatId: seat?.id,
                  items: cart,
                  totalPrice,
                  type: orderType,
                  timestamp: new Date().toISOString()
                };
                try {
                  const response = await fetch(`${API_URL}/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderData)
                  });
                  if (response.ok) {
                    if (orderType === 'reservation' && seat) {
                      await fetch(`${API_URL}/seats/${seat.id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reservations: seat.capacity, restaurantId: restaurant.id })
                      });
                    }
                    console.log('Order sent successfully');
                    setShowComplete(true);
                  } else {
                    console.error('Order failed:', response.status);
                  }
                } catch (error) {
                  console.error('Order error:', error);
                }
              }}>
                {orderType === "takeout" ? "포장 주문하기" : "주문 확정하기"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ───────── 결제 페이지 ─────────
function PaymentPage({ navigate, paymentContext, onConfirmPayment }) {
  const [method, setMethod] = useState('onsite_card');
  const [amount, setAmount] = useState(paymentContext?.suggestedAmount || 0);
  const [paying, setPaying] = useState(false);

  if (!paymentContext) {
    return (
      <div className="page center-page">
        <div className="complete-wrap">
          <div className="complete-title">결제 정보가 없습니다.</div>
          <button className="complete-btn" onClick={() => navigate('main')}>홈으로</button>
        </div>
      </div>
    );
  }

  const handlePay = async () => {
    setPaying(true);
    await new Promise(resolve => setTimeout(resolve, 1200)); // 시연용 결제 처리 애니메이션
    await onConfirmPayment({
      restaurantId: paymentContext.restaurantId,
      seatId: paymentContext.seatId,
      amount,
      method
    });
    setPaying(false);
  };

  return (
    <div className="page payment-page">
      <div className="nav-header">
        <button className="back-btn" onClick={() => navigate('main')}>←</button>
        <div className="nav-title">테이블 결제</div>
        <div />
      </div>

      <div className="payment-wrap">
        <div className="payment-card">
          <div className="payment-title">결제 정보</div>
          <div className="payment-row"><span>매장</span><b>{paymentContext.restaurantName}</b></div>
          <div className="payment-row"><span>좌석</span><b>{paymentContext.seatId} {paymentContext.seatType ? `(${paymentContext.seatType})` : ''}</b></div>
          <div className="payment-row"><span>결제 금액</span><b>{Number(amount).toLocaleString()}원</b></div>
        </div>

        <div className="payment-card">
          <div className="payment-title">결제 수단</div>
          <button
            className={`payment-method ${method === 'onsite_card' ? 'active' : ''}`}
            onClick={() => setMethod('onsite_card')}
          >
            현장 카드 결제
          </button>
          <button
            className={`payment-method ${method === 'web_card' ? 'active' : ''}`}
            onClick={() => setMethod('web_card')}
          >
            웹 카드 결제
          </button>
          <button
            className={`payment-method ${method === 'simple_pay' ? 'active' : ''}`}
            onClick={() => setMethod('simple_pay')}
          >
            간편 결제
          </button>
        </div>

        <button className="payment-submit" onClick={handlePay} disabled={paying}>
          {paying ? '결제 처리중...' : '결제하기'}
        </button>
        <div className="payment-hint">
          결제 요청이 POS에 알림으로 전달되고, 결제 완료 후 좌석은 자동으로 빈자리 처리됩니다.
        </div>
      </div>
    </div>
  );
}

// ───────── QR 페이지 ─────────
function QRPage({ navigate, onPayment }) {
  const videoRef = useRef(null);
  const scanLockRef = useRef(false);

  const parseQrData = (raw) => {
    // 지원 포맷:
    // 1) 1:A1
    // 2) {"restaurantId":1,"seatId":"A1"}
    // 3) restaurantId=1&seatId=A1 또는 URL query
    const text = String(raw || '').trim();
    if (!text) return null;

    const normalize = (restaurantId, seatId) => {
      const rid = parseInt(String(restaurantId), 10);
      const sid = String(seatId || '').trim().toUpperCase();
      if (Number.isNaN(rid) || !sid) return null;
      return { restaurantId: rid, seatId: sid };
    };

    // 0) URL 인코딩된 데이터 먼저 복호화 시도
    let decoded = text;
    try {
      decoded = decodeURIComponent(text);
    } catch (_) {
      decoded = text;
    }

    // 1) JSON
    try {
      const parsed = JSON.parse(decoded);
      const normalized = normalize(parsed.restaurantId, parsed.seatId);
      if (normalized) return normalized;
    } catch (_) {
      // JSON 아님
    }

    // 2) "1:A1" 형식
    const parts = decoded.split(':');
    if (parts.length === 2) {
      const normalized = normalize(parts[0], parts[1]);
      if (normalized) return normalized;
    }

    // 3) query string 형식
    try {
      const asUrl = decoded.includes('://') ? new URL(decoded) : new URL(`https://dummy.local/?${decoded}`);
      const rid = asUrl.searchParams.get('restaurantId');
      const sid = asUrl.searchParams.get('seatId');
      const normalized = normalize(rid, sid);
      if (normalized) return normalized;
    } catch (_) {
      // URL parse 실패 시 무시
    }

    // 4) 텍스트 내부에서 패턴 추출 (예: "table=1:A1")
    const match = decoded.match(/(\d+)\s*[:\-]\s*([A-Za-z]\d+)/);
    if (match) {
      const normalized = normalize(match[1], match[2]);
      if (normalized) return normalized;
    }

    return null;
  };

  useEffect(() => {
    if (videoRef.current) {
      const qrScanner = new QrScanner(videoRef.current, result => {
        if (scanLockRef.current) return;

        const rawValue = typeof result === 'string' ? result : (result?.data ?? result?.text ?? '');
        const parsed = parseQrData(rawValue);
        if (!parsed) {
          alert(`QR 형식이 올바르지 않습니다.\n스캔값: ${String(rawValue)}\n예시: 1:A1`);
          return;
        }

        scanLockRef.current = true;
        qrScanner.stop();
        onPayment(parsed);
      });
      qrScanner.start().catch(console.error);
      return () => {
        scanLockRef.current = false;
        qrScanner.destroy();
      };
    }
  }, [onPayment]);

  return (
    <div className="page center-page">
      <div className="nav-header" style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
        <button className="back-btn" onClick={() => navigate("main")}>←</button>
        <div className="nav-title">QR 스캔</div>
        <div />
      </div>
      <div className="qr-wrap">
        <video ref={videoRef} style={{ width: '260px', height: '260px', borderRadius: '20px' }} />
        <div className="qr-hint">매장 테이블의 QR코드를<br />스캔해 주세요<br />(예: 1:A1)</div>
      </div>
    </div>
  );
}

// ───────── 로그인 페이지 ─────────
function LoginPage({ navigate, login }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    console.log('Logging in:', username, password);
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);
      if (response.ok) {
        login(data.user);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Network error');
    }
  };

  return (
    <div className="page center-page">
      <div className="auth-wrap">
        <div className="auth-title">로그인</div>
        <input
          type="text"
          placeholder="아이디"
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="auth-input"
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="auth-input"
        />
        {error && <div className="auth-error">{error}</div>}
        <button className="auth-btn" onClick={handleLogin}>로그인</button>
        <button className="auth-link" onClick={() => navigate("register")}>회원가입</button>
      </div>
    </div>
  );
}

// ───────── 회원가입 페이지 ─────────
function RegisterPage({ navigate, login }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleRegister = async () => {
    console.log('Registering:', username, password);
    try {
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);
      if (response.ok) {
        login(data.user);
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      console.error('Register error:', err);
      setError('Network error');
    }
  };

  return (
    <div className="page center-page">
      <div className="auth-wrap">
        <div className="auth-title">회원가입</div>
        <input
          type="text"
          placeholder="아이디"
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="auth-input"
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="auth-input"
        />
        {error && <div className="auth-error">{error}</div>}
        <button className="auth-btn" onClick={handleRegister}>회원가입</button>
        <button className="auth-link" onClick={() => navigate("login")}>로그인</button>
      </div>
    </div>
  );
}

// ───────── POS 시스템 페이지 ─────────
function POSPage({ user, logout }) {
  const [reservations, setReservations] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [seats, setSeats] = useState([]);
  const [activeTab, setActiveTab] = useState('seats'); // seats | reservations | orders | sales | qr | payments | menu
  const [menuDraft, setMenuDraft] = useState({});
  const [savingMenuId, setSavingMenuId] = useState(null);
  const [draggingSeatId, setDraggingSeatId] = useState(null);
  const seatMapRef = useRef(null);
  const dragStateRef = useRef(null);
  const suppressClickRef = useRef(null);

  useEffect(() => {
    fetchRestaurants();
    fetchReservations();
    fetchOrders();
    fetchSeats();
    fetchPayments();

    const timer = setInterval(() => {
      fetchPayments();
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  const fetchRestaurants = async () => {
    try {
      const response = await fetch(`${API_URL}/restaurants`);
      const data = await response.json();
      setRestaurants(data);
    } catch (err) {
      console.error('Error fetching restaurants:', err);
    }
  };

  const fetchReservations = async () => {
    try {
      const response = await fetch(`${API_URL}/reservations/${user.restaurantId}`);
      const data = await response.json();
      setReservations(data);
    } catch (err) {
      console.error('Error fetching reservations:', err);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await fetch(`${API_URL}/orders/restaurant/${user.restaurantId}`);
      const data = await response.json();
      setOrders(data);
    } catch (err) {
      console.error('Error fetching orders:', err);
    }
  };

  const fetchSeats = async () => {
    try {
      const response = await fetch(`${API_URL}/seats?restaurantId=${user.restaurantId}`);
      const data = await response.json();
      setSeats(data);
    } catch (err) {
      console.error('Error fetching seats:', err);
    }
  };

  const fetchPayments = async () => {
    try {
      const response = await fetch(`${API_URL}/payments/${user.restaurantId}`);
      const data = await response.json();
      setPayments(data);
    } catch (err) {
      console.error('Error fetching payments:', err);
    }
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const updateSeatStatus = async (seatId, reservations) => {
    try {
      await fetch(`${API_URL}/seats/${seatId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservations, restaurantId: user.restaurantId })
      });
    await fetchSeats(); // 좌석 정보 새로고침
    } catch (err) {
      console.error('Error updating seat:', err);
    }
  };

  const saveSeatPosition = async (seatId, x, y) => {
    try {
      await fetch(`${API_URL}/seats/${seatId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: user.restaurantId, x, y })
      });
      await fetchSeats();
    } catch (err) {
      console.error('Error saving seat position:', err);
    }
  };

  const startSeatDrag = (event, seat) => {
    event.preventDefault();
    event.stopPropagation();

    const container = seatMapRef.current;
    const seatElement = event.currentTarget.closest('.pos-seat');
    if (!container || !seatElement) return;

    const containerRect = container.getBoundingClientRect();
    const seatRect = seatElement.getBoundingClientRect();
    const seatWidthPercent = (seatRect.width / containerRect.width) * 100;
    const seatHeightPercent = (seatRect.height / containerRect.height) * 100;

    dragStateRef.current = {
      seatId: seat.id,
      restaurantId: seat.restaurantId,
      offsetX: event.clientX - seatRect.left,
      offsetY: event.clientY - seatRect.top,
      seatWidthPercent,
      seatHeightPercent,
      nextX: seat.x,
      nextY: seat.y,
      moved: false,
    };
    suppressClickRef.current = null;
    setDraggingSeatId(seat.id);

    const handleMove = (moveEvent) => {
      const drag = dragStateRef.current;
      if (!drag || drag.seatId !== seat.id) return;

      const nextX = clamp(
        ((moveEvent.clientX - containerRect.left - drag.offsetX) / containerRect.width) * 100,
        0,
        Math.max(0, 100 - drag.seatWidthPercent)
      );
      const nextY = clamp(
        ((moveEvent.clientY - containerRect.top - drag.offsetY) / containerRect.height) * 100,
        0,
        Math.max(0, 100 - drag.seatHeightPercent)
      );

      if (Math.abs(nextX - drag.nextX) > 0.05 || Math.abs(nextY - drag.nextY) > 0.05) {
        drag.moved = true;
      }

      drag.nextX = nextX;
      drag.nextY = nextY;

      setSeats(prev => prev.map(s => {
        if (s.id !== seat.id || s.restaurantId !== seat.restaurantId) return s;
        return { ...s, x: nextX, y: nextY };
      }));
    };

    const endDrag = async () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);

      const drag = dragStateRef.current;
      dragStateRef.current = null;
      setDraggingSeatId(null);

      if (!drag || !drag.moved) {
        return;
      }

      suppressClickRef.current = `${seat.restaurantId}-${seat.id}`;
      setTimeout(() => {
        if (suppressClickRef.current === `${seat.restaurantId}-${seat.id}`) {
          suppressClickRef.current = null;
        }
      }, 0);

      await saveSeatPosition(seat.id, drag.nextX, drag.nextY);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  };

  const updateOrderStatus = async (orderRef, status) => {
    try {
      const response = await fetch(`${API_URL}/orders/update-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: orderRef.id,
          status,
          restaurantId: orderRef.restaurantId,
          timestamp: orderRef.timestamp,
          seatId: orderRef.seatId,
          userId: orderRef.userId,
          type: orderRef.type
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '주문 상태 업데이트 실패');
      }

      await Promise.all([fetchOrders(), fetchReservations()]); // 주문/예약 정보 새로고침
    } catch (err) {
      console.error('Error updating order:', err);
    }
  };

  const updatePaymentStatus = async (paymentId, status) => {
    try {
      const response = await fetch(`${API_URL}/payments/${paymentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error('결제 상태 변경 실패');
      }

      await fetchPayments();
    } catch (err) {
      console.error('Error updating payment:', err);
    }
  };

  const restaurant = restaurants.find(r => r.id === user.restaurantId);
  const totalSales = orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
  const completedOrders = orders.filter(o => (o.status || 'pending') === 'completed').length;
  const pendingPayments = payments.filter(p => (p.status || 'requested') === 'requested').length;

  useEffect(() => {
    if (!restaurant?.menu) return;
    const draft = {};
    Object.keys(restaurant.menu).forEach(category => {
      (restaurant.menu[category] || []).forEach(item => {
        draft[item.id] = {
          name: item.name,
          price: item.price,
          desc: item.desc || ''
        };
      });
    });
    setMenuDraft(draft);
  }, [restaurant?.id, restaurants]);

  const updateMenuDraft = (itemId, patch) => {
    setMenuDraft(prev => ({
      ...prev,
      [itemId]: {
        name: prev[itemId]?.name || '',
        price: prev[itemId]?.price || 0,
        desc: prev[itemId]?.desc || '',
        ...patch
      }
    }));
  };

  const saveMenuItem = async (itemId) => {
    if (!restaurant) return;
    const draft = menuDraft[itemId];
    if (!draft || !draft.name) return;

    try {
      setSavingMenuId(itemId);
      const response = await fetch(`${API_URL}/restaurants/${restaurant.id}/menu/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          price: Number(draft.price),
          desc: draft.desc
        })
      });
      if (!response.ok) {
        throw new Error('메뉴 저장 실패');
      }
      await fetchRestaurants();
    } catch (err) {
      console.error('Error saving menu item:', err);
    } finally {
      setSavingMenuId(null);
    }
  };

  const getSeatQrValue = (seat) => `${user.restaurantId}:${seat.id}`;

  const getSeatQrLink = (seat) => {
    const url = new URL(window.location.href);
    url.pathname = '/';
    url.search = '';
    url.searchParams.set('qr', '1');
    url.searchParams.set('restaurantId', String(user.restaurantId));
    url.searchParams.set('seatId', String(seat.id));
    return url.toString();
  };

  const getSeatQrImageUrl = (seat) => {
    const qrValue = encodeURIComponent(getSeatQrLink(seat));
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${qrValue}`;
  };

  const printAllSeatQrs = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    const cardsHtml = seats
      .map(
        (seat) => `
          <div class="print-qr-card">
            <div class="print-qr-title">${restaurant?.name || '식당'} - ${seat.id}</div>
            <img src="${getSeatQrImageUrl(seat)}" alt="QR ${seat.id}" class="print-qr-img" />
            <div class="print-qr-code">${getSeatQrValue(seat)}</div>
          </div>
        `
      )
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>테이블 QR 인쇄</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; }
            h1 { font-size: 22px; margin-bottom: 12px; }
            .print-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
            .print-qr-card { border: 1px solid #ddd; border-radius: 10px; padding: 12px; text-align: center; }
            .print-qr-title { font-size: 15px; font-weight: bold; margin-bottom: 8px; }
            .print-qr-img { width: 180px; height: 180px; }
            .print-qr-code { margin-top: 8px; color: #666; font-size: 12px; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <h1>${restaurant?.name || '식당'} 테이블 QR 코드</h1>
          <div class="print-grid">${cardsHtml}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="page">
      <div className="pos-header">
        <div className="pos-title">{restaurant?.name || '식당'} POS</div>
        <button className="logout-btn" onClick={logout}>로그아웃</button>
      </div>

      {/* 탭 메뉴 */}
      <div className="pos-tabs">
        <button 
          className={`pos-tab ${activeTab === 'seats' ? 'active' : ''}`}
          onClick={() => setActiveTab('seats')}
        >
          🪑 좌석
        </button>
        <button 
          className={`pos-tab ${activeTab === 'reservations' ? 'active' : ''}`}
          onClick={() => setActiveTab('reservations')}
        >
          📅 예약 ({reservations.length})
        </button>
        <button 
          className={`pos-tab ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          📋 주문 ({orders.length})
        </button>
        <button 
          className={`pos-tab ${activeTab === 'sales' ? 'active' : ''}`}
          onClick={() => setActiveTab('sales')}
        >
          💰 매출
        </button>
        <button 
          className={`pos-tab ${activeTab === 'qr' ? 'active' : ''}`}
          onClick={() => setActiveTab('qr')}
        >
          🔳 QR
        </button>
        <button 
          className={`pos-tab ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => setActiveTab('payments')}
        >
          🔔 결제 {pendingPayments > 0 ? `(${pendingPayments})` : ''}
        </button>
        <button 
          className={`pos-tab ${activeTab === 'menu' ? 'active' : ''}`}
          onClick={() => setActiveTab('menu')}
        >
          🍽 메뉴관리
        </button>
      </div>

      {/* 좌석 탭 */}
      {activeTab === 'seats' && (
        <div className="pos-section">
          <div className="pos-section-title">🪑 좌석 현황</div>
          <div className="pos-floor-wrap">
            <div className="pos-floor-label">입구 ↓</div>
            <div className="pos-floor-map" ref={seatMapRef}>
              <div className="pos-kitchen-area">🍳 주방</div>
              {seats.map(seat => (
                <div
                  key={`${seat.restaurantId}-${seat.id}`}
                  className={`pos-seat ${seat.reservations >= seat.capacity ? "full" : "available"} ${draggingSeatId === seat.id ? 'dragging' : ''}`}
                  style={{
                    left: `${seat.x}%`,
                    top: `${seat.y}%`,
                    cursor: draggingSeatId === seat.id ? 'grabbing' : 'grab',
                  }}
                  onClick={() => {
                    if (suppressClickRef.current === `${seat.restaurantId}-${seat.id}`) {
                      suppressClickRef.current = null;
                      return;
                    }
                    if (seat.reservations >= seat.capacity) {
                      // 만석인 경우 클릭해서 빈 자리로 만들기
                      updateSeatStatus(seat.id, 0);
                    } else {
                      // 빈 자리인 경우 클릭해서 만석으로 만들기
                      updateSeatStatus(seat.id, seat.capacity);
                    }
                  }}
                >
                  <div
                    className="pos-seat-handle"
                    onPointerDown={(e) => startSeatDrag(e, seat)}
                    title="드래그해서 위치 변경"
                  >
                    ↕ 이동
                  </div>
                  <div className="pos-seat-id">{seat.id}</div>
                  <div className="pos-seat-type">{seat.type}</div>
                  <div className="pos-seat-count">
                    {seat.reservations >= seat.capacity
                      ? "만석"
                      : `${seat.reservations}/${seat.capacity}명`}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="pos-legend">
            <span className="pos-leg-item"><span className="pos-leg-dot available"></span>빈 자리</span>
            <span className="pos-leg-item"><span className="pos-leg-dot full"></span>만석</span>
            <div className="pos-legend-note">좌석을 클릭하여 상태를 변경할 수 있습니다.</div>
          </div>
        </div>
      )}

      {/* 예약 탭 */}
      {activeTab === 'reservations' && (
        <div className="pos-section">
          <div className="pos-section-title">📅 오늘의 예약 ({reservations.length}건)</div>
          {reservations.length === 0 ? (
            <div className="pos-empty">예약이 없습니다.</div>
          ) : (
            <div className="pos-list">
              {reservations.map((res, idx) => (
                <div key={idx} className="pos-card">
                  <div className="pos-card-header">
                    <div className="pos-card-title">예약 #{idx + 1}</div>
                    <div className="pos-card-time">{new Date(res.timestamp).toLocaleTimeString()}</div>
                  </div>
                  <div className="pos-card-details">
                    <div><strong>좌석:</strong> {res.seatId}</div>
                    <div><strong>인원:</strong> {res.seatId ? '1명' : ''}</div>
                    <div><strong>고객ID:</strong> {res.userId}</div>
                  </div>
                  <div className="pos-card-actions">
                    {(res.status || 'pending') !== 'completed' && (res.status || 'pending') !== 'cancelled' && (
                      <button 
                        className="pos-btn-check"
                        onClick={() => {
                          updateOrderStatus(res, 'completed');
                        }}
                      >
                        ✓ 체크인
                      </button>
                    )}
                    {(res.status || 'pending') !== 'completed' && (res.status || 'pending') !== 'cancelled' && (
                      <button 
                        className="pos-btn-cancel"
                        onClick={() => {
                          updateOrderStatus(res, 'cancelled');
                        }}
                      >
                        ✕ 취소
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 주문 탭 */}
      {activeTab === 'orders' && (
        <div className="pos-section">
          <div className="pos-section-title">📋 주문 현황 ({orders.length}건)</div>
          {orders.length === 0 ? (
            <div className="pos-empty">주문이 없습니다.</div>
          ) : (
            <div className="pos-list">
              {orders.map((order, idx) => (
                <div key={idx} className="pos-card">
                  <div className="pos-card-header">
                    <div className="pos-card-title">주문 #{idx + 1}</div>
                    <div className="pos-order-status" style={{
                      background: (order.status || 'pending') === 'completed' ? '#10b981' : (order.status || 'pending') === 'cancelled' ? '#ef4444' : '#f59e0b',
                      color: 'white'
                    }}>
                      {(order.status || 'pending') === 'completed' ? '완료' : (order.status || 'pending') === 'cancelled' ? '취소' : '준비중'}
                    </div>
                  </div>
                  <div className="pos-card-details">
                    <div><strong>가격:</strong> {order.totalPrice?.toLocaleString()}원</div>
                    {Object.keys(order.items).length > 0 && (
                      <div><strong>메뉴:</strong> {Object.keys(order.items).length}종류</div>
                    )}
                    <div><strong>시간:</strong> {new Date(order.timestamp).toLocaleTimeString()}</div>
                  </div>
                  <div className="pos-card-actions">
                    {(order.status || 'pending') !== 'completed' && (order.status || 'pending') !== 'cancelled' && (
                      <button 
                        className="pos-btn-complete"
                        onClick={() => {
                          updateOrderStatus(order, 'completed');
                        }}
                      >
                        완료
                      </button>
                    )}
                    {(order.status || 'pending') !== 'completed' && (order.status || 'pending') !== 'cancelled' && (
                      <button 
                        className="pos-btn-cancel"
                        onClick={() => {
                          updateOrderStatus(order, 'cancelled');
                        }}
                      >
                        취소
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 매출 탭 */}
      {activeTab === 'sales' && (
        <div className="pos-section">
          <div className="pos-stat-grid">
            <div className="pos-stat">
              <div className="pos-stat-label">총 주문</div>
              <div className="pos-stat-value">{orders.length}건</div>
            </div>
            <div className="pos-stat">
              <div className="pos-stat-label">완료된 주문</div>
              <div className="pos-stat-value">{completedOrders}건</div>
            </div>
            <div className="pos-stat">
              <div className="pos-stat-label">총 매출</div>
              <div className="pos-stat-value">{totalSales.toLocaleString()}원</div>
            </div>
            <div className="pos-stat">
              <div className="pos-stat-label">평균 주문가</div>
              <div className="pos-stat-value">{orders.length > 0 ? (totalSales / orders.length).toLocaleString() : 0}원</div>
            </div>
          </div>
        </div>
      )}

      {/* QR 탭 */}
      {activeTab === 'qr' && (
        <div className="pos-section">
          <div className="pos-qr-header">
            <div className="pos-section-title">🔳 테이블 QR 코드</div>
            <button className="pos-btn-print" onClick={printAllSeatQrs}>전체 인쇄</button>
          </div>

          {seats.length === 0 ? (
            <div className="pos-empty">좌석 정보가 없습니다.</div>
          ) : (
            <div className="pos-qr-grid">
              {seats.map((seat) => (
                <div key={`qr-${seat.restaurantId}-${seat.id}`} className="pos-qr-card">
                  <div className="pos-qr-title">{seat.id} ({seat.type})</div>
                  <img
                    src={getSeatQrImageUrl(seat)}
                    alt={`QR ${seat.id}`}
                    className="pos-qr-image"
                  />
                  <div className="pos-qr-value">{getSeatQrValue(seat)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 결제 알림 탭 */}
      {activeTab === 'payments' && (
        <div className="pos-section">
          <div className="pos-section-title">🔔 결제 요청 ({payments.length}건)</div>
          {payments.length === 0 ? (
            <div className="pos-empty">결제 요청이 없습니다.</div>
          ) : (
            <div className="pos-list">
              {payments.map((payment) => (
                <div key={payment.id} className="pos-card">
                  <div className="pos-card-header">
                    <div className="pos-card-title">좌석 {payment.seatId}</div>
                    <div className="pos-order-status" style={{
                      background: (payment.status || 'requested') === 'requested' ? '#f59e0b' : '#10b981',
                      color: 'white'
                    }}>
                      {(payment.status || 'requested') === 'requested' ? '요청' : '승인완료'}
                    </div>
                  </div>
                  <div className="pos-card-details">
                    <div><strong>금액:</strong> {(payment.amount || 0).toLocaleString()}원</div>
                    <div><strong>수단:</strong> {payment.method === 'onsite_card' ? '현장 카드' : payment.method === 'web_card' ? '웹 카드' : '간편 결제'}</div>
                    <div><strong>시간:</strong> {new Date(payment.timestamp).toLocaleTimeString()}</div>
                  </div>
                  {(payment.status || 'requested') === 'requested' && (
                    <div className="pos-card-actions">
                      <button
                        className="pos-btn-check"
                        onClick={() => updatePaymentStatus(payment.id, 'approved')}
                      >
                        결제 승인
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 메뉴관리 탭 */}
      {activeTab === 'menu' && (
        <div className="pos-section">
          <div className="pos-section-title">🍽 메뉴/가격 수정</div>
          {!restaurant?.menu ? (
            <div className="pos-empty">메뉴 정보가 없습니다.</div>
          ) : (
            <div className="menu-admin-wrap">
              {Object.keys(restaurant.menu).map(category => (
                <div key={category} className="menu-admin-category">
                  <div className="menu-admin-category-title">{category}</div>
                  {(restaurant.menu[category] || []).map(item => (
                    <div key={`${category}-${item.id}`} className="menu-admin-item">
                      <input
                        className="menu-admin-input"
                        value={menuDraft[item.id]?.name ?? item.name}
                        onChange={e => updateMenuDraft(item.id, { name: e.target.value })}
                        placeholder="메뉴명"
                      />
                      <input
                        className="menu-admin-input"
                        type="number"
                        value={menuDraft[item.id]?.price ?? item.price}
                        onChange={e => updateMenuDraft(item.id, { price: e.target.value })}
                        placeholder="가격"
                      />
                      <input
                        className="menu-admin-input"
                        value={menuDraft[item.id]?.desc ?? (item.desc || '')}
                        onChange={e => updateMenuDraft(item.id, { desc: e.target.value })}
                        placeholder="설명"
                      />
                      <button
                        className="menu-admin-save"
                        onClick={() => saveMenuItem(item.id)}
                        disabled={savingMenuId === item.id}
                      >
                        {savingMenuId === item.id ? '저장중...' : '저장'}
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ───────── 관리자 페이지 ─────────
function AdminPage({ user, logout }) {
  const [users, setUsers] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRestaurantName, setNewRestaurantName] = useState('');
  const [newRestaurantCategory, setNewRestaurantCategory] = useState('한식');
  const [newRestaurantImage, setNewRestaurantImage] = useState('🍽');
  const [newRestaurantLat, setNewRestaurantLat] = useState('37.6199');
  const [newRestaurantLng, setNewRestaurantLng] = useState('127.0593');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchRestaurantsAdmin();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/users`);
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('사용자 목록을 불러올 수 없습니다.');
    }
  };

  const fetchRestaurantsAdmin = async () => {
    try {
      const response = await fetch(`${API_URL}/restaurants`);
      const data = await response.json();
      setRestaurants(data);
    } catch (err) {
      console.error('Error fetching restaurants:', err);
      setError('매장 목록을 불러올 수 없습니다.');
    }
  };

  const handleAddRestaurant = async () => {
    if (!newRestaurantName.trim()) {
      setError('매장 이름을 입력해주세요.');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/restaurants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRestaurantName.trim(),
          category: newRestaurantCategory,
          image: newRestaurantImage || '🍽',
          tags: ['가상매장'],
          lat: Number(newRestaurantLat),
          lng: Number(newRestaurantLng)
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || '매장 추가 실패');
        return;
      }

      setSuccess('매장이 추가되었습니다.');
      setError('');
      setNewRestaurantName('');
      fetchRestaurantsAdmin();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Error adding restaurant:', err);
      setError('네트워크 오류입니다.');
    }
  };

  const handleDeleteRestaurant = async (restaurant) => {
    if (!window.confirm(`${restaurant.name} 매장을 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch(`${API_URL}/restaurants/${restaurant.id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || '매장 삭제 실패');
        return;
      }

      setSuccess('매장이 삭제되었습니다.');
      setError('');
      fetchRestaurantsAdmin();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Error deleting restaurant:', err);
      setError('네트워크 오류입니다.');
    }
  };

  const handleAddUser = async () => {
    if (!newUsername || !newPassword) {
      setError('아이디와 비번을 입력해주세요.');
      return;
    }
    try {
      const response = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword })
      });
      const data = await response.json();
      if (response.ok) {
        setSuccess('사용자가 추가되었습니다.');
        setNewUsername('');
        setNewPassword('');
        setError('');
        setTimeout(() => setSuccess(''), 2000);
        fetchUsers();
      } else {
        setError(data.error || '사용자 추가 실패');
      }
    } catch (err) {
      console.error('Error adding user:', err);
      setError('네트워크 오류입니다.');
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (username === 'admin') {
      setError('관리자 계정은 삭제할 수 없습니다.');
      return;
    }
    if (!window.confirm(`${username}을 정말 삭제하시겠습니까?`)) return;

    try {
      const response = await fetch(`${API_URL}/users/${userId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (response.ok) {
        setSuccess('사용자가 삭제되었습니다.');
        setError('');
        setTimeout(() => setSuccess(''), 2000);
        fetchUsers();
      } else {
        setError(data.error || '사용자 삭제 실패');
      }
    } catch (err) {
      console.error('Error deleting user:', err);
      setError('네트워크 오류입니다.');
    }
  };

  const handleEditUser = async (userId) => {
    if (!editUsername || !editPassword) {
      setError('아이디와 비번을 입력해주세요.');
      return;
    }
    try {
      const response = await fetch(`${API_URL}/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: editUsername, password: editPassword })
      });
      const data = await response.json();
      if (response.ok) {
        setSuccess('사용자 정보가 수정되었습니다.');
        setError('');
        setEditingId(null);
        setTimeout(() => setSuccess(''), 2000);
        fetchUsers();
      } else {
        setError(data.error || '수정 실패');
      }
    } catch (err) {
      console.error('Error updating user:', err);
      setError('네트워크 오류입니다.');
    }
  };

  return (
    <div className="page">
      <div className="admin-header">
        <div className="admin-title">👨‍💼 계정 관리</div>
        <button className="logout-btn" onClick={logout}>
          로그아웃
        </button>
      </div>

      {/* 새 사용자 추가 */}
      <div className="admin-section">
        <div className="admin-section-title">새 계정 추가</div>
        <input
          type="text"
          placeholder="아이디"
          value={newUsername}
          onChange={e => setNewUsername(e.target.value)}
          className="admin-input"
        />
        <input
          type="text"
          placeholder="비밀번호"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          className="admin-input"
        />
        {error && <div className="admin-error">{error}</div>}
        {success && <div className="admin-success">{success}</div>}
        <button className="admin-btn" onClick={handleAddUser}>계정 추가</button>
      </div>

      {/* 매장 관리 */}
      <div className="admin-section">
        <div className="admin-section-title">매장 추가 / 삭제</div>
        <input
          type="text"
          placeholder="매장 이름"
          value={newRestaurantName}
          onChange={e => setNewRestaurantName(e.target.value)}
          className="admin-input"
        />
        <select
          value={newRestaurantCategory}
          onChange={e => setNewRestaurantCategory(e.target.value)}
          className="admin-input"
        >
          <option value="한식">한식</option>
          <option value="중식">중식</option>
          <option value="일식">일식</option>
          <option value="양식">양식</option>
          <option value="카페">카페</option>
          <option value="분식">분식</option>
        </select>
        <input
          type="text"
          placeholder="이모지 (예: 🍕)"
          value={newRestaurantImage}
          onChange={e => setNewRestaurantImage(e.target.value)}
          className="admin-input"
        />
        <div className="restaurant-coords-row">
          <input
            type="text"
            placeholder="위도"
            value={newRestaurantLat}
            onChange={e => setNewRestaurantLat(e.target.value)}
            className="admin-input"
          />
          <input
            type="text"
            placeholder="경도"
            value={newRestaurantLng}
            onChange={e => setNewRestaurantLng(e.target.value)}
            className="admin-input"
          />
        </div>
        <button className="admin-btn" onClick={handleAddRestaurant}>매장 추가</button>

        <div className="restaurants-admin-list">
          {restaurants.map(r => (
            <div key={r.id} className="restaurant-admin-item">
              <div className="restaurant-admin-info">
                <div className="restaurant-admin-name">{r.image} {r.name}</div>
                <div className="restaurant-admin-meta">#{r.id} · {r.category}</div>
              </div>
              <button className="delete-btn" onClick={() => handleDeleteRestaurant(r)}>삭제</button>
            </div>
          ))}
        </div>
      </div>

      {/* 사용자 목록 */}
      <div className="admin-section">
        <div className="admin-section-title">사용자 목록 ({users.length}명)</div>
        <div className="users-list">
          {users.map(u => (
            <div key={u.id} className="user-item-admin">
              {editingId === u.id ? (
                // 수정 모드
                <div className="user-edit-form">
                  <input
                    type="text"
                    placeholder="아이디"
                    value={editUsername}
                    onChange={e => setEditUsername(e.target.value)}
                    className="admin-input"
                  />
                  <input
                    type="text"
                    placeholder="비밀번호"
                    value={editPassword}
                    onChange={e => setEditPassword(e.target.value)}
                    className="admin-input"
                  />
                  <div className="user-edit-buttons">
                    <button 
                      className="btn-save"
                      onClick={() => handleEditUser(u.id)}
                    >
                      저장
                    </button>
                    <button 
                      className="btn-cancel"
                      onClick={() => setEditingId(null)}
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                // 표시 모드
                <div>
                  <div className="user-info-admin">
                    <div className="user-name">
                      {u.username}
                      {u.type === 'admin' && <span className="admin-badge">관리자</span>}
                      {u.type === 'restaurant_owner' && <span className="owner-badge">식당주인</span>}
                    </div>
                    <div className="user-password">비번: <code>{u.password}</code></div>
                    <div className="user-id">ID: {u.id}</div>
                    {u.restaurantId && <div className="user-rest">식당ID: {u.restaurantId}</div>}
                  </div>
                  <div className="user-actions">
                    {u.username !== 'admin' && (
                      <>
                        <button
                          className="edit-btn"
                          onClick={() => {
                            setEditingId(u.id);
                            setEditUsername(u.username);
                            setEditPassword(u.password);
                          }}
                        >
                          수정
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => handleDeleteUser(u.id, u.username)}
                        >
                          삭제
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OrdersPage({ navigate, user }) {
  const [orders, setOrders] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [ratingDrafts, setRatingDrafts] = useState({});

  useEffect(() => {
    const load = () => {
      fetch(`${API_URL}/restaurants`)
        .then(r => r.json())
        .then(setRestaurants)
        .catch(console.error);
      fetch(`${API_URL}/orders`)
        .then(r => r.json())
        .then(orders => {
          const userOrders = orders
            .filter(o => String(o.userId) === String(user.id))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setOrders(userOrders);
        })
        .catch(console.error);
    };

    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [user.id]);

  const orderStatusText = (status) => {
    const s = status || 'pending';
    if (s === 'completed') return '완료';
    if (s === 'cancelled') return '취소';
    return '준비중';
  };

  const paymentStatusText = (status) => {
    const s = status || 'none';
    if (s === 'paid') return '결제완료';
    if (s === 'requested') return '결제요청';
    if (s === 'approved') return '결제승인';
    return '미결제';
  };

  const updateRatingDraft = (orderId, patch) => {
    setRatingDrafts(prev => ({
      ...prev,
      [orderId]: {
        rating: prev[orderId]?.rating || 5,
        review: prev[orderId]?.review || '',
        ...patch
      }
    }));
  };

  const submitRating = async (order) => {
    const draft = ratingDrafts[order.id];
    const rating = Number(draft?.rating || 0);
    if (!rating) {
      alert('평점을 선택해 주세요.');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/orders/rate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          userId: user.id,
          rating,
          review: draft?.review || ''
        })
      });

      const data = await response.json();
      if (!response.ok) {
        alert(data.error || '평점 저장에 실패했습니다.');
        return;
      }

      setOrders(prev => prev.map(o => String(o.id) === String(order.id) ? data.order : o));
      setRatingDrafts(prev => {
        const next = { ...prev };
        delete next[order.id];
        return next;
      });
    } catch (error) {
      console.error('Rating submit error:', error);
      alert('평점 저장 중 오류가 발생했습니다.');
    }
  };

  const getMenuName = (restaurant, menuId) => {
    if (!restaurant || !restaurant.menu) return `메뉴 #${menuId}`;
    for (const category in restaurant.menu) {
      const item = restaurant.menu[category].find(m => m.id === menuId || m.id === parseInt(menuId));
      if (item) return item.name;
    }
    return `메뉴 #${menuId}`;
  };

  return (
    <div className="page">
      <div className="nav-header">
        <button className="back-btn" onClick={() => navigate("main")}>←</button>
        <div className="nav-title">주문 내역</div>
        <div />
      </div>
      <div className="orders-list">
        {orders.length === 0 ? (
          <div className="no-orders">주문 내역이 없습니다.</div>
        ) : (
          orders.map((order, i) => {
            const restaurant = restaurants.find(r => r.id === order.restaurantId);
            return (
              <div key={i} className="order-card">
                <div className="order-header">주문 #{i+1} - {order.type === 'takeout' ? '포장' : '예약'}</div>
                <div className="order-details">
                  <div><strong>식당:</strong> {restaurant?.name || '알 수 없음'}</div>
                  {order.seatId && <div><strong>좌석:</strong> {order.seatId}</div>}
                  <div><strong>POS 상태:</strong> {orderStatusText(order.status)}</div>
                  <div><strong>결제 상태:</strong> {paymentStatusText(order.paymentStatus)}</div>
                  {Object.keys(order.items).length > 0 && (
                    <div><strong>메뉴:</strong> {Object.entries(order.items).map(([id, qty]) => `${getMenuName(restaurant, id)} x${qty}`).join(', ')}</div>
                  )}
                  <div><strong>총 가격:</strong> {order.totalPrice?.toLocaleString()}원</div>
                  <div><strong>시간:</strong> {new Date(order.timestamp).toLocaleString()}</div>
                </div>

                {order.rating ? (
                  <div className="rating-done">
                    <div><strong>내 평점:</strong> {'★'.repeat(order.rating)}{'☆'.repeat(5 - order.rating)}</div>
                    {order.review && <div className="rating-review">"{order.review}"</div>}
                  </div>
                ) : (order.paymentStatus === 'paid' && order.id ? (
                  <div className="rating-box">
                    <div className="rating-title">결제가 완료되었습니다. 평점을 남겨주세요.</div>
                    <div className="rating-stars">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          className={`star-btn ${(ratingDrafts[order.id]?.rating || 0) >= star ? 'on' : ''}`}
                          onClick={() => updateRatingDraft(order.id, { rating: star })}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <textarea
                      className="rating-input"
                      rows={2}
                      placeholder="한 줄 리뷰를 남겨보세요 (선택)"
                      value={ratingDrafts[order.id]?.review || ''}
                      onChange={(e) => updateRatingDraft(order.id, { review: e.target.value })}
                    />
                    <button className="rating-submit" onClick={() => submitRating(order)}>평점 등록</button>
                  </div>
                ) : null)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ───────── CSS ─────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

:root {
  --bg: #f4f8ff;
  --card: #ffffff;
  --primary: #2563eb;
  --primary-light: #e8f0ff;
  --secondary: #60a5fa;
  --text: #1a1a1a;
  --text2: #6b7280;
  --border: #dbeafe;
  --radius: 16px;
  --shadow: 0 2px 12px rgba(37,99,235,0.10);
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
.header-buttons { display: flex; gap: 8px; align-items: center; }
.header-location { font-size: 12px; color: var(--text2); }
.header-title { font-size: 22px; font-weight: 800; color: var(--text); }
.user-info { font-size: 12px; color: var(--primary); font-weight: 600; }
.qr-btn, .orders-btn, .logout-btn {
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
.custom-marker { background: none; border: none; }
.marker-icon:hover {
  transform: scale(1.15);
  filter: drop-shadow(0 6px 20px rgba(255, 87, 34, 0.3));
}
.map-bg {
  position: relative; height: 220px; border-radius: 20px;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #bfdbfe 100%);
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
.review-preview-box {
  border: 1px solid var(--border); border-radius: 12px;
  padding: 10px; margin-bottom: 14px; background: #fffdf9;
}
.review-preview-title { font-size: 12px; color: var(--text2); margin-bottom: 8px; font-weight: 700; }
.review-empty { font-size: 12px; color: var(--text2); }
.review-list-mini { display: flex; flex-direction: column; gap: 8px; }
.review-item-mini { background: white; border: 1px solid #f3f4f6; border-radius: 8px; padding: 8px; }
.review-stars { font-size: 12px; color: #f59e0b; margin-bottom: 2px; }
.review-text { font-size: 12px; color: var(--text); line-height: 1.4; }
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
.complete-note { font-size: 14px; color: var(--text2); margin: 8px 0; }
.complete-btn {
  margin-top: 32px; padding: 16px 32px; background: var(--primary); color: white;
  border: none; border-radius: 14px; font-family: 'Noto Sans KR', sans-serif;
  font-size: 16px; font-weight: 700; cursor: pointer;
}

/* 주문 내역 */
.orders-list { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.order-card {
  background: white; border-radius: 12px; padding: 16px;
  box-shadow: var(--shadow); border: 1px solid var(--border);
}
.order-header { font-weight: 700; margin-bottom: 12px; color: var(--primary); }
.order-details { font-size: 13px; color: var(--text2); line-height: 1.8; }
.order-details div { display: flex; gap: 4px; }
.order-details strong { color: var(--text); font-weight: 600; min-width: 60px; }
.no-orders { text-align: center; padding: 40px; color: var(--text2); }
.rating-box {
  margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border);
}
.rating-title { font-size: 12px; color: var(--text2); margin-bottom: 8px; }
.rating-stars { display: flex; gap: 6px; margin-bottom: 8px; }
.star-btn {
  border: none; background: #f3f4f6; color: #9ca3af;
  width: 30px; height: 30px; border-radius: 8px; cursor: pointer; font-size: 18px;
}
.star-btn.on { color: #f59e0b; background: #fff7ed; }
.rating-input {
  width: 100%; border: 1px solid var(--border); border-radius: 8px;
  padding: 8px; font-family: 'Noto Sans KR', sans-serif; font-size: 12px; resize: none;
}
.rating-submit {
  margin-top: 8px; width: 100%; border: none; border-radius: 8px;
  padding: 9px; background: var(--primary); color: white; font-size: 12px; font-weight: 700;
  cursor: pointer; font-family: 'Noto Sans KR', sans-serif;
}
.rating-done {
  margin-top: 10px; padding: 8px 10px; background: #fffbeb; border-radius: 8px;
  color: #92400e; font-size: 12px;
}
.rating-review { margin-top: 6px; color: #78350f; }
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

/* 로그인/회원가입 */
.auth-wrap {
  background: white; border-radius: 20px; padding: 32px 24px;
  width: 100%; max-width: 320px; text-align: center; box-shadow: var(--shadow);
}
.auth-title { font-size: 24px; font-weight: 800; margin-bottom: 24px; }
.auth-input {
  width: 100%; padding: 14px; border: 1px solid var(--border);
  border-radius: 12px; font-size: 16px; margin-bottom: 12px;
  font-family: 'Noto Sans KR', sans-serif;
}
.auth-error { color: #ef4444; font-size: 14px; margin-bottom: 12px; }
.auth-btn {
  width: 100%; padding: 16px; background: var(--primary); color: white;
  border: none; border-radius: 12px; font-size: 16px; font-weight: 700;
  cursor: pointer; margin-bottom: 12px;
}
.auth-link {
  background: none; border: none; color: var(--primary); font-size: 14px;
  cursor: pointer; text-decoration: underline;
}

/* 관리자 페이지 */
.admin-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px; background: white; border-bottom: 1px solid var(--border);
}
.admin-title { font-size: 20px; font-weight: 800; }
.admin-section {
  padding: 20px; background: white; margin: 12px 12px;
  border-radius: 16px; box-shadow: var(--shadow);
}
.admin-section-title { font-size: 15px; font-weight: 700; margin-bottom: 16px; }
.admin-input {
  width: 100%; padding: 12px; border: 1px solid var(--border);
  border-radius: 10px; font-size: 14px; margin-bottom: 10px;
  font-family: 'Noto Sans KR', sans-serif;
}
.admin-error { color: #ef4444; font-size: 13px; margin-bottom: 12px; padding: 8px; background: #fef2f2; border-radius: 8px; }
.admin-success { color: #059669; font-size: 13px; margin-bottom: 12px; padding: 8px; background: #f0fdf4; border-radius: 8px; }
.admin-btn {
  width: 100%; padding: 12px; background: var(--primary); color: white;
  border: none; border-radius: 10px; font-size: 14px; font-weight: 700;
  cursor: pointer; font-family: 'Noto Sans KR', sans-serif;
}
.users-list { display: flex; flex-direction: column; gap: 10px; }
.user-item-admin {
  background: #f9faf8; border-radius: 12px; padding: 14px;
  border: 1px solid var(--border);
}
.user-info-admin { flex: 1; }
.user-name {
  font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
}
.admin-badge {
  background: var(--primary); color: white; font-size: 10px;
  padding: 2px 6px; border-radius: 6px; font-weight: 700;
}
.owner-badge {
  background: #8b5cf6; color: white; font-size: 10px;
  padding: 2px 6px; border-radius: 6px; font-weight: 700;
}
.user-password { 
  font-size: 12px; color: var(--text2); margin: 4px 0;
}
.user-password code {
  background: white; padding: 2px 6px; border-radius: 4px;
  font-family: monospace; color: var(--text); font-size: 11px;
}
.user-id { font-size: 12px; color: var(--text2); margin: 4px 0; }
.user-rest { font-size: 12px; color: var(--text2); margin: 4px 0; }
.user-edit-form {
  display: flex; flex-direction: column; gap: 10px;
}
.user-edit-buttons {
  display: flex; gap: 8px;
}
.btn-save {
  flex: 1; padding: 8px; background: #10b981; color: white;
  border: none; border-radius: 8px; font-size: 12px; font-weight: 700;
  cursor: pointer; font-family: 'Noto Sans KR', sans-serif;
}
.btn-cancel {
  flex: 1; padding: 8px; background: #9ca3af; color: white;
  border: none; border-radius: 8px; font-size: 12px; font-weight: 700;
  cursor: pointer; font-family: 'Noto Sans KR', sans-serif;
}
.user-actions {
  display: flex; gap: 8px; margin-top: 10px;
}
.restaurant-coords-row { display: flex; gap: 8px; }
.restaurants-admin-list { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.restaurant-admin-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px; border: 1px solid var(--border); border-radius: 10px; background: #fafafa;
}
.restaurant-admin-name { font-size: 14px; font-weight: 700; }
.restaurant-admin-meta { font-size: 12px; color: var(--text2); margin-top: 2px; }
.edit-btn {
  flex: 1; padding: 8px; background: #3b82f6; color: white;
  border: none; border-radius: 8px; font-size: 12px; font-weight: 700;
  cursor: pointer; font-family: 'Noto Sans KR', sans-serif;
}
.delete-btn {
  flex: 1; background: #ef4444; color: white; border: none;
  border-radius: 8px; padding: 8px; font-size: 12px; font-weight: 700;
  cursor: pointer; font-family: 'Noto Sans KR', sans-serif;
}

/* POS 페이지 */
.pos-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px; background: white; border-bottom: 1px solid var(--border);
}
.pos-title { font-size: 20px; font-weight: 800; }
.pos-tabs {
  display: flex; gap: 0; background: white;
  border-bottom: 2px solid var(--border); overflow-x: auto;
}
.pos-tab {
  flex: 1; padding: 14px; border: none; background: none;
  font-family: 'Noto Sans KR', sans-serif; font-size: 13px; font-weight: 700;
  color: var(--text2); cursor: pointer; white-space: nowrap;
  border-bottom: 2px solid transparent; transition: all .15s;
  text-align: center;
}
.pos-tab.active { color: var(--primary); border-bottom-color: var(--primary); }
.pos-section { padding: 16px; }
.pos-section-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
.pos-empty { text-align: center; padding: 40px 20px; color: var(--text2); }
.pos-list { display: flex; flex-direction: column; gap: 12px; }
.pos-card {
  background: white; border-radius: 12px; padding: 14px;
  border: 1px solid var(--border); box-shadow: var(--shadow);
}
.pos-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.pos-card-title { font-weight: 700; }
.pos-card-time { font-size: 12px; color: var(--text2); }
.pos-order-status { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; }
.pos-card-details { font-size: 13px; color: var(--text2); line-height: 1.6; margin-bottom: 10px; }
.pos-card-details div { display: flex; gap: 8px; }
.pos-card-details strong { color: var(--text); min-width: 50px; }
.pos-card-actions { display: flex; gap: 8px; }
.pos-btn-check {
  flex: 1; padding: 8px; background: var(--primary); color: white;
  border: none; border-radius: 8px; font-size: 12px; font-weight: 700;
  cursor: pointer; font-family: 'Noto Sans KR', sans-serif;
}
.pos-btn-cancel {
  flex: 1; padding: 8px; background: #ef4444; color: white;
  border: none; border-radius: 8px; font-size: 12px; font-weight: 700;
  cursor: pointer; font-family: 'Noto Sans KR', sans-serif;
}
.pos-btn-complete {
  flex: 1; padding: 8px; background: var(--primary); color: white;
  border: none; border-radius: 8px; font-size: 12px; font-weight: 700;
  cursor: pointer; font-family: 'Noto Sans KR', sans-serif;
}
.pos-stat-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
}
.pos-stat {
  background: white; border-radius: 12px; padding: 20px;
  border: 1px solid var(--border); text-align: center;
}
.pos-stat-label { font-size: 12px; color: var(--text2); margin-bottom: 8px; }
.pos-stat-value { font-size: 24px; font-weight: 800; color: var(--primary); }

/* POS 좌석 관리 */
.pos-floor-wrap { padding: 16px; }
.pos-floor-label { font-size: 12px; color: var(--text2); text-align: center; margin-bottom: 8px; }
.pos-floor-map {
  position: relative; height: 340px; background: linear-gradient(180deg, #eff6ff 0%, #f8fbff 100%);
  border-radius: 20px; border: 2px dashed var(--border); overflow: hidden;
}
.pos-kitchen-area {
  position: absolute; right: 0; top: 0; background: #dbeafe;
  padding: 8px 12px; border-radius: 0 18px 0 12px; font-size: 12px; color: var(--text2);
}
.pos-seat {
  position: absolute; border-radius: 12px; border: 2px solid;
  padding: 8px; text-align: center; cursor: grab;
  transition: transform .15s, box-shadow .15s;
  min-width: 66px;
  user-select: none;
  touch-action: none;
}
.pos-seat.available { border-color: #60a5fa; background: #eff6ff; }
.pos-seat.available:active { transform: scale(0.95); box-shadow: var(--shadow); }
.pos-seat.full { border-color: #93c5fd; background: #f8fbff; opacity: 0.72; }
.pos-seat.dragging { z-index: 20; box-shadow: 0 12px 24px rgba(37,99,235,0.18); }
.pos-seat-id { font-size: 13px; font-weight: 800; }
.pos-seat-type { font-size: 10px; color: var(--text2); }
.pos-seat-count { font-size: 11px; font-weight: 700; margin-top: 2px; }
.pos-seat-handle {
  display: inline-flex; align-items: center; justify-content: center;
  margin-bottom: 6px; padding: 2px 6px; border-radius: 999px;
  background: var(--primary-light); color: var(--primary);
  font-size: 10px; font-weight: 800; cursor: grab;
}
.pos-legend {
  display: flex; gap: 16px; padding: 12px 20px;
  background: white; border-top: 1px solid var(--border);
  justify-content: center; flex-direction: column; align-items: center;
}
.pos-leg-item { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text2); }
.pos-leg-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.pos-leg-dot.available { background: #22c55e; }
.pos-leg-dot.full { background: #9ca3af; }
.pos-legend-note { font-size: 11px; color: var(--text2); margin-top: 8px; text-align: center; }

/* POS 메뉴 관리 */
.menu-admin-wrap { display: flex; flex-direction: column; gap: 12px; }
.menu-admin-category {
  background: white; border: 1px solid var(--border); border-radius: 12px; padding: 10px;
}
.menu-admin-category-title { font-size: 14px; font-weight: 800; margin-bottom: 8px; color: var(--primary); }
.menu-admin-item {
  display: grid; grid-template-columns: 1.3fr 0.8fr 1.5fr auto;
  gap: 8px; align-items: center; margin-bottom: 8px;
}
.menu-admin-input {
  width: 100%; border: 1px solid var(--border); border-radius: 8px;
  padding: 8px; font-family: 'Noto Sans KR', sans-serif; font-size: 12px;
}
.menu-admin-save {
  border: none; border-radius: 8px; padding: 8px 10px;
  background: var(--primary); color: white; font-size: 12px; font-weight: 700;
  cursor: pointer; font-family: 'Noto Sans KR', sans-serif;
}
.menu-admin-save:disabled { opacity: 0.7; cursor: wait; }

/* 결제 페이지 */
.payment-page { padding-bottom: 24px; }
.payment-wrap { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.payment-card {
  background: white; border: 1px solid var(--border); border-radius: 14px;
  padding: 14px; box-shadow: var(--shadow);
}
.payment-title { font-size: 15px; font-weight: 800; margin-bottom: 10px; }
.payment-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 7px 0; font-size: 14px; border-bottom: 1px solid #f3f4f6;
}
.payment-row:last-child { border-bottom: 0; }
.payment-method {
  width: 100%; padding: 12px; margin-bottom: 8px;
  border: 1px solid var(--border); border-radius: 10px;
  background: #fff; color: var(--text); font-weight: 700; cursor: pointer;
  font-family: 'Noto Sans KR', sans-serif;
}
.payment-method.active { border-color: var(--primary); background: var(--primary-light); color: var(--primary); }
.payment-submit {
  width: 100%; padding: 15px; border: none; border-radius: 12px;
  background: var(--primary); color: white; font-size: 16px; font-weight: 800;
  cursor: pointer; font-family: 'Noto Sans KR', sans-serif;
}
.payment-submit:disabled { opacity: 0.7; cursor: wait; }
.payment-hint { font-size: 12px; color: var(--text2); line-height: 1.5; }

/* POS QR 관리 */
.pos-qr-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px;
}
.pos-btn-print {
  padding: 8px 12px; border: none; border-radius: 8px;
  background: #111827; color: white; font-size: 12px; font-weight: 700;
  cursor: pointer; font-family: 'Noto Sans KR', sans-serif;
}
.pos-qr-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
}
.pos-qr-card {
  background: white; border: 1px solid var(--border); border-radius: 12px;
  padding: 10px; text-align: center; box-shadow: var(--shadow);
}
.pos-qr-title { font-size: 13px; font-weight: 700; margin-bottom: 8px; }
.pos-qr-image {
  width: 100%; max-width: 130px; height: auto;
  border-radius: 8px; border: 1px solid #f1f5f9;
}
.pos-qr-value {
  margin-top: 8px; font-size: 11px; color: var(--text2); font-family: monospace;
}
`;

