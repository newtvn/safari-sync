// Safari Sync - Bus Booking Application
// Complete JavaScript functionality

// ==========================================
// State Management
// ==========================================

const state = {
    user: null,
    currentView: 'home',
    selectedRoute: null,
    selectedBus: null,
    selectedSeats: [],
    bookingDetails: {
        from: '',
        to: '',
        date: '',
        returnDate: '',
        passengers: 1,
        tripType: 'oneway'
    }
};

// ==========================================
// Data
// ==========================================

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

const routes = [
    { id: 1, from: 'nairobi', to: 'kampala', duration: '10 hrs', price: 35, operators: ['Modern Safari', 'Easy Coach', 'Jaguar Express'], schedule: 'Daily', amenities: ['WiFi', 'AC', 'USB'] },
    { id: 2, from: 'kampala', to: 'kigali', duration: '8 hrs', price: 30, operators: ['Jaguar Express', 'Trinity Express'], schedule: 'Daily', amenities: ['AC', 'Meals'] },
    { id: 3, from: 'nairobi', to: 'kigali', duration: '18 hrs', price: 55, operators: ['Modern Safari', 'Kampala Coach'], schedule: 'Tue, Thu, Sat', amenities: ['WiFi', 'AC', 'Sleeper', 'Meals'] },
    { id: 4, from: 'kampala', to: 'juba', duration: '12 hrs', price: 45, operators: ['Nile Star', 'Unity Express'], schedule: 'Daily', amenities: ['AC', 'Border Assist'] },
    { id: 5, from: 'nairobi', to: 'mombasa', duration: '8 hrs', price: 25, operators: ['Modern Safari', 'Easy Coach', 'Mash East Africa'], schedule: 'Hourly', amenities: ['WiFi', 'AC', 'USB'] },
    { id: 6, from: 'nairobi', to: 'kisumu', duration: '6 hrs', price: 20, operators: ['Easy Coach', 'Climax Coaches'], schedule: 'Hourly', amenities: ['AC'] },
    { id: 7, from: 'kampala', to: 'nairobi', duration: '10 hrs', price: 35, operators: ['Modern Safari', 'Easy Coach', 'Jaguar Express'], schedule: 'Daily', amenities: ['WiFi', 'AC', 'USB'] },
    { id: 8, from: 'kigali', to: 'kampala', duration: '8 hrs', price: 30, operators: ['Jaguar Express', 'Trinity Express'], schedule: 'Daily', amenities: ['AC', 'Meals'] }
];

const operators = {
    'Modern Safari': { rating: 4.8, color: '#d97706', logo: 'MS' },
    'Easy Coach': { rating: 4.6, color: '#059669', logo: 'EC' },
    'Jaguar Express': { rating: 4.7, color: '#dc2626', logo: 'JE' },
    'Trinity Express': { rating: 4.5, color: '#7c3aed', logo: 'TE' },
    'Kampala Coach': { rating: 4.4, color: '#0891b2', logo: 'KC' },
    'Nile Star': { rating: 4.3, color: '#0369a1', logo: 'NS' },
    'Unity Express': { rating: 4.2, color: '#15803d', logo: 'UE' },
    'Mash East Africa': { rating: 4.5, color: '#b91c1c', logo: 'ME' },
    'Climax Coaches': { rating: 4.4, color: '#9333ea', logo: 'CC' }
};

const busSchedules = [
    { id: 1, operator: 'Modern Safari', departure: '06:00', arrival: '16:00', type: 'Executive', price: 35, seats: 45, available: 12 },
    { id: 2, operator: 'Easy Coach', departure: '08:00', arrival: '18:00', type: 'Standard', price: 30, seats: 50, available: 23 },
    { id: 3, operator: 'Jaguar Express', departure: '10:00', arrival: '20:00', type: 'VIP', price: 45, seats: 35, available: 8 },
    { id: 4, operator: 'Modern Safari', departure: '14:00', arrival: '00:00', type: 'Executive', price: 35, seats: 45, available: 31 },
    { id: 5, operator: 'Jaguar Express', departure: '22:00', arrival: '08:00', type: 'Sleeper', price: 50, seats: 30, available: 15 }
];

const userBookings = [
    { id: 'SS-2024-001234', from: 'Nairobi', to: 'Kampala', date: 'Jan 15, 2024', time: '6:00 AM', operator: 'Modern Safari', seat: 'A1', price: 37, status: 'upcoming' },
    { id: 'SS-2024-001198', from: 'Kampala', to: 'Kigali', date: 'Jan 22, 2024', time: '8:00 AM', operator: 'Jaguar Express', seat: 'B3', price: 32, status: 'upcoming' },
    { id: 'SS-2024-001102', from: 'Nairobi', to: 'Mombasa', date: 'Dec 28, 2023', time: '7:00 AM', operator: 'Easy Coach', seat: 'C5', price: 27, status: 'completed' },
    { id: 'SS-2024-001045', from: 'Mombasa', to: 'Nairobi', date: 'Dec 30, 2023', time: '2:00 PM', operator: 'Modern Safari', seat: 'A2', price: 27, status: 'completed' },
    { id: 'SS-2024-000987', from: 'Nairobi', to: 'Kisumu', date: 'Dec 20, 2023', time: '9:00 AM', operator: 'Climax Coaches', seat: 'D1', price: 22, status: 'cancelled' }
];

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
    populateRoutes();
    populateBookings();
    setMinDate();

    // Check for logged in user
    const savedUser = localStorage.getItem('safariSyncUser');
    if (savedUser) {
        state.user = JSON.parse(savedUser);
        updateUIForLoggedInUser();
    }
});

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

    // Scroll effect
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
}

function showView(viewName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });

    // Show target view
    const targetView = document.getElementById(viewName + 'View');
    if (targetView) {
        targetView.classList.add('active');
        state.currentView = viewName;

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Close mobile menu if open
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu.classList.contains('active')) {
        toggleMobileMenu();
    }
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

    // Close on outside click
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

    // Close mobile menu if open
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu && mobileMenu.classList.contains('active')) {
        toggleMobileMenu();
    }
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
// Authentication
// ==========================================

function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    // Simulate login
    if (email && password) {
        state.user = {
            firstName: 'Newtvn',
            lastName: '',
            email: email,
            phone: '+254 712 345 678'
        };

        localStorage.setItem('safariSyncUser', JSON.stringify(state.user));
        updateUIForLoggedInUser();
        closeModal('login');
        showToast('Welcome back, Newtvn!');
    }
}

function handleSignup(e) {
    e.preventDefault();

    const firstName = document.getElementById('signupFirstName').value;
    const lastName = document.getElementById('signupLastName').value;
    const email = document.getElementById('signupEmail').value;
    const phone = document.getElementById('signupPhone').value;

    // Simulate signup
    if (firstName && lastName && email && phone) {
        state.user = {
            firstName,
            lastName,
            email,
            phone: document.getElementById('signupCountryCode').value + ' ' + phone
        };

        localStorage.setItem('safariSyncUser', JSON.stringify(state.user));
        updateUIForLoggedInUser();
        closeModal('signup');
        showToast('Account created successfully!');
        showView('dashboard');
    }
}

function logout() {
    state.user = null;
    localStorage.removeItem('safariSyncUser');
    updateUIForLoggedOutUser();
    showView('home');
    showToast('You have been logged out');
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

    const initials = state.user.firstName[0] + (state.user.lastName ? state.user.lastName[0] : '');
    userAvatarNav.textContent = initials;
    userNameNav.textContent = state.user.firstName;

    if (dashboardName) {
        dashboardName.textContent = state.user.firstName;
    }

    // Update profile
    const profileAvatar = document.getElementById('profileAvatar');
    const profileFirstName = document.getElementById('profileFirstName');
    const profileLastName = document.getElementById('profileLastName');
    const profileEmail = document.getElementById('profileEmail');
    const profilePhone = document.getElementById('profilePhone');

    if (profileAvatar) profileAvatar.textContent = initials;
    if (profileFirstName) profileFirstName.value = state.user.firstName;
    if (profileLastName) profileLastName.value = state.user.lastName;
    if (profileEmail) profileEmail.value = state.user.email;
    if (profilePhone) profilePhone.value = state.user.phone;
}

function updateUIForLoggedOutUser() {
    const navActions = document.getElementById('navActions');
    const navUser = document.getElementById('navUser');
    const mobileAuthButtons = document.getElementById('mobileAuthButtons');
    const mobileUserMenu = document.getElementById('mobileUserMenu');

    navActions.style.display = 'flex';
    navUser.style.display = 'none';
    mobileAuthButtons.style.display = 'flex';
    mobileUserMenu.style.display = 'none';
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
}

// ==========================================
// Booking Form
// ==========================================

function initBookingForm() {
    const bookingForm = document.getElementById('bookingForm');

    bookingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        searchBuses();
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

    // Set default date to tomorrow
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

    // Scroll to booking form
    document.querySelector('.booking-card').scrollIntoView({ behavior: 'smooth' });
}

function searchBuses() {
    const from = document.getElementById('fromCity').value;
    const to = document.getElementById('toCity').value;
    const date = document.getElementById('departDate').value;
    const passengers = document.getElementById('passengers').value;

    if (!from || !to || !date) {
        showToast('Please fill in all fields');
        return;
    }

    if (from === to) {
        showToast('Origin and destination cannot be the same');
        return;
    }

    state.bookingDetails = {
        from,
        to,
        date,
        passengers: parseInt(passengers)
    };

    // Update search summary
    const fromCity = cities[from];
    const toCity = cities[to];
    const formattedDate = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    document.getElementById('searchSummary').innerHTML = `
        <h2>${fromCity.name} → ${toCity.name}</h2>
        <p>${formattedDate} • ${passengers} Passenger${passengers > 1 ? 's' : ''}</p>
    `;

    // Generate results
    generateSearchResults(from, to);

    showView('searchResults');
}

function generateSearchResults(from, to) {
    const resultsList = document.getElementById('resultsList');
    const matchingRoute = routes.find(r => r.from === from && r.to === to);

    if (!matchingRoute) {
        resultsList.innerHTML = `
            <div class="no-results">
                <h3>No buses found for this route</h3>
                <p>Try a different date or check our popular routes</p>
            </div>
        `;
        return;
    }

    const fromCity = cities[from];
    const toCity = cities[to];

    resultsList.innerHTML = busSchedules.map(bus => {
        const op = operators[bus.operator];
        return `
            <div class="result-card" onclick="selectBus(${bus.id})">
                <div class="result-main">
                    <div class="result-operator">
                        <img src="https://ui-avatars.com/api/?name=${op.logo}&background=${op.color.slice(1)}&color=fff&size=48" alt="${bus.operator}">
                        <div class="result-operator-info">
                            <h4>${bus.operator}</h4>
                            <span>${bus.type} • ⭐ ${op.rating}</span>
                        </div>
                    </div>
                    <div class="result-times">
                        <div class="result-time">
                            <span class="time">${bus.departure}</span>
                            <span class="city">${fromCity.name}</span>
                        </div>
                        <div class="result-duration">
                            <div class="line"></div>
                            <span>${matchingRoute.duration}</span>
                        </div>
                        <div class="result-time">
                            <span class="time">${bus.arrival}</span>
                            <span class="city">${toCity.name}</span>
                        </div>
                    </div>
                </div>
                <div class="result-amenities">
                    ${matchingRoute.amenities.map(a => `
                        <span class="amenity-tag">
                            ${getAmenityIcon(a)}
                            ${a}
                        </span>
                    `).join('')}
                </div>
                <div class="result-action">
                    <div class="result-price">
                        <span class="amount">$${bus.price}</span>
                        <span class="per">per person</span>
                    </div>
                    <span class="result-seats">${bus.available} seats left</span>
                    <button class="btn-primary">Select</button>
                </div>
            </div>
        `;
    }).join('');
}

function getAmenityIcon(amenity) {
    const icons = {
        'WiFi': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/></svg>',
        'AC': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v10"/><path d="M18.5 8.5L12 12 5.5 8.5"/><path d="M12 22v-6"/><path d="M5.5 15.5L12 12l6.5 3.5"/></svg>',
        'USB': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22V2"/><path d="M5 12h14"/><path d="M5 12l2-4"/><path d="M19 12l-2-4"/><circle cx="12" cy="4" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
        'Meals': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><path d="M6 1v3"/><path d="M10 1v3"/><path d="M14 1v3"/></svg>',
        'Sleeper': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4v16"/><path d="M22 4v16"/><path d="M2 8h20"/><path d="M2 16h20"/></svg>',
        'Border Assist': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
    };
    return icons[amenity] || '';
}

function selectBus(busId) {
    const bus = busSchedules.find(b => b.id === busId);
    state.selectedBus = bus;

    const fromCity = cities[state.bookingDetails.from];
    const toCity = cities[state.bookingDetails.to];

    // Update seat selection view
    document.getElementById('seatFromCity').textContent = fromCity.name;
    document.getElementById('seatToCity').textContent = toCity.name;
    document.getElementById('seatDepartTime').textContent = bus.departure;
    document.getElementById('seatArriveTime').textContent = bus.arrival;
    document.getElementById('seatOperator').textContent = bus.operator;
    document.getElementById('seatBusType').textContent = bus.type;

    const route = routes.find(r => r.from === state.bookingDetails.from && r.to === state.bookingDetails.to);
    document.getElementById('seatDuration').textContent = route ? route.duration : '~10 hrs';

    // Generate seats
    generateSeats(bus);

    // Reset selected seats
    state.selectedSeats = [];
    updateSeatSummary();

    showView('seatSelection');
}

// ==========================================
// Seat Selection
// ==========================================

function initSeats() {
    // Initial seat generation will happen when a bus is selected
}

function generateSeats(bus) {
    const seatsGrid = document.getElementById('seatsGrid');
    const totalSeats = bus.seats;
    const occupiedCount = totalSeats - bus.available;

    // Generate occupied seat indices randomly
    const occupiedIndices = new Set();
    while (occupiedIndices.size < occupiedCount) {
        occupiedIndices.add(Math.floor(Math.random() * totalSeats));
    }

    // VIP seats (first 8)
    const vipSeats = new Set([0, 1, 2, 3, 4, 5, 6, 7]);

    let seatsHTML = '';
    const rows = Math.ceil(totalSeats / 4);

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < 4; col++) {
            const seatIndex = row * 4 + col;
            if (seatIndex >= totalSeats) continue;

            // Add aisle space
            if (col === 2) {
                seatsHTML += '<div class="seat aisle"></div>';
            }

            const seatLabel = String.fromCharCode(65 + (col > 1 ? col - 1 : col)) + (row + 1);
            const isOccupied = occupiedIndices.has(seatIndex);
            const isVIP = vipSeats.has(seatIndex);

            seatsHTML += `
                <div class="seat ${isOccupied ? 'occupied' : ''} ${isVIP ? 'vip' : ''}"
                     data-seat="${seatLabel}"
                     data-price="${isVIP ? bus.price + 10 : bus.price}"
                     onclick="toggleSeat(this)">
                    ${seatLabel}
                </div>
            `;
        }
    }

    seatsGrid.innerHTML = seatsHTML;
}

function toggleSeat(seatElement) {
    if (seatElement.classList.contains('occupied')) return;

    const seatLabel = seatElement.dataset.seat;
    const seatPrice = parseInt(seatElement.dataset.price);

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
            <span class="seat-price">$${seat.price}</span>
        </div>
    `).join('');

    const baseTotal = state.selectedSeats.reduce((sum, seat) => sum + (seat.isVIP ? seat.price - 10 : seat.price), 0);
    const vipTotal = state.selectedSeats.filter(s => s.isVIP).length * 10;
    const total = baseTotal + vipTotal + 2; // +2 for service fee

    baseFare.textContent = `$${baseTotal.toFixed(2)}`;

    if (vipTotal > 0) {
        vipFeeRow.style.display = 'flex';
        vipFee.textContent = `$${vipTotal.toFixed(2)}`;
    } else {
        vipFeeRow.style.display = 'none';
    }

    totalPrice.textContent = `$${total.toFixed(2)}`;
    proceedBtn.disabled = false;
}

// ==========================================
// Payment
// ==========================================

function initPaymentMethods() {
    const paymentOptions = document.querySelectorAll('.payment-option input');

    paymentOptions.forEach(option => {
        option.addEventListener('change', () => {
            // Hide all forms
            document.getElementById('mpesaForm').style.display = 'none';
            document.getElementById('cardForm').style.display = 'none';
            document.getElementById('mtnForm').style.display = 'none';
            document.getElementById('airtelForm').style.display = 'none';

            // Show selected form
            document.getElementById(option.value + 'Form').style.display = 'block';

            // Update active state
            document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('active'));
            option.closest('.payment-option').classList.add('active');
        });
    });
}

function processPayment() {
    // Validate form
    const passengerName = document.getElementById('passengerName').value;
    const idNumber = document.getElementById('idNumber').value;
    const passengerEmail = document.getElementById('passengerEmail').value;

    if (!passengerName || !idNumber || !passengerEmail) {
        showToast('Please fill in all passenger details');
        return;
    }

    // Simulate payment processing
    const btn = document.querySelector('.payment-container .btn-primary');
    btn.innerHTML = '<span class="loading">Processing...</span>';
    btn.disabled = true;

    setTimeout(() => {
        // Generate booking reference
        const bookingRef = 'SS-2024-' + Math.random().toString().substr(2, 6);

        // Update success modal
        document.getElementById('bookingRef').textContent = bookingRef;

        const fromCity = cities[state.bookingDetails.from];
        const toCity = cities[state.bookingDetails.to];
        document.getElementById('successRoute').textContent = `${fromCity.name} → ${toCity.name}`;

        const formattedDate = new Date(state.bookingDetails.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        document.getElementById('successDate').textContent = formattedDate;

        // Reset button
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Pay Now
        `;
        btn.disabled = false;

        // Show success modal
        showModal('success');
    }, 2000);
}

// ==========================================
// Routes Page
// ==========================================

function populateRoutes() {
    const routesList = document.getElementById('routesList');
    if (!routesList) return;

    routesList.innerHTML = routes.map(route => {
        const fromCity = cities[route.from];
        const toCity = cities[route.to];

        return `
            <div class="route-list-item" onclick="selectRoute('${route.from}', '${route.to}'); showView('home');">
                <div class="route-info">
                    <h3>
                        ${fromCity.name}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                        ${toCity.name}
                    </h3>
                    <p>${fromCity.country} → ${toCity.country} • ${route.duration}</p>
                </div>
                <div class="route-schedule">
                    <span>Schedule</span>
                    <strong>${route.schedule}</strong>
                </div>
                <div class="route-operators">
                    <span>From</span>
                    <strong>$${route.price}</strong>
                </div>
                <button class="btn-primary">Book Now</button>
            </div>
        `;
    }).join('');
}

function applyFilters() {
    const filterFrom = document.getElementById('filterFrom').value;
    const filterTo = document.getElementById('filterTo').value;
    const filterPrice = document.getElementById('filterPrice').value;

    let filteredRoutes = routes;

    if (filterFrom) {
        filteredRoutes = filteredRoutes.filter(r => r.from === filterFrom);
    }

    if (filterTo) {
        filteredRoutes = filteredRoutes.filter(r => r.to === filterTo);
    }

    if (filterPrice) {
        const [min, max] = filterPrice.split('-').map(p => p === '+' ? Infinity : parseInt(p) || 0);
        filteredRoutes = filteredRoutes.filter(r => {
            if (max === Infinity) return r.price >= min;
            return r.price >= min && r.price <= max;
        });
    }

    const routesList = document.getElementById('routesList');

    if (filteredRoutes.length === 0) {
        routesList.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--text-secondary);">No routes found matching your filters</p>';
        return;
    }

    routesList.innerHTML = filteredRoutes.map(route => {
        const fromCity = cities[route.from];
        const toCity = cities[route.to];

        return `
            <div class="route-list-item" onclick="selectRoute('${route.from}', '${route.to}'); showView('home');">
                <div class="route-info">
                    <h3>
                        ${fromCity.name}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                        ${toCity.name}
                    </h3>
                    <p>${fromCity.country} → ${toCity.country} • ${route.duration}</p>
                </div>
                <div class="route-schedule">
                    <span>Schedule</span>
                    <strong>${route.schedule}</strong>
                </div>
                <div class="route-operators">
                    <span>From</span>
                    <strong>$${route.price}</strong>
                </div>
                <button class="btn-primary">Book Now</button>
            </div>
        `;
    }).join('');
}

// ==========================================
// Bookings Page
// ==========================================

function populateBookings() {
    const bookingsList = document.getElementById('bookingsList');
    if (!bookingsList) return;

    renderBookings('upcoming');

    // Tab functionality
    document.querySelectorAll('.booking-filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.booking-filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderBookings(tab.dataset.filter);
        });
    });
}

function renderBookings(filter) {
    const bookingsList = document.getElementById('bookingsList');
    const filteredBookings = userBookings.filter(b => b.status === filter);

    if (filteredBookings.length === 0) {
        bookingsList.innerHTML = `<p style="text-align: center; padding: 60px; color: var(--text-secondary);">No ${filter} bookings</p>`;
        return;
    }

    bookingsList.innerHTML = filteredBookings.map(booking => `
        <div class="booking-item">
            <div class="booking-status ${booking.status}"></div>
            <div class="booking-details">
                <h3>
                    ${booking.from}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                    ${booking.to}
                </h3>
                <p>${booking.date} at ${booking.time} • ${booking.operator} • Seat ${booking.seat}</p>
            </div>
            <div class="booking-meta">
                <span class="ref">${booking.id}</span>
                <span class="price">$${booking.price}</span>
            </div>
            <div class="booking-actions">
                ${booking.status === 'upcoming' ? `
                    <button class="btn-ghost-small" onclick="showView('tracking')">Track</button>
                    <button class="btn-ghost-small" onclick="showView('ticket')">View Ticket</button>
                ` : booking.status === 'completed' ? `
                    <button class="btn-ghost-small" onclick="showView('ticket')">View Ticket</button>
                    <button class="btn-ghost-small">Rebook</button>
                ` : `
                    <button class="btn-ghost-small">Rebook</button>
                `}
            </div>
        </div>
    `).join('');
}

// ==========================================
// Tracking
// ==========================================

function trackRide() {
    const trackingInput = document.getElementById('trackingInput').value;

    if (!trackingInput) {
        showToast('Please enter a booking reference');
        return;
    }

    // Simulate tracking lookup
    const trackingResult = document.getElementById('trackingResult');
    trackingResult.style.display = 'grid';

    // Animate bus marker
    animateBusMarker();
}

function animateBusMarker() {
    const busMarker = document.getElementById('busMarker');
    if (!busMarker) return;

    // The bus marker position is already animated via CSS
    // This could be extended to update position from real GPS data
}

function shareLocation() {
    if (navigator.share) {
        navigator.share({
            title: 'Safari Sync - Live Bus Location',
            text: 'Track my bus journey from Nairobi to Kampala',
            url: window.location.href
        });
    } else {
        // Fallback - copy link
        navigator.clipboard.writeText(window.location.href);
        showToast('Link copied to clipboard');
    }
}

function contactDriver() {
    showToast('Connecting to driver...');
}

// ==========================================
// Toast Notifications
// ==========================================

function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    toastMessage.textContent = message;
    toast.classList.add('active');

    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}

// ==========================================
// Utilities
// ==========================================

// Close modals on escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            const modalName = modal.id.replace('Modal', '');
            closeModal(modalName);
        });
    }
});

// Handle payment view updates
function updatePaymentView() {
    if (state.selectedBus && state.bookingDetails.from) {
        const fromCity = cities[state.bookingDetails.from];
        const toCity = cities[state.bookingDetails.to];
        const formattedDate = new Date(state.bookingDetails.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        document.getElementById('paymentFrom').textContent = fromCity.name;
        document.getElementById('paymentTo').textContent = toCity.name;
        document.getElementById('paymentDate').textContent = formattedDate;
        document.getElementById('paymentOperator').textContent = state.selectedBus.operator;
        document.getElementById('paymentDepart').textContent = state.selectedBus.departure;
        document.getElementById('paymentSeats').textContent = state.selectedSeats.map(s => s.label).join(', ');

        const total = state.selectedSeats.reduce((sum, s) => sum + s.price, 0);
        document.getElementById('paymentTicket').textContent = `$${total.toFixed(2)}`;
        document.getElementById('paymentTotal').textContent = `$${(total + 2).toFixed(2)}`;
    }
}

// Override showView to include payment updates
const originalShowView = showView;
window.showView = function (viewName) {
    originalShowView(viewName);
    if (viewName === 'payment') {
        updatePaymentView();
    }
};

// Prevent form submission on enter for certain forms
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !input.closest('form')) {
            e.preventDefault();
        }
    });
});

// ==========================================
// Ticket View Logic
// ==========================================

function shareTicket() {
    const shareData = {
        title: 'My Safari Sync Ticket',
        text: 'Here is my ticket for the trip from Nairobi to Kampala on Jan 15, 2024. Bus Operator: Modern Safari.',
        url: window.location.href // Ideally this would be a unique ticket URL
    };

    if (navigator.share) {
        navigator.share(shareData)
            .then(() => showToast('Ticket shared successfully'))
            .catch((error) => console.log('Error sharing:', error));
    } else {
        // Fallback
        navigator.clipboard.writeText(`Ticket: Nairobi -> Kampala. Ref: SS-8839-XJ. Date: Jan 15. Track here: ${window.location.href}`)
            .then(() => showToast('Ticket details copied to clipboard'))
            .catch(() => showToast('Could not share ticket'));
    }
}

function trackTicketRide() {
    // Switch to tracking view
    showView('tracking');
    // Pre-fill tracking info (simulated)
    const trackingInput = document.getElementById('trackingInput');
    if (trackingInput) {
        trackingInput.value = 'SS-8839-XJ';
        // Auto trigger track
        setTimeout(() => {
            trackRide();
        }, 500);
    }
}

console.log('Safari Sync initialized successfully');

// ==========================================
// Profile File Upload Logic
// ==========================================

// Initialize profile sidebar navigation to handle section switching
document.addEventListener('DOMContentLoaded', () => {
    const profileNavItems = document.querySelectorAll('.profile-nav-item');
    const profileSections = document.querySelectorAll('.profile-section, .profile-form-section');

    profileNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionName = item.dataset.section;

            // Remove active class from all items
            profileNavItems.forEach(nav => nav.classList.remove('active'));
            // Add active class to clicked item
            item.classList.add('active');

            // Hide all sections
            profileSections.forEach(section => {
                section.style.display = 'none';
            });

            // Show selected section
            // Mapping section names to element IDs
            let targetId = '';
            if (sectionName === 'files') {
                targetId = 'filesSection';
            } else if (sectionName === 'personal') {
                // Personal section is the default form container in existing HTML structure which might be class 'profile-form-section'
                // But we need to target it specifically. Let's assume the existing form section is for personal info.
                // We will rely on our new querySelectorAll to find the right elements.
                // Since the original HTML structure for Personal Info didn't have an ID, we assume it shows up by default.
                // We'll fix this by ensuring the Personal Info section has an ID or class we can target.
                // For now, let's treat '.profile-form-section' as the personal info section.
                 document.querySelector('.profile-form-section').style.display = 'block';
                 return;
            } else {
                 // Placeholder for other sections (Security, Notifications etc - not implemented yet but logic handles hiding)
                 // If ID doesn't exist, we do nothing or show coming soon
            }

            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.style.display = 'block';
            }
        });
    });
});

function handleFileUpload(input, docType) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const card = input.closest('.file-upload-card');
        const statusBadge = card.querySelector('.file-status');
        const uploadZone = card.querySelector('.upload-zone');
        
        // Simulate upload
        // In a real app, you would use FormData and fetch to send to backend
        
        statusBadge.textContent = 'Pending Review';
        statusBadge.className = 'file-status pending';
        
        uploadZone.classList.add('success');
        uploadZone.innerHTML = `
            <div class="upload-text">${file.name} (${formatFileSize(file.size)})</div>
            <button class="btn-ghost-small" style="margin-top: 8px;">Replace</button>
        `;
        
        showToast(`${docType} uploaded successfully`);
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
// Parcel Mode & SOS Logic
// ==========================================

function setBookingMode(mode) {
    const passengersGroup = document.querySelector('.passengers-group');
    const searchButtonText = document.querySelector('.booking-form button[type="submit"]');
    const tabs = document.querySelectorAll('.booking-tab');

    // Update active tab state
    tabs.forEach(tab => {
        if (mode === 'parcel' && tab.dataset.tab === 'parcel') {
            tab.classList.add('active');
        } else if (mode === 'passenger' && tab.dataset.tab !== 'parcel') {
            // Keep the previously active passenger tab active or default to one-way
            // For simplicity, if switching back to passenger, defaulting to One Way
            if (tab.dataset.tab === 'oneway') tab.classList.add('active');
            else tab.classList.remove('active');
        } else {
            tab.classList.remove('active');
        }
    });

    if (mode === 'parcel') {
        // Change UI for Parcel
        if (passengersGroup) passengersGroup.style.display = 'none';
        if (searchButtonText) searchButtonText.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
            Send Parcel
        `;
        
        // Update Tracking Title contextually
        const trackingTitle = document.getElementById('trackingTitle');
        const trackingSubtitle = document.getElementById('trackingSubtitle');
        if (trackingTitle) trackingTitle.textContent = 'Track Your Parcel';
        if (trackingSubtitle) trackingSubtitle.textContent = 'Enter parcel reference number to track shipment';

    } else {
        // Change UI for Passenger
        if (passengersGroup) passengersGroup.style.display = 'block';
        if (searchButtonText) searchButtonText.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
            </svg>
            Search Buses
        `;

        // Update Tracking Title contextually
        const trackingTitle = document.getElementById('trackingTitle');
        const trackingSubtitle = document.getElementById('trackingSubtitle');
        if (trackingTitle) trackingTitle.textContent = 'Track Your Ride';
        if (trackingSubtitle) trackingSubtitle.textContent = 'Enter your booking reference to track your bus in real-time';
    }
}

function triggerSOS() {
    if (confirm('Are you sure you want to trigger an Emergency SOS? This will alert our 24/7 command center and local authorities with your current location.')) {
        // Simulate SOS API call
        const sosButton = document.querySelector('.sos-button');
        sosButton.innerHTML = 'ALERT SENT!';
        sosButton.style.background = '#000';
        sosButton.classList.remove('pulse-animation');
        
        showToast('SOS ALERT SENT! Help is on the way.');
        
        // In a real app, this would get geolocation and send to backend
        console.log('SOS Triggered at: ' + new Date().toISOString());
        
        setTimeout(() => {
            // Reset for demo
            sosButton.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                EMERGENCY SOS
            `;
            sosButton.style.background = '#ef4444';
            sosButton.classList.add('pulse-animation');
        }, 5000);
    }
}
