const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// 정적 파일 서빙 (React 빌드 결과)
app.use(express.static(path.join(__dirname, '../build')));

const dataPath = path.join(__dirname, '../data.json');
const ordersPath = path.join(__dirname, '../orders.json');
const usersPath = path.join(__dirname, '../users.json');
const seatsPath = path.join(__dirname, '../seats.json');
const paymentsPath = path.join(__dirname, '../payments.json');
console.log('Paths:', { dataPath, ordersPath, usersPath, seatsPath, paymentsPath });

app.get('/restaurants', (req, res) => {
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  res.json(data.restaurants);
});

app.post('/restaurants', (req, res) => {
  const { name, category, image, tags, lat, lng } = req.body;
  try {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const restaurants = data.restaurants || [];

    if (!name || !category) {
      return res.status(400).json({ error: 'name and category are required' });
    }

    const nextId = restaurants.length > 0 ? Math.max(...restaurants.map(r => Number(r.id) || 0)) + 1 : 1;
    const newRestaurant = {
      id: nextId,
      name,
      category,
      rating: 4.5,
      reviewCount: 0,
      distance: '0m',
      wait: '즉시',
      image: image || '🍽',
      tags: Array.isArray(tags) ? tags : [],
      lat: Number(lat) || 37.6199,
      lng: Number(lng) || 127.0593,
      menu: {
        추천: [],
        메인: [],
        사이드: [],
        음료: []
      }
    };

    restaurants.push(newRestaurant);
    data.restaurants = restaurants;
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    res.json({ success: true, restaurant: newRestaurant });
  } catch (error) {
    console.error('Error creating restaurant:', error);
    res.status(500).json({ error: 'Failed to create restaurant' });
  }
});

app.delete('/restaurants/:id', (req, res) => {
  const restaurantId = parseInt(req.params.id);
  try {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const restaurants = data.restaurants || [];
    const exists = restaurants.some(r => Number(r.id) === Number(restaurantId));
    if (!exists) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    data.restaurants = restaurants.filter(r => Number(r.id) !== Number(restaurantId));
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting restaurant:', error);
    res.status(500).json({ error: 'Failed to delete restaurant' });
  }
});

