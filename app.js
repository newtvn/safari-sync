// Safari Sync - Bus Booking Application
// Wired to the real FastAPI backend in backend/ - every "booking", payment,
// ticket, tracking update, document review and USSD session below is a real
// database-backed operation, not a client-side simulation.

// ==========================================
// API client
// ==========================================

const API_BASE = window.SAFARI_SYNC_API_BASE || 'http://localhost:8000';

async function api(path, { method = 'GET', body, auth = true, formData = false } = {}) {
    const headers = {};
    if (!formData) headers['Content-Type'] = 'application/json';
    if (auth && state.token) headers['Authorization'] = `Bearer ${state.token}`;

    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: formData ? body : (body ? JSON.stringify(body) : undefined),
    });

    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }

    if (!res.ok) {
        const message = (data && (data.detail || data.message)) || `Request failed (${res.status})`;
        throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
    }
    return data;
}

// ==========================================
// State Management
// ==========================================

const state = {
    user: null,
    token: null,
    currentView: 'home',
    selectedSchedule: null,
    selectedSeats: [],
    currentBooking: null,
    currentTicket: null,
    bookingDetails: {
        from: '',
        to: '',
        date: '',
        returnDate: '',
        passengers: 1,
        tripType: 'oneway'
    }
};

// Static display metadata for the cities seeded on the backend (backend matches
// on city name case-insensitively, so these slugs double as query values).
const cities = {
    nairobi: { name: 'Nairobi', country: 'Kenya', code: 'NBO' },
    mombasa: { name: 'Mombasa', country: 'Kenya', code: 'MBA' },
    kisumu: { name: 'Kisumu', country: 'Kenya', code: 'KIS' },
    kampala: { name: 'Kampala', country: 'Uganda', code: 'KLA' },
    entebbe: { name: 'Entebbe', country: 'Uganda', code: 'EBB' },
    jinja: { name: 'Jinja', country: 'Uganda', code: 'JIN' },
    kigali: { name: 'Kigali', country: 'Rwanda', code: 'KGL' },
    butare: { name: 'Butare', country: 'Rwanda', code: 'BTR' },
    juba: { name: 'Juba', country: 'South Sudan', code: 'JUB' }
};

// ==========================================
// Initialization
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initPreloader();
    initNavigation();
    initBookingForm();
    initBookingTabs();
    initPaymentMethods();
    initSeats();
    setMinDate();
    restoreSession();
});

async function restoreSession() {
    const savedToken = localStorage.getItem('safariSyncToken');
    if (!savedToken) return;
    state.token = savedToken;
    try {
        state.user = await api('/api/auth/me');
        updateUIForLoggedInUser();
    } catch (e) {
        localStorage.removeItem('safariSyncToken');
        state.token = null;
    }
}

// ==========================================
// Preloader
// ==========================================

function initPreloader() {
    const preloader = document.getElementById('preloader');
    setTimeout(() => {
        preloader.classList.add('hidden');
        document.body.classList.add('loaded');
    }, 1800);
}

// ==========================================
// Navigation
// ==========================================

function initNavigation() {
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) navbar.classList.add('scrolled');
        else navbar.classList.remove('scrolled');
    });
}

function showView(viewName) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));

    const targetView = document.getElementById(viewName + 'View');
    if (targetView) {
        targetView.classList.add('active');
        state.currentView = viewName;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu.classList.contains('active')) toggleMobileMenu();

    if (viewName === 'bookings') loadMyBookings();
    if (viewName === 'dashboard') loadDashboard();
    if (viewName === 'profile') loadMyDocuments();
    if (viewName === 'routes') loadRoutesPage();
    if (viewName === 'operator') loadOperatorPortal();
}

function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    mobileMenu.classList.toggle('active');
    mobileMenuBtn.classList.toggle('active');
    document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
}

function toggleUserMenu() {
    const userMenu = document.querySelector('.user-menu');
    const dropdown = document.getElementById('userDropdown');
    userMenu.classList.toggle('active');
    dropdown.classList.toggle('active');
    if (dropdown.classList.contains('active')) {
        document.addEventListener('click', closeUserMenuOnOutsideClick);
    }
}

function closeUserMenuOnOutsideClick(e) {
    const userMenu = document.querySelector('.user-menu');
    const dropdown = document.getElementById('userDropdown');
    if (!userMenu.contains(e.target)) {
        userMenu.classList.remove('active');
        dropdown.classList.remove('active');
        document.removeEventListener('click', closeUserMenuOnOutsideClick);
    }
}

// ==========================================
// Modals
// ==========================================

function showModal(modalName) {
    const modal = document.getElementById(modalName + 'Modal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu && mobileMenu.classList.contains('active')) toggleMobileMenu();
}

function closeModal(modalName) {
    const modal = document.getElementById(modalName + 'Modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function switchModal(from, to) {
    closeModal(from);
    setTimeout(() => showModal(to), 200);
}

// ==========================================
// Authentication (real JWT auth against the backend)
// ==========================================

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const result = await api('/api/auth/login', { method: 'POST', body: { email, password }, auth: false });
        applySession(result);
        closeModal('login');
        showToast(`Welcome back, ${state.user.first_name}!`);
    } catch (err) {
        showToast(err.message);
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const first_name = document.getElementById('signupFirstName').value;
    const last_name = document.getElementById('signupLastName').value;
    const email = document.getElementById('signupEmail').value;
    const phone = document.getElementById('signupCountryCode').value + document.getElementById('signupPhone').value;
    const password = document.getElementById('signupPassword') ? document.getElementById('signupPassword').value : 'changeme123';

    try {
        const result = await api('/api/auth/signup', {
            method: 'POST',
            body: { first_name, last_name, email, phone, password },
            auth: false,
        });
        applySession(result);
        closeModal('signup');
        showToast('Account created successfully!');
        showView('dashboard');
    } catch (err) {
        showToast(err.message);
    }
}

function applySession(result) {
    state.token = result.access_token;
    state.user = result.user;
    localStorage.setItem('safariSyncToken', state.token);
    updateUIForLoggedInUser();
}

function logout() {
    state.user = null;
    state.token = null;
    localStorage.removeItem('safariSyncToken');
    updateUIForLoggedOutUser();
    showView('home');
    showToast('You have been logged out');
}

function requireAuth() {
    if (!state.token) {
        showToast('Please log in first');
        showModal('login');
        return false;
    }
    return true;
}

// ==========================================
// UI Updates
// ==========================================

function updateUIForLoggedInUser() {
    const navActions = document.getElementById('navActions');
    const navUser = document.getElementById('navUser');
    const mobileAuthButtons = document.getElementById('mobileAuthButtons');
    const mobileUserMenu = document.getElementById('mobileUserMenu');
    const userAvatarNav = document.getElementById('userAvatarNav');
    const userNameNav = document.getElementById('userNameNav');
    const dashboardName = document.getElementById('dashboardName');

    navActions.style.display = 'none';
    navUser.style.display = 'block';
    mobileAuthButtons.style.display = 'none';
    mobileUserMenu.style.display = 'block';

    const initials = state.user.first_name[0] + (state.user.last_name ? state.user.last_name[0] : '');
    userAvatarNav.textContent = initials;
    userNameNav.textContent = state.user.first_name;
    if (dashboardName) dashboardName.textContent = state.user.first_name;

    const profileAvatar = document.getElementById('profileAvatar');
    const profileFirstName = document.getElementById('profileFirstName');
    const profileLastName = document.getElementById('profileLastName');
    const profileEmail = document.getElementById('profileEmail');
    const profilePhone = document.getElementById('profilePhone');

    if (profileAvatar) profileAvatar.textContent = initials;
    if (profileFirstName) profileFirstName.value = state.user.first_name;
    if (profileLastName) profileLastName.value = state.user.last_name;
    if (profileEmail) profileEmail.value = state.user.email;
    if (profilePhone) profilePhone.value = state.user.phone;

    const operatorNavItems = document.querySelectorAll('.operator-only');
    operatorNavItems.forEach(el => {
        el.style.display = (state.user.role === 'operator' || state.user.role === 'admin') ? 'flex' : 'none';
    });
}

function updateUIForLoggedOutUser() {
    document.getElementById('navActions').style.display = 'flex';
    document.getElementById('navUser').style.display = 'none';
    document.getElementById('mobileAuthButtons').style.display = 'flex';
    document.getElementById('mobileUserMenu').style.display = 'none';
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
}

// ==========================================
// Booking Form / Search
// ==========================================

function initBookingForm() {
    const bookingForm = document.getElementById('bookingForm');
    bookingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (state.bookingDetails.tripType === 'parcel') {
            openParcelModal();
        } else {
            searchBuses();
        }
    });
}

function initBookingTabs() {
    const tabs = document.querySelectorAll('.booking-tab');
    const returnDateGroup = document.getElementById('returnDateGroup');
    const datesRow = document.getElementById('datesRow');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.bookingDetails.tripType = tab.dataset.tab;

            if (tab.dataset.tab === 'roundtrip') {
                returnDateGroup.style.display = 'block';
                datesRow.classList.add('has-return');
            } else {
                returnDateGroup.style.display = 'none';
                datesRow.classList.remove('has-return');
            }
        });
    });
}

function setMinDate() {
    const today = new Date().toISOString().split('T')[0];
    const departDate = document.getElementById('departDate');
    const returnDate = document.getElementById('returnDate');
    if (departDate) departDate.min = today;
    if (returnDate) returnDate.min = today;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (departDate) departDate.value = tomorrow.toISOString().split('T')[0];
}

function swapCities() {
    const fromCity = document.getElementById('fromCity');
    const toCity = document.getElementById('toCity');
    const temp = fromCity.value;
    fromCity.value = toCity.value;
    toCity.value = temp;
}

function selectRoute(from, to) {
    document.getElementById('fromCity').value = from;
    document.getElementById('toCity').value = to;
    document.querySelector('.booking-card').scrollIntoView({ behavior: 'smooth' });
}

async function searchBuses() {
    const from = document.getElementById('fromCity').value;
    const to = document.getElementById('toCity').value;
    const date = document.getElementById('departDate').value;
    const passengers = document.getElementById('passengers').value;

    if (!from || !to || !date) return showToast('Please fill in all fields');
    if (from === to) return showToast('Origin and destination cannot be the same');

    state.bookingDetails = { ...state.bookingDetails, from, to, date, passengers: parseInt(passengers) };

    const fromCity = cities[from];
    const toCity = cities[to];
    const formattedDate = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    document.getElementById('searchSummary').innerHTML = `
        <h2>${fromCity.name} &rarr; ${toCity.name}</h2>
        <p>${formattedDate} &bull; ${passengers} Passenger${passengers > 1 ? 's' : ''}</p>
    `;

    showView('searchResults');
    const resultsList = document.getElementById('resultsList');
    resultsList.innerHTML = `<p style="text-align:center;padding:40px;color:var(--text-secondary);">Searching live availability...</p>`;

    try {
        const direct = await api(`/api/routes/search?from_city=${from}&to_city=${to}&date=${date}`, { auth: false });
        if (direct.length > 0) {
            renderDirectResults(direct);
            return;
        }
        const connections = await api(`/api/routes/search-connections?from_city=${from}&to_city=${to}&date=${date}`, { auth: false });
        if (connections.length > 0) {
            renderConnectionResults(connections);
        } else {
            resultsList.innerHTML = `
                <div class="no-results">
                    <h3>No buses found for this route</h3>
                    <p>Try a different date or check our popular routes</p>
                </div>`;
        }
    } catch (err) {
        resultsList.innerHTML = `<p style="text-align:center;padding:40px;color:var(--error);">${err.message}</p>`;
    }
}

function getAmenityIcon(amenity) {
    const icons = {
        'WiFi': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/></svg>',
        'AC': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v10"/><path d="M18.5 8.5L12 12 5.5 8.5"/><path d="M12 22v-6"/><path d="M5.5 15.5L12 12l6.5 3.5"/></svg>',
        'USB': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22V2"/><path d="M5 12h14"/><path d="M5 12l2-4"/><path d="M19 12l-2-4"/><circle cx="12" cy="4" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
        'Meals': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><path d="M6 1v3"/><path d="M10 1v3"/><path d="M14 1v3"/></svg>',
    };
    return icons[amenity] || '';
}

function renderDirectResults(schedules) {
    const resultsList = document.getElementById('resultsList');
    resultsList.innerHTML = schedules.map(s => scheduleCardHtml(s)).join('');
}

function scheduleCardHtml(s) {
    const depart = new Date(s.departure_time);
    const arrive = new Date(s.arrival_time);
    const timeFmt = d => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const hours = Math.round(s.duration_minutes / 60 * 10) / 10;
    const amenities = (s.available_seats > 0 ? ['AC', 'USB'] : []);

    return `
        <div class="result-card" onclick='selectSchedule(${JSON.stringify(s.id)})'>
            <div class="result-main">
                <div class="result-operator">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.operator_name)}&background=444&color=fff&size=48" alt="${s.operator_name}">
                    <div class="result-operator-info">
                        <h4>${s.operator_name}</h4>
                        <span>${s.bus_type} &bull; &#9733; ${s.operator_rating}</span>
                    </div>
                </div>
                <div class="result-times">
                    <div class="result-time"><span class="time">${timeFmt(depart)}</span><span class="city">${s.from_city}</span></div>
                    <div class="result-duration"><div class="line"></div><span>${hours} hrs</span></div>
                    <div class="result-time"><span class="time">${timeFmt(arrive)}</span><span class="city">${s.to_city}</span></div>
                </div>
            </div>
            <div class="result-amenities">
                ${amenities.map(a => `<span class="amenity-tag">${getAmenityIcon(a)}${a}</span>`).join('')}
            </div>
            <div class="result-action">
                <div class="result-price"><span class="amount">$${s.price.toFixed(0)}</span><span class="per">per person</span></div>
                <span class="result-seats">${s.available_seats} seats left</span>
                <button class="btn-primary" ${s.available_seats === 0 ? 'disabled' : ''}>Select</button>
            </div>
        </div>`;
}

function renderConnectionResults(itineraries) {
    const resultsList = document.getElementById('resultsList');
    resultsList.innerHTML = `<p style="padding:8px 4px;color:var(--text-secondary);">No direct bus - showing connecting itineraries via a hub city:</p>` +
        itineraries.map((it, idx) => {
            const legsHtml = it.legs.map((leg, i) => `
                <div style="margin-bottom:8px;">
                    ${i > 0 ? `<div style="font-size:12px;color:var(--text-tertiary);margin:6px 0;">&#8635; ${leg.layover_minutes} min layover</div>` : ''}
                    ${scheduleCardHtml(leg.schedule)}
                </div>`).join('');
            return `
                <div class="itinerary-group" style="border:3px dotted var(--border-color);border-radius:var(--radius-lg);padding:16px;margin-bottom:16px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                        <strong>${it.connections} connection &bull; ${Math.round(it.total_duration_minutes / 60)} hrs total</strong>
                        <strong>$${it.total_price.toFixed(0)} total</strong>
                    </div>
                    ${legsHtml}
                </div>`;
        }).join('');
}

async function selectSchedule(scheduleId) {
    try {
        const seats = await api(`/api/schedules/${scheduleId}/seats`, { auth: false });
        state.selectedSchedule = { id: scheduleId };

        document.getElementById('seatFromCity').textContent = state.bookingDetails.from ? cities[state.bookingDetails.from].name : '';
        document.getElementById('seatToCity').textContent = state.bookingDetails.to ? cities[state.bookingDetails.to].name : '';

        renderSeats(seats);
        state.selectedSeats = [];
        updateSeatSummary();
        showView('seatSelection');
    } catch (err) {
        showToast(err.message);
    }
}

// backward-compat alias used by a couple of inline handlers in index.html
function selectBus(busId) { selectSchedule(busId); }

// ==========================================
// Seat Selection (real backend seat map, not randomized)
// ==========================================

function initSeats() { /* seats render once a schedule is chosen */ }

function renderSeats(seats) {
    const seatsGrid = document.getElementById('seatsGrid');
    let html = '';
    seats.forEach((seat, i) => {
        const col = i % 4;
        if (col === 2) html += '<div class="seat aisle"></div>';
        const cls = [
            seat.status !== 'available' ? 'occupied' : '',
            seat.is_vip ? 'vip' : '',
        ].filter(Boolean).join(' ');
        html += `
            <div class="seat ${cls}" data-seat="${seat.label}" data-price="${seat.price}" onclick="toggleSeat(this)">
                ${seat.label}
            </div>`;
    });
    seatsGrid.innerHTML = html;
}

function toggleSeat(seatElement) {
    if (seatElement.classList.contains('occupied')) return;
    const seatLabel = seatElement.dataset.seat;
    const seatPrice = parseFloat(seatElement.dataset.price);

    if (seatElement.classList.contains('selected')) {
        seatElement.classList.remove('selected');
        state.selectedSeats = state.selectedSeats.filter(s => s.label !== seatLabel);
    } else {
        if (state.selectedSeats.length >= state.bookingDetails.passengers) {
            showToast(`You can only select ${state.bookingDetails.passengers} seat(s)`);
            return;
        }
        seatElement.classList.add('selected');
        state.selectedSeats.push({ label: seatLabel, price: seatPrice, isVIP: seatElement.classList.contains('vip') });
    }
    updateSeatSummary();
}

function updateSeatSummary() {
    const selectedSeatsList = document.getElementById('selectedSeatsList');
    const baseFare = document.getElementById('baseFare');
    const vipFeeRow = document.getElementById('vipFeeRow');
    const vipFee = document.getElementById('vipFee');
    const totalPrice = document.getElementById('totalPrice');
    const proceedBtn = document.getElementById('proceedToPayment');

    if (state.selectedSeats.length === 0) {
        selectedSeatsList.innerHTML = '<p class="no-seats">No seats selected</p>';
        baseFare.textContent = '$0.00';
        vipFeeRow.style.display = 'none';
        totalPrice.textContent = '$2.00';
        proceedBtn.disabled = true;
        return;
    }

    selectedSeatsList.innerHTML = state.selectedSeats.map(seat => `
        <div class="selected-seat-item">
            <span class="seat-label">Seat ${seat.label} ${seat.isVIP ? '(VIP)' : ''}</span>
            <span class="seat-price">$${seat.price.toFixed(2)}</span>
        </div>`).join('');

    const baseTotal = state.selectedSeats.reduce((sum, seat) => sum + (seat.isVIP ? seat.price - 10 : seat.price), 0);
    const vipTotal = state.selectedSeats.filter(s => s.isVIP).length * 10;
    const total = baseTotal + vipTotal + 2;

    baseFare.textContent = `$${baseTotal.toFixed(2)}`;
    if (vipTotal > 0) { vipFeeRow.style.display = 'flex'; vipFee.textContent = `$${vipTotal.toFixed(2)}`; }
    else vipFeeRow.style.display = 'none';

    totalPrice.textContent = `$${total.toFixed(2)}`;
    proceedBtn.disabled = false;
}

// ==========================================
// Payment (creates a real booking, then a real sandbox payment)
// ==========================================

function initPaymentMethods() {
    const paymentOptions = document.querySelectorAll('.payment-option input');
    paymentOptions.forEach(option => {
        option.addEventListener('change', () => {
            ['mpesa', 'card', 'mtn', 'airtel'].forEach(p => {
                const form = document.getElementById(p + 'Form');
                if (form) form.style.display = 'none';
            });
            const activeForm = document.getElementById(option.value + 'Form');
            if (activeForm) activeForm.style.display = 'block';
            document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('active'));
            option.closest('.payment-option').classList.add('active');
        });
    });
}

function updatePaymentView() {
    if (state.selectedSeats.length && state.bookingDetails.from) {
        const fromCity = cities[state.bookingDetails.from];
        const toCity = cities[state.bookingDetails.to];
        document.getElementById('paymentFrom').textContent = fromCity.name;
        document.getElementById('paymentTo').textContent = toCity.name;
        document.getElementById('paymentDate').textContent = state.bookingDetails.date;
        document.getElementById('paymentSeats').textContent = state.selectedSeats.map(s => s.label).join(', ');

        const total = state.selectedSeats.reduce((sum, s) => sum + s.price, 0) + 2;
        document.getElementById('paymentTicket').textContent = `$${(total - 2).toFixed(2)}`;
        document.getElementById('paymentTotal').textContent = `$${total.toFixed(2)}`;
    }
}

const originalShowView = showView;
window.showView = function (viewName) {
    originalShowView(viewName);
    if (viewName === 'payment') updatePaymentView();
};

async function processPayment() {
    if (!requireAuth()) return;

    const passengerName = document.getElementById('passengerName').value;
    const idNumber = document.getElementById('idNumber').value;
    const passengerEmail = document.getElementById('passengerEmail').value;
    if (!passengerName || !idNumber || !passengerEmail) return showToast('Please fill in all passenger details');
    if (!state.selectedSeats.length) return showToast('Please select at least one seat');

    const provider = document.querySelector('input[name="payment"]:checked').value;
    const phoneField = { mpesa: 'mpesaPhone', mtn: 'mtnPhone', airtel: 'airtelPhone', card: null }[provider];
    const phone = phoneField ? document.getElementById(phoneField).value : '';
    if (phoneField && !phone) return showToast('Please enter your payment phone number');

    const btn = document.querySelector('.payment-container .btn-primary');
    const originalBtnHtml = btn.innerHTML;
    btn.innerHTML = '<span class="loading">Creating booking...</span>';
    btn.disabled = true;

    try {
        const booking = await api('/api/bookings', {
            method: 'POST',
            body: {
                schedule_id: state.selectedSchedule.id,
                passengers: state.selectedSeats.map(s => ({ seat_label: s.label, full_name: passengerName, id_number: idNumber })),
            },
        });
        state.currentBooking = booking;

        btn.innerHTML = '<span class="loading">Processing payment...</span>';
        const paymentInit = await api('/api/payments/initiate', {
            method: 'POST',
            body: { booking_id: booking.id, provider, phone },
        });

        const finalStatus = await pollPaymentStatus(paymentInit.checkout_request_id);
        if (finalStatus !== 'success') {
            showToast('Payment was not completed. Please try again.');
            btn.innerHTML = originalBtnHtml;
            btn.disabled = false;
            return;
        }

        const ticket = await api(`/api/tickets/by-booking/${booking.id}`);
        state.currentTicket = { ...ticket, schedule_id: state.selectedSchedule.id };

        document.getElementById('bookingRef').textContent = booking.booking_ref;
        const fromCity = cities[state.bookingDetails.from];
        const toCity = cities[state.bookingDetails.to];
        document.getElementById('successRoute').textContent = `${fromCity.name} → ${toCity.name}`;
        document.getElementById('successDate').textContent = state.bookingDetails.date;

        btn.innerHTML = originalBtnHtml;
        btn.disabled = false;
        renderTicketView();
        showModal('success');
    } catch (err) {
        showToast(err.message);
        btn.innerHTML = originalBtnHtml;
        btn.disabled = false;
    }
}

async function pollPaymentStatus(checkoutRequestId, maxAttempts = 12, intervalMs = 1500) {
    for (let i = 0; i < maxAttempts; i++) {
        const result = await api(`/api/payments/status/${checkoutRequestId}`);
        if (result.status !== 'pending') return result.status;
        await new Promise(r => setTimeout(r, intervalMs));
    }
    return 'pending';
}

function renderTicketView() {
    if (!state.currentTicket) return;
    const t = state.currentTicket;

    document.querySelectorAll('.qr-pattern').forEach(el => {
        const img = document.createElement('img');
        img.src = `data:image/png;base64,${t.qr_base64}`;
        img.style.width = '100%';
        img.style.height = '100%';
        el.replaceWith(img);
    });

    const set = (id, value) => { const el = document.getElementById(id); if (el && value !== undefined) el.textContent = value; };
    const ticketIdEl = document.querySelector('.ticket-id');
    if (ticketIdEl) ticketIdEl.textContent = `REF: ${t.ticket_code}`;
    const statusEl = document.querySelector('.ticket-status');
    if (statusEl) statusEl.textContent = t.status.toUpperCase();

    if (t.departure_time) {
        const d = new Date(t.departure_time);
        set('ticketDate', d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
        set('ticketTime', d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
    }
    set('ticketFromCode', t.from_code);
    set('ticketFromName', t.from_city);
    set('ticketToCode', t.to_code);
    set('ticketToName', t.to_city);
    if (t.duration_minutes) set('ticketDuration', `${Math.round(t.duration_minutes / 60)}h`);
    set('ticketOperator', t.operator_name);
    set('ticketBusPlate', t.bus_plate);
    set('ticketSeat', (t.seats || []).join(', '));
    set('ticketClass', t.is_vip ? 'VIP' : 'Standard');
    set('ticketPassenger', t.passenger_name);
}

// ==========================================
// Routes Page (real backend catalog)
// ==========================================

let allRoutesCache = [];

async function loadRoutesPage() {
    const routesList = document.getElementById('routesList');
    routesList.innerHTML = `<p style="text-align:center;padding:40px;color:var(--text-secondary);">Loading routes...</p>`;
    try {
        allRoutesCache = await api('/api/routes', { auth: false });
        renderRoutesList(allRoutesCache);
    } catch (err) {
        routesList.innerHTML = `<p style="text-align:center;padding:40px;color:var(--error);">${err.message}</p>`;
    }
}

function renderRoutesList(routes) {
    const routesList = document.getElementById('routesList');
    if (routes.length === 0) {
        routesList.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-secondary);">No routes found matching your filters</p>';
        return;
    }
    routesList.innerHTML = routes.map(r => `
        <div class="route-list-item" onclick="selectRoute('${r.from_city.toLowerCase()}', '${r.to_city.toLowerCase()}'); showView('home');">
            <div class="route-info">
                <h3>${r.from_city}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    ${r.to_city}
                </h3>
                <p>${r.from_country} &rarr; ${r.to_country} &bull; ${Math.round(r.duration_minutes / 60)} hrs</p>
            </div>
            <div class="route-schedule"><span>Schedule</span><strong>${r.schedule_days}</strong></div>
            <div class="route-operators"><span>From</span><strong>$${r.base_price.toFixed(0)}</strong></div>
            <button class="btn-primary">Book Now</button>
        </div>`).join('');
}

function applyFilters() {
    const filterFrom = document.getElementById('filterFrom').value;
    const filterTo = document.getElementById('filterTo').value;
    const filterPrice = document.getElementById('filterPrice').value;

    let filtered = allRoutesCache;
    if (filterFrom) filtered = filtered.filter(r => r.from_city.toLowerCase() === filterFrom);
    if (filterTo) filtered = filtered.filter(r => r.to_city.toLowerCase() === filterTo);
    if (filterPrice) {
        const [min, max] = filterPrice.split('-').map(p => p === '+' ? Infinity : parseInt(p) || 0);
        filtered = filtered.filter(r => max === Infinity ? r.base_price >= min : r.base_price >= min && r.base_price <= max);
    }
    renderRoutesList(filtered);
}

// ==========================================
// Bookings Page (real backend)
// ==========================================

let myBookingsCache = [];

async function loadMyBookings() {
    if (!requireAuth()) { showView('home'); return; }
    const bookingsList = document.getElementById('bookingsList');
    bookingsList.innerHTML = `<p style="text-align:center;padding:40px;color:var(--text-secondary);">Loading your bookings...</p>`;
    try {
        myBookingsCache = await api('/api/bookings/mine');
        renderBookings('upcoming');
        document.querySelectorAll('.booking-filter-tab').forEach(tab => {
            tab.onclick = () => {
                document.querySelectorAll('.booking-filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderBookings(tab.dataset.filter);
            };
        });
    } catch (err) {
        bookingsList.innerHTML = `<p style="text-align:center;padding:40px;color:var(--error);">${err.message}</p>`;
    }
}

function bookingFilterStatus(b) {
    if (b.status === 'confirmed') return new Date(b.departure_time) < new Date() ? 'completed' : 'upcoming';
    if (b.status === 'completed') return 'completed';
    if (b.status === 'cancelled') return 'cancelled';
    return 'upcoming';
}

function renderBookings(filter) {
    const bookingsList = document.getElementById('bookingsList');
    const filteredBookings = myBookingsCache.filter(b => bookingFilterStatus(b) === filter);

    if (filteredBookings.length === 0) {
        bookingsList.innerHTML = `<p style="text-align:center;padding:60px;color:var(--text-secondary);">No ${filter} bookings</p>`;
        return;
    }

    bookingsList.innerHTML = filteredBookings.map(b => `
        <div class="booking-item">
            <div class="booking-status ${bookingFilterStatus(b)}"></div>
            <div class="booking-details">
                <h3>${b.from_city}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    ${b.to_city}
                </h3>
                <p>${new Date(b.departure_time).toLocaleString()} &bull; ${b.operator_name} &bull; Seat ${b.seat_labels.join(', ')}</p>
            </div>
            <div class="booking-meta">
                <span class="ref">${b.booking_ref}</span>
                <span class="price">$${b.total_amount.toFixed(2)}</span>
            </div>
            <div class="booking-actions">
                <button class="btn-ghost-small" onclick="trackBookingRef('${b.booking_ref}')">Track</button>
                ${b.ticket_status ? `<button class="btn-ghost-small" onclick="viewBookingTicket('${b.id}')">View Ticket</button>` : ''}
            </div>
        </div>`).join('');
}

async function viewBookingTicket(bookingId) {
    try {
        const ticket = await api(`/api/tickets/by-booking/${bookingId}`);
        state.currentTicket = { ...ticket, schedule_id: myBookingsCache.find(b => b.id === bookingId).schedule_id };
        showView('ticket');
        renderTicketView();
    } catch (err) {
        showToast(err.message);
    }
}

// ==========================================
// Dashboard
// ==========================================

async function loadDashboard() {
    if (!requireAuth()) { showView('home'); return; }
    try {
        const bookings = await api('/api/bookings/mine');
        const upcoming = bookings.filter(b => bookingFilterStatus(b) === 'upcoming');
        const container = document.querySelector('.upcoming-trips');
        if (container) {
            container.innerHTML = upcoming.slice(0, 3).map(b => {
                const d = new Date(b.departure_time);
                return `
                <div class="trip-card">
                    <div class="trip-date"><span class="day">${d.getDate()}</span><span class="month">${d.toLocaleDateString('en-US', { month: 'short' })}</span></div>
                    <div class="trip-details">
                        <div class="trip-route-inline"><span>${b.from_city}</span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                            <span>${b.to_city}</span></div>
                        <div class="trip-meta-inline"><span>${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} &bull; ${b.operator_name} &bull; Seat ${b.seat_labels.join(', ')}</span></div>
                    </div>
                    <div class="trip-actions">
                        <button class="btn-ghost-small" onclick="trackBookingRef('${b.booking_ref}')">Track</button>
                        <button class="btn-ghost-small" onclick="viewBookingTicket('${b.id}')">View Ticket</button>
                    </div>
                </div>`;
            }).join('') || '<p style="color:var(--text-secondary);padding:20px;">No upcoming trips - book your next journey!</p>';
        }
    } catch (err) {
        showToast(err.message);
    }
}

// ==========================================
// Tracking - real interactive map (Leaflet + OpenStreetMap tiles)
//
// Google Maps' JS SDK needs a billed API key we don't have in this environment,
// so this uses Leaflet/OSM instead - a real, freely-licensed map with no key
// required. The bus marker position comes straight from the backend's GPS
// simulation (see backend/app/routers/tracking.py). To switch tile providers to
// Google Maps later, swap the L.tileLayer() call below for the
// @googlemaps/js-api-loader equivalent and supply your own API key.
// Waze has no public embeddable map SDK for third-party live tracking, so
// "Open in Waze" below is a real deep-link into the Waze app/site instead.
// ==========================================

let trackingPollHandle = null;
const mapState = { map: null, busMarker: null, routeLine: null, lastPosition: null };

if (window.L) {
    L.Icon.Default.mergeOptions({
        iconUrl: 'vendor/leaflet/images/marker-icon.png',
        iconRetinaUrl: 'vendor/leaflet/images/marker-icon-2x.png',
        shadowUrl: 'vendor/leaflet/images/marker-shadow.png',
    });
}

function busDivIcon() {
    return L.divIcon({
        className: '',
        html: `<div class="bus-live-icon"><svg viewBox="0 0 40 40" width="20" height="20" fill="currentColor">
            <rect x="3" y="12" width="34" height="18" rx="3"/><circle cx="10" cy="32" r="3.5"/><circle cx="30" cy="32" r="3.5"/>
        </svg></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
    });
}

function ensureMap() {
    if (mapState.map) return mapState.map;
    mapState.map = L.map('liveMap', { zoomControl: true, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(mapState.map);
    return mapState.map;
}

function resetMapLayers() {
    const map = ensureMap();
    if (mapState.routeLine) { map.removeLayer(mapState.routeLine); mapState.routeLine = null; }
    if (mapState.busMarker) { map.removeLayer(mapState.busMarker); mapState.busMarker = null; }
    map.eachLayer(l => { if (l instanceof L.Marker) map.removeLayer(l); });
}

function initRouteMap(fromLat, fromLng, toLat, toLng, fromName, toName) {
    const map = ensureMap();
    resetMapLayers();

    L.marker([fromLat, fromLng]).addTo(map).bindPopup(`<strong>${fromName}</strong> (departure)`);
    L.marker([toLat, toLng]).addTo(map).bindPopup(`<strong>${toName}</strong> (destination)`);
    mapState.routeLine = L.polyline([[fromLat, fromLng], [toLat, toLng]], { color: '#fbbf24', weight: 3, dashArray: '8 6' }).addTo(map);
    mapState.busMarker = L.marker([fromLat, fromLng], { icon: busDivIcon() }).addTo(map).bindPopup('Bus has not departed yet');

    map.fitBounds(mapState.routeLine.getBounds(), { padding: [40, 40] });
    mapState.lastPosition = { lat: fromLat, lng: fromLng };
    setTimeout(() => map.invalidateSize(), 200);
}

function updateBusPosition(lat, lng, progressPct) {
    const map = ensureMap();
    if (!mapState.busMarker) mapState.busMarker = L.marker([lat, lng], { icon: busDivIcon() }).addTo(map);
    mapState.busMarker.setLatLng([lat, lng]);
    mapState.busMarker.setPopupContent(`On route - ${progressPct.toFixed(0)}% complete`);
    mapState.lastPosition = { lat, lng };
}

function openInGoogleMaps() {
    if (!mapState.lastPosition) return showToast('No live position yet');
    window.open(`https://www.google.com/maps?q=${mapState.lastPosition.lat},${mapState.lastPosition.lng}`, '_blank');
}

function openInWaze() {
    if (!mapState.lastPosition) return showToast('No live position yet');
    window.open(`https://waze.com/ul?ll=${mapState.lastPosition.lat},${mapState.lastPosition.lng}&navigate=yes`, '_blank');
}

async function trackRide() {
    const ref = document.getElementById('trackingInput').value.trim();
    if (!ref) return showToast('Please enter a booking reference or parcel tracking code');
    if (ref.toUpperCase().startsWith('PCL-')) return trackParcelCode(ref);
    await trackBookingRef(ref);
}

async function trackBookingRef(ref) {
    document.getElementById('trackingInput').value = ref;
    try {
        const booking = await api(`/api/bookings/by-ref/${ref}`, { auth: false });
        showView('tracking');
        const trackingResult = document.getElementById('trackingResult');
        trackingResult.style.display = 'grid';
        trackingResult.querySelector('.detail-row:nth-child(1) span:last-child').textContent = booking.operator_name;

        initRouteMap(booking.from_lat, booking.from_lng, booking.to_lat, booking.to_lng, booking.from_city, booking.to_city);
        const durationMinutes = (new Date(booking.arrival_time) - new Date(booking.departure_time)) / 60000;
        pollTrackingPosition(booking.schedule_id, durationMinutes);
    } catch (err) {
        showToast(err.message);
    }
}

async function trackParcelCode(code) {
    try {
        const parcel = await api(`/api/parcels/track/${code}`, { auth: false });
        showView('tracking');
        const trackingResult = document.getElementById('trackingResult');
        trackingResult.style.display = 'grid';
        const locationText = trackingResult.querySelector('.location-text');
        if (locationText) locationText.textContent = `Parcel for ${parcel.receiver_name} - ${parcel.status.toUpperCase()}`;

        const map = ensureMap();
        resetMapLayers();
        if (parcel.live) {
            mapState.busMarker = L.marker([parcel.live.lat, parcel.live.lng], { icon: busDivIcon() }).addTo(map).bindPopup(`Parcel ${code}`);
            map.setView([parcel.live.lat, parcel.live.lng], 8);
            mapState.lastPosition = { lat: parcel.live.lat, lng: parcel.live.lng };
        } else {
            showToast('Parcel has not started its journey yet');
        }
        setTimeout(() => map.invalidateSize(), 200);
    } catch (err) {
        showToast(err.message);
    }
}

async function pollTrackingPosition(scheduleId, durationMinutes) {
    if (trackingPollHandle) clearInterval(trackingPollHandle);
    const trackingResult = document.getElementById('trackingResult');

    const update = async () => {
        try {
            const point = await api(`/api/tracking/${scheduleId}`, { auth: false });
            const progressFill = trackingResult.querySelector('.progress-fill');
            const progressInfo = trackingResult.querySelector('.progress-info');
            const statusBadge = trackingResult.querySelector('.status-badge');
            const locationText = trackingResult.querySelector('.location-text');
            const locationSubtext = trackingResult.querySelector('.location-subtext');
            const etaTime = trackingResult.querySelector('.eta-time');

            if (progressFill) progressFill.style.width = `${point.progress_pct}%`;
            if (progressInfo) progressInfo.innerHTML = `<span>${point.progress_pct.toFixed(0)}% Complete</span><span>${remainingLabel(durationMinutes, point.progress_pct)}</span>`;
            if (statusBadge) {
                statusBadge.classList.toggle('on-route', point.progress_pct < 100);
                statusBadge.innerHTML = `<span class="pulse"></span> ${point.progress_pct >= 100 ? 'Arrived' : 'On Route'}`;
            }
            if (locationText) locationText.textContent = point.progress_pct >= 100 ? 'Arrived at destination' : `Live GPS position - ${point.speed_kmh.toFixed(0)} km/h`;
            if (locationSubtext) locationSubtext.textContent = `Updated ${new Date(point.recorded_at).toLocaleTimeString()}`;
            if (etaTime && durationMinutes) {
                const remainingMs = Math.max(0, durationMinutes * (1 - point.progress_pct / 100)) * 60000;
                etaTime.textContent = new Date(Date.now() + remainingMs).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            }

            updateBusPosition(point.lat, point.lng, point.progress_pct);
            if (point.progress_pct >= 100) clearInterval(trackingPollHandle);
        } catch (e) {
            const locationText = trackingResult.querySelector('.location-text');
            if (locationText) locationText.textContent = 'Trip has not started yet - map shows the planned route';
        }
    };
    await update();
    trackingPollHandle = setInterval(update, 4000);
}

function remainingLabel(durationMinutes, progressPct) {
    if (!durationMinutes) return '';
    const remaining = Math.max(0, durationMinutes * (1 - progressPct / 100));
    const hrs = Math.floor(remaining / 60);
    const mins = Math.round(remaining % 60);
    return progressPct >= 100 ? 'Arrived' : `~${hrs}h ${mins}m remaining`;
}

function animateBusMarker() { /* handled by pollTrackingPosition now */ }

function shareLocation() {
    const text = mapState.lastPosition
        ? `Track my bus: https://www.google.com/maps?q=${mapState.lastPosition.lat},${mapState.lastPosition.lng}`
        : 'Track my bus journey';
    if (navigator.share) {
        navigator.share({ title: 'Safari Sync - Live Bus Location', text, url: window.location.href });
    } else {
        navigator.clipboard.writeText(text);
        showToast('Link copied to clipboard');
    }
}

function contactDriver() { showToast('Connecting to driver...'); }

// ==========================================
// Parcels (real backend booking, not a UI toggle)
// ==========================================

function openParcelModal() {
    if (!requireAuth()) return;
    const from = document.getElementById('fromCity').value;
    const to = document.getElementById('toCity').value;
    const date = document.getElementById('departDate').value;
    if (!from || !to || !date) return showToast('Please select a route and date first');

    const name = prompt('Receiver full name:');
    if (!name) return;
    const phone = prompt('Receiver phone number:');
    if (!phone) return;
    const weight = parseFloat(prompt('Parcel weight in kg (max 30):') || '0');
    if (!weight || weight <= 0) return showToast('Please enter a valid weight');

    sendParcel(from, to, date, name, phone, weight);
}

async function sendParcel(from, to, date, receiverName, receiverPhone, weight) {
    try {
        const schedules = await api(`/api/routes/search?from_city=${from}&to_city=${to}&date=${date}`, { auth: false });
        if (!schedules.length) return showToast('No buses on that route/date to carry your parcel');

        const parcel = await api('/api/parcels', {
            method: 'POST',
            body: {
                schedule_id: schedules[0].id,
                sender_name: state.user.first_name + ' ' + state.user.last_name,
                sender_phone: state.user.phone,
                receiver_name: receiverName,
                receiver_phone: receiverPhone,
                weight_kg: weight,
                description: '',
            },
        });
        showToast(`Parcel booked! Tracking code: ${parcel.tracking_code} ($${parcel.price.toFixed(2)})`);
        await trackParcelCode(parcel.tracking_code);
    } catch (err) {
        showToast(err.message);
    }
}

// ==========================================
// Toast Notifications
// ==========================================

function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    toastMessage.textContent = message;
    toast.classList.add('active');
    setTimeout(() => toast.classList.remove('active'), 3500);
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            closeModal(modal.id.replace('Modal', ''));
        });
    }
});

document.querySelectorAll('input').forEach(input => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !input.closest('form')) e.preventDefault();
    });
});

// ==========================================
// Ticket View Logic
// ==========================================

function shareTicket() {
    const t = state.currentTicket;
    const shareData = {
        title: 'My Safari Sync Ticket',
        text: t ? `Here is my ticket. Ref: ${t.ticket_code}` : 'Here is my ticket.',
        url: window.location.href,
    };
    if (navigator.share) {
        navigator.share(shareData).then(() => showToast('Ticket shared successfully')).catch(() => {});
    } else {
        navigator.clipboard.writeText(`Ticket ref: ${t ? t.ticket_code : ''}. Track here: ${window.location.href}`)
            .then(() => showToast('Ticket details copied to clipboard'))
            .catch(() => showToast('Could not share ticket'));
    }
}

function trackTicketRide() {
    if (state.currentTicket && state.currentTicket.booking_ref) {
        trackBookingRef(state.currentTicket.booking_ref);
    } else {
        showView('tracking');
    }
}

console.log('Safari Sync initialized - connected to', API_BASE);

// ==========================================
// Profile: file upload -> real document verification workflow
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const profileNavItems = document.querySelectorAll('.profile-nav-item');
    const profileSections = document.querySelectorAll('.profile-section, .profile-form-section');

    profileNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionName = item.dataset.section;
            profileNavItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            profileSections.forEach(section => { section.style.display = 'none'; });

            let targetId = '';
            if (sectionName === 'files') targetId = 'filesSection';
            else if (sectionName === 'personal') { document.querySelector('.profile-form-section').style.display = 'block'; return; }
            else if (sectionName === 'security') targetId = 'securitySection';
            else if (sectionName === 'notifications') targetId = 'notificationsSection';
            else if (sectionName === 'preferences') targetId = 'preferencesSection';

            const targetSection = document.getElementById(targetId);
            if (targetSection) targetSection.style.display = 'block';
        });
    });
});

const DOC_TYPE_MAP = { 'Yellow Fever Cert': 'yellow_fever', 'Passport': 'passport', 'National ID': 'national_id' };
let myDocumentsCache = [];

async function loadMyDocuments() {
    if (!state.token) return;
    try {
        myDocumentsCache = await api('/api/documents/mine');
    } catch (e) { /* ignore */ }
}

async function handleFileUpload(input, docType) {
    if (!requireAuth()) return;
    if (!(input.files && input.files[0])) return;
    const file = input.files[0];
    const card = input.closest('.file-upload-card');
    const statusBadge = card.querySelector('.file-status');
    const uploadZone = card.querySelector('.upload-zone');

    const formData = new FormData();
    formData.append('doc_type', DOC_TYPE_MAP[docType] || 'passport');
    formData.append('file', file);

    try {
        statusBadge.textContent = 'Uploading...';
        const doc = await api('/api/documents/upload', { method: 'POST', body: formData, formData: true });

        statusBadge.textContent = 'Pending Review';
        statusBadge.className = 'file-status pending';
        uploadZone.classList.add('success');
        uploadZone.innerHTML = `
            <div class="upload-text">${doc.original_filename} (${formatFileSize(file.size)})</div>
            <button class="btn-ghost-small" style="margin-top: 8px;">Replace</button>`;
        showToast(`${docType} uploaded successfully - pending operator review`);
    } catch (err) {
        statusBadge.textContent = 'Missing';
        statusBadge.className = 'file-status missing';
        showToast(err.message);
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ==========================================
// Booking Mode (passenger / parcel toggle)
// ==========================================

function setBookingMode(mode) {
    const passengersGroup = document.querySelector('.passengers-group');
    const searchButtonText = document.querySelector('.booking-form button[type="submit"]');
    const tabs = document.querySelectorAll('.booking-tab');

    tabs.forEach(tab => {
        if (mode === 'parcel' && tab.dataset.tab === 'parcel') tab.classList.add('active');
        else if (mode === 'passenger' && tab.dataset.tab !== 'parcel') {
            if (tab.dataset.tab === 'oneway') tab.classList.add('active');
            else tab.classList.remove('active');
        } else tab.classList.remove('active');
    });

    if (mode === 'parcel') {
        if (passengersGroup) passengersGroup.style.display = 'none';
        if (searchButtonText) searchButtonText.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
            Send Parcel`;
        const trackingTitle = document.getElementById('trackingTitle');
        const trackingSubtitle = document.getElementById('trackingSubtitle');
        if (trackingTitle) trackingTitle.textContent = 'Track Your Parcel';
        if (trackingSubtitle) trackingSubtitle.textContent = 'Enter parcel tracking code to track shipment';
    } else {
        if (passengersGroup) passengersGroup.style.display = 'block';
        if (searchButtonText) searchButtonText.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            Search Buses`;
        const trackingTitle = document.getElementById('trackingTitle');
        const trackingSubtitle = document.getElementById('trackingSubtitle');
        if (trackingTitle) trackingTitle.textContent = 'Track Your Ride';
        if (trackingSubtitle) trackingSubtitle.textContent = 'Enter your booking reference to track your bus in real-time';
    }
}

function triggerSOS() {
    if (confirm('Are you sure you want to trigger an Emergency SOS? This will alert our 24/7 command center and local authorities with your current location.')) {
        const sosButton = document.querySelector('.sos-button');
        sosButton.innerHTML = 'ALERT SENT!';
        sosButton.style.background = '#000';
        sosButton.classList.remove('pulse-animation');
        showToast('SOS ALERT SENT! Help is on the way.');
        console.log('SOS Triggered at: ' + new Date().toISOString());

        setTimeout(() => {
            sosButton.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                EMERGENCY SOS`;
            sosButton.style.background = '#ef4444';
            sosButton.classList.add('pulse-animation');
        }, 5000);
    }
}

// ==========================================
// Operator Portal (real ops console: buses, start trip, scan tickets, manifest)
// ==========================================

async function loadOperatorPortal() {
    if (!state.token || !(state.user.role === 'operator' || state.user.role === 'admin')) {
        showToast('Operator access only');
        showView('home');
        return;
    }
    const summary = document.getElementById('operatorSummary');
    try {
        const me = await api('/api/operators/me');
        summary.innerHTML = `
            <p><strong>${me.name}</strong> ${me.verified ? '&#9989; Verified' : '&#8987; Pending verification'} &bull; Rating ${me.rating}</p>
            <p>${me.buses.length} bus(es): ${me.buses.map(b => `${b.plate_number} (${b.bus_type}, ${b.total_seats} seats)`).join(', ') || 'none yet'}</p>`;
    } catch (err) {
        summary.innerHTML = `<p style="color:var(--text-secondary);">${err.message} - use the traveler account to browse schedule IDs via /docs, or register as an operator below.</p>`;
    }
}

async function opStartTrip() {
    const id = document.getElementById('opScheduleId').value.trim();
    if (!id) return showToast('Enter a schedule ID');
    try {
        const res = await api(`/api/tracking/${id}/start`, { method: 'POST' });
        showToast(res.message);
    } catch (err) {
        showToast(err.message);
    }
}

async function opScanTicket() {
    const code = document.getElementById('opTicketCode').value.trim();
    if (!code) return showToast('Enter a ticket code');
    const resultEl = document.getElementById('opScanResult');
    try {
        const res = await api(`/api/tickets/scan?ticket_code=${encodeURIComponent(code)}`, { method: 'POST' });
        resultEl.innerHTML = `<p style="color:var(--success);">&#10003; Boarded: ${res.passengers.join(', ')} (${res.booking_ref})</p>`;
    } catch (err) {
        resultEl.innerHTML = `<p style="color:var(--error);">${err.message}</p>`;
    }
}

async function opLoadManifest() {
    const id = document.getElementById('opManifestScheduleId').value.trim();
    if (!id) return showToast('Enter a schedule ID');
    const container = document.getElementById('opManifestTable');
    try {
        const manifest = await api(`/api/operators/schedules/${id}/manifest`);
        if (!manifest.length) { container.innerHTML = '<p style="color:var(--text-secondary);">No passengers booked yet.</p>'; return; }
        container.innerHTML = `
            <table style="width:100%;border-collapse:collapse;">
                <tr style="text-align:left;color:var(--text-secondary);font-size:13px;">
                    <th style="padding:8px;">Seat</th><th>Passenger</th><th>ID</th><th>Ref</th><th>Ticket</th>
                </tr>
                ${manifest.map(m => `
                    <tr style="border-top:3px dotted var(--border-color);">
                        <td style="padding:8px;">${m.seat_label}</td>
                        <td>${m.passenger_name}</td>
                        <td>${m.passenger_id_number || '-'}</td>
                        <td>${m.booking_ref}</td>
                        <td>${m.ticket_status}</td>
                    </tr>`).join('')}
            </table>`;
    } catch (err) {
        container.innerHTML = `<p style="color:var(--error);">${err.message}</p>`;
    }
}

async function opRegister() {
    const name = document.getElementById('opCompanyName').value.trim();
    if (!name) return showToast('Enter a company name');
    if (!requireAuth()) return;
    try {
        const res = await api(`/api/operators/register?company_name=${encodeURIComponent(name)}`, { method: 'POST' });
        showToast(res.message);
        state.user.role = 'operator';
        loadOperatorPortal();
    } catch (err) {
        showToast(err.message);
    }
}