app.put('/restaurants/:id/menu/:itemId', (req, res) => {
  const restaurantId = parseInt(req.params.id);
  const itemId = parseInt(req.params.itemId);
  const { name, price, desc } = req.body;

  try {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const restaurant = (data.restaurants || []).find(r => Number(r.id) === Number(restaurantId));
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    let updatedItem = null;
    Object.keys(restaurant.menu || {}).forEach(category => {
      (restaurant.menu[category] || []).forEach(item => {
        if (Number(item.id) === Number(itemId)) {
          if (name !== undefined) item.name = String(name);
          if (price !== undefined) item.price = Number(price);
          if (desc !== undefined) item.desc = String(desc);
          updatedItem = item;
        }
      });
    });

    if (!updatedItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    res.json({ success: true, item: updatedItem });
  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(500).json({ error: 'Failed to update menu item' });
  }
});

app.post('/restaurants/:id/menu', (req, res) => {
  const restaurantId = parseInt(req.params.id);
  const { category, name, price, desc, img } = req.body;

  try {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const restaurant = (data.restaurants || []).find(r => Number(r.id) === Number(restaurantId));
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    if (!category || !name) {
      return res.status(400).json({ error: 'category and name are required' });
    }

    if (!restaurant.menu[category]) {
      restaurant.menu[category] = [];
    }

    const allItems = Object.values(restaurant.menu).flat();
    const nextId = allItems.length > 0 ? Math.max(...allItems.map(item => Number(item.id) || 0)) + 1 : 1;

    const newItem = {
      id: nextId,
      name: String(name),
      price: Number(price) || 0,
      desc: String(desc || ''),
      img: String(img || '🍽')
    };

    restaurant.menu[category].push(newItem);
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    res.json({ success: true, item: newItem });
  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(500).json({ error: 'Failed to create menu item' });
  }
});

app.delete('/restaurants/:id/menu/:itemId', (req, res) => {
  const restaurantId = parseInt(req.params.id);
  const itemId = parseInt(req.params.itemId);

  try {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const restaurant = (data.restaurants || []).find(r => Number(r.id) === Number(restaurantId));
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    let removed = false;
    Object.keys(restaurant.menu || {}).forEach(category => {
      const before = (restaurant.menu[category] || []).length;
      restaurant.menu[category] = (restaurant.menu[category] || []).filter(item => Number(item.id) !== Number(itemId));
      if (restaurant.menu[category].length !== before) {
        removed = true;
      }
    });

    if (!removed) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

app.get('/seats', (req, res) => {
  try {
    if (fs.existsSync(seatsPath)) {
      const seats = JSON.parse(fs.readFileSync(seatsPath, 'utf8'));
      const restaurantId = req.query.restaurantId;
      if (restaurantId) {
        const filteredSeats = seats.filter(s => s.restaurantId === parseInt(restaurantId));
        res.json(filteredSeats);
      } else {
        res.json(seats);
      }
    } else {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      res.json(data.seats);
    }
  } catch (error) {
    console.error('Error fetching seats:', error);
    res.status(500).json({ error: 'Failed to fetch seats' });
  }
});

app.post('/seats/:id', (req, res) => {
  const seatId = req.params.id;
  const { reservations, restaurantId, x, y } = req.body;
  try {
    let seats = [];
    if (fs.existsSync(seatsPath)) {
      seats = JSON.parse(fs.readFileSync(seatsPath, 'utf8'));
    }
    const seat = seats.find(s => {
      if (s.id !== seatId) return false;
      if (restaurantId !== undefined && restaurantId !== null) {
        return s.restaurantId === parseInt(restaurantId);
      }
      return true;
    });
    if (seat) {
      if (reservations !== undefined) {
        seat.reservations = reservations;
      }
      if (x !== undefined) {
        seat.x = Number(x);
      }
      if (y !== undefined) {
        seat.y = Number(y);
      }
      fs.writeFileSync(seatsPath, JSON.stringify(seats, null, 2));
      console.log(`Seat ${seatId} updated:`, seat);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Seat not found' });
    }
  } catch (error) {
    console.error('Error updating seat:', error);
    res.status(500).json({ error: 'Failed to update seat' });
  }
});

app.post('/orders', (req, res) => {
  const order = req.body;
  let orders = [];
  try {
    if (fs.existsSync(ordersPath)) {
      orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
    }
    if (!order.id) {
      order.id = Date.now() + Math.floor(Math.random() * 1000);
    }
    orders.push(order);
    fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving order:', error);
    res.status(500).json({ error: 'Failed to save order' });
  }
});

app.get('/orders', (req, res) => {
  if (fs.existsSync(ordersPath)) {
    const orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
    res.json(orders);
  } else {
    res.json([]);
  }
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  console.log('Register request:', username);
  let users = [];
  try {
    if (fs.existsSync(usersPath)) {
      users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
      console.log('Existing users:', users.length);
    }
    if (users.find(u => u.username === username)) {
      console.log('User already exists');
      return res.status(400).json({ error: 'User already exists' });
    }
    const user = { id: Date.now(), username, password };
    users.push(user);
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    console.log('User registered:', user.id);
    res.json({ user });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register' });
  }
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  console.log('Login request:', username);
  let users = [];
  try {
    if (fs.existsSync(usersPath)) {
      users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    }
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      console.log('Login successful:', user.id, '(type:', user.type, ')');
      // type이 없으면 customer로 기본값 설정
      const userData = { ...user, type: user.type || 'customer' };

      // 식당주 계정은 식당 연결 상태를 명확히 검증해 구체적인 메시지를 반환한다.
      if (userData.type === 'restaurant_owner') {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const restaurants = data.restaurants || [];

        if (userData.restaurantId === undefined || userData.restaurantId === null || userData.restaurantId === '') {
          return res.status(409).json({ error: '매장은 등록되어 있지만 관리자 계정이 연결되어 있지 않습니다.' });
        }

        const hasRestaurant = restaurants.some(r => Number(r.id) === Number(userData.restaurantId));
        if (!hasRestaurant) {
          return res.status(404).json({ error: '해당 매장을 찾을 수 없습니다.' });
        }
      }

      res.json({ user: userData });
    } else {
      console.log('Invalid credentials');
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

app.get('/users', (req, res) => {
  try {
    let users = [];
    if (fs.existsSync(usersPath)) {
      users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    }
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.delete('/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  if (userId === 1) {
    return res.status(403).json({ error: 'Cannot delete admin account' });
  }
  try {
    let users = [];
    if (fs.existsSync(usersPath)) {
      users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    }
    users = users.filter(u => u.id !== userId);
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    console.log('User deleted:', userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.post('/users', (req, res) => {
  const { username, password } = req.body;
  try {
    let users = [];
    if (fs.existsSync(usersPath)) {
      users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    }
    if (users.find(u => u.username === username)) {
      return res.status(400).json({ error: 'User already exists' });
    }
    const user = { id: Date.now(), username, password };
    users.push(user);
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    console.log('User added:', user.id);
    res.json({ user });
  } catch (error) {
    console.error('Error adding user:', error);
    res.status(500).json({ error: 'Failed to add user' });
  }
});

app.put('/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const { username, password } = req.body;
  try {
    let users = [];
    if (fs.existsSync(usersPath)) {
      users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    }
    const user = users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (username && username !== user.username) {
      if (users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      user.username = username;
    }
    if (password) {
      user.password = password;
    }
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    console.log('User updated:', userId);
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.get('/reservations/:restaurantId', (req, res) => {
  const restaurantId = parseInt(req.params.restaurantId);
  try {
    let orders = [];
    if (fs.existsSync(ordersPath)) {
      orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
    }
    const reservations = orders.filter(o => o.restaurantId === restaurantId && o.type === 'reservation');
    res.json(reservations);
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({ error: 'Failed to fetch reservations' });
  }
});

app.get('/orders/restaurant/:restaurantId', (req, res) => {
  const restaurantId = parseInt(req.params.restaurantId);
  try {
    let orders = [];
    if (fs.existsSync(ordersPath)) {
      orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
    }
    const restaurantOrders = orders.filter(o => o.restaurantId === restaurantId);
    res.json(restaurantOrders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.put('/orders/by-index/:orderId', (req, res) => {
  const orderId = parseInt(req.params.orderId);
  const { status } = req.body;
  try {
    let orders = [];
    if (fs.existsSync(ordersPath)) {
      orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
    }
    const order = orders.find((o, idx) => idx === orderId);
    if (order) {
      order.status = status;
      fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
      console.log(`Order ${orderId} status updated to:`, status);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Order not found' });
    }
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

app.put('/orders/update-status', (req, res) => {
  const { id, status, restaurantId, timestamp, seatId, userId, type } = req.body;

  try {
    let orders = [];
    if (fs.existsSync(ordersPath)) {
      orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
    }

    const order = orders.find(o => {
      if (id !== undefined && id !== null) {
        return String(o.id) === String(id);
      }

      if (restaurantId !== undefined && restaurantId !== null && Number(o.restaurantId) !== Number(restaurantId)) return false;
      if (timestamp !== undefined && timestamp !== null && String(o.timestamp) !== String(timestamp)) return false;
      if (seatId !== undefined && seatId !== null && String(o.seatId) !== String(seatId)) return false;
      if (userId !== undefined && userId !== null && String(o.userId) !== String(userId)) return false;
      if (type !== undefined && type !== null && String(o.type) !== String(type)) return false;
      return true;
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    order.status = status;
    fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

app.post('/payments', (req, res) => {
  const payment = req.body;
  try {
    let payments = [];
    let orders = [];
    if (fs.existsSync(paymentsPath)) {
      payments = JSON.parse(fs.readFileSync(paymentsPath, 'utf8'));
    }
    if (fs.existsSync(ordersPath)) {
      orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
    }

    // orderId 전달 시 우선 매칭, 없으면 최근 주문으로 추정 연결
    let relatedOrder = null;
    if (payment.orderId !== undefined && payment.orderId !== null) {
      relatedOrder = orders.find(o => String(o.id) === String(payment.orderId)) || null;
    }
    if (!relatedOrder) {
      relatedOrder = [...orders]
        .reverse()
        .find(o =>
          Number(o.restaurantId) === Number(payment.restaurantId) &&
          String(o.seatId || '') === String(payment.seatId || '') &&
          (payment.customerId ? String(o.userId || '') === String(payment.customerId) : true) &&
          String(o.status || 'pending') !== 'cancelled'
        ) || null;
    }

    const saved = {
      id: payment.id || Date.now() + Math.floor(Math.random() * 1000),
      restaurantId: payment.restaurantId,
      seatId: payment.seatId,
      amount: payment.amount || 0,
      method: payment.method || 'onsite_card',
      status: payment.status || 'requested',
      customerId: payment.customerId,
      timestamp: payment.timestamp || new Date().toISOString(),
      orderId: relatedOrder?.id || null
    };

    payments.push(saved);
    fs.writeFileSync(paymentsPath, JSON.stringify(payments, null, 2));

    if (relatedOrder) {
      // 결제 생성 시 즉시 paid로 표시하여 평가 가능하게 함
      relatedOrder.paymentStatus = 'paid';
      relatedOrder.paymentId = saved.id;
      fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
    }

    res.json({ success: true, payment: saved });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

app.get('/payments/:restaurantId', (req, res) => {
  const restaurantId = parseInt(req.params.restaurantId);
  try {
    let payments = [];
    if (fs.existsSync(paymentsPath)) {
      payments = JSON.parse(fs.readFileSync(paymentsPath, 'utf8'));
    }

    const restaurantPayments = payments
      .filter(p => Number(p.restaurantId) === Number(restaurantId))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json(restaurantPayments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

app.put('/payments/:paymentId', (req, res) => {
  const paymentId = req.params.paymentId;
  const { status } = req.body;
  try {
    let payments = [];
    let orders = [];
    if (fs.existsSync(paymentsPath)) {
      payments = JSON.parse(fs.readFileSync(paymentsPath, 'utf8'));
    }
    if (fs.existsSync(ordersPath)) {
      orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
    }

    const payment = payments.find(p => String(p.id) === String(paymentId));
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    payment.status = status || 'approved';
    payment.updatedAt = new Date().toISOString();
    fs.writeFileSync(paymentsPath, JSON.stringify(payments, null, 2));

    if (payment.orderId) {
      const order = orders.find(o => String(o.id) === String(payment.orderId));
      if (order) {
        order.paymentStatus = payment.status === 'approved' ? 'paid' : payment.status;
        order.paymentId = payment.id;
        fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
      }
    }

    res.json({ success: true, payment });
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

app.put('/orders/rate', (req, res) => {
  const { orderId, userId, rating, review } = req.body;
  try {
    let orders = [];
    if (fs.existsSync(ordersPath)) {
      orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
    }

    const order = orders.find(o => String(o.id) === String(orderId) && String(o.userId) === String(userId));
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (String(order.paymentStatus || '') !== 'paid') {
      return res.status(400).json({ error: '결제 완료 후 평점을 남길 수 있습니다.' });
    }

    order.rating = Math.max(1, Math.min(5, Number(rating) || 0));
    order.review = String(review || '').trim();
    order.ratedAt = new Date().toISOString();
    fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));

    // 매장 평점 집계도 같이 갱신해서 메인 유저 페이지에 즉시 반영
    try {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      const restaurant = (data.restaurants || []).find(r => Number(r.id) === Number(order.restaurantId));
      if (restaurant) {
        const rated = orders.filter(
          o => Number(o.restaurantId) === Number(order.restaurantId) && Number(o.rating) >= 1 && Number(o.rating) <= 5
        );
        if (rated.length > 0) {
          const sum = rated.reduce((acc, cur) => acc + Number(cur.rating), 0);
          restaurant.rating = Number((sum / rated.length).toFixed(1));
          restaurant.reviewCount = rated.length;
          fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
        }
      }
    } catch (aggErr) {
      console.error('Error updating restaurant rating aggregate:', aggErr);
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error('Error rating order:', error);
    res.status(500).json({ error: 'Failed to rate order' });
  }
});

// React SPA 폴백 (모든 비-API 경로는 index.html로)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../build/index.html'));
});

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access from this computer: http://localhost:${PORT}`);
  console.log(`Access from phone/other devices: http://172.100.4.47:${PORT}`);
});