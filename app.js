/**
 * Accurate Lab - Rock-Solid Unified Application Engine
 * Works 100% Offline, on file:///, on localhost, on GitHub Pages, and on any hosting.
 */

(function (window, document) {
  'use strict';

  // Digit normalizer: converts Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) to standard ASCII (0123456789)
  function normalizeDigits(str) {
    if (str === null || str === undefined) return '';
    return str.toString()
      .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
      .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
      .trim();
  }

  const CONFIG = {
    FIREBASE: {
      apiKey: "AIzaSyBF4UsJhaL0a754H3rqgz7O-i1U_tOAvQQ",
      authDomain: "accurate-19f22.firebaseapp.com",
      projectId: "accurate-19f22",
      storageBucket: "accurate-19f22.firebasestorage.app",
      messagingSenderId: "876808771046",
      appId: "1:876808771046:web:a225ca3d084c11f4b6b227",
      databaseURL: "https://accurate-19f22-default-rtdb.firebaseio.com"
    },
    CLOUDINARY: {
      cloudName: "dt1nytaju",
      uploadPreset: "accurate",
      uploadUrl: "https://api.cloudinary.com/v1_1/dt1nytaju/upload"
    },
    ADMIN_PIN: "4k4k"
  };

  const STORAGE = {
    USER: 'accurate_lab_user',
    THEME: 'accurate_theme',
    ADMIN: 'accurate_admin_auth',
    EMPLOYEES: 'accurate_employees_data',
    ATTENDANCE: 'accurate_attendance_data',
    REWARDS: 'accurate_rewards_data',
    SUPPLIES: 'accurate_supplies_data',
    SUPPLY_ORDERS: 'accurate_supply_orders_data',
    LEAVES: 'accurate_leaves_data',
    REGISTRATION_REQUESTS: 'accurate_registration_requests',
    DAILY_UPLOADS: 'accurate_daily_uploads_data'
  };

  const ATTENDANCE_LABELS = {
    morning_in: 'تسجيل دخول صباحي',
    morning_out: 'تسجيل خروج صباحي',
    evening_in: 'تسجيل دخول مسائي',
    evening_out: 'تسجيل خروج مسائي'
  };

  function getLocal(key, defaultVal) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultVal;
    } catch (_) {
      return defaultVal;
    }
  }

  function setLocal(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {}
  }

  // Pre-populate demo / initial data if empty so the lab is never blank
  if (!localStorage.getItem(STORAGE.EMPLOYEES)) {
    setLocal(STORAGE.EMPLOYEES, [
      { code: "1001", isRegistered: true, name: "د. أحمد خليل", area: "فرع المهندسين", phone: "01012345678", createdAt: Date.now() - 86400000 },
      { code: "1002", isRegistered: true, name: "د. سارة محمود", area: "فرع مدينة نصر", phone: "01123456789", createdAt: Date.now() - 72000000 }
    ]);
  }
  if (!localStorage.getItem(STORAGE.SUPPLIES)) {
    setLocal(STORAGE.SUPPLIES, [
      { id: "sup_1", name: "أنابيب EDTA لفصل الدم", category: "علبة 100 أنبوب", unit: "علبة", imageUrl: "", createdAt: Date.now() },
      { id: "sup_2", name: "كواشف CBC ومحاليل تخفيف", category: "عبوة 5 لتر", unit: "عبوة", imageUrl: "", createdAt: Date.now() },
      { id: "sup_3", name: "سنون سرنجات مقاس 21 معقمة", category: "كرتونة 1000 سن", unit: "كرتونة", imageUrl: "", createdAt: Date.now() }
    ]);
  }

  /* =========================================================
     FIREBASE CONNECTOR (With Graceful Fallback)
     ========================================================= */
  let firebaseDb = null;
  function initFirebase() {
    try {
      if (typeof firebase !== 'undefined' && firebase.initializeApp) {
        if (!firebase.apps || !firebase.apps.length) {
          firebase.initializeApp(CONFIG.FIREBASE);
        }
        firebaseDb = firebase.database();
        console.log('✅ Firebase Database connected');
        
        // Seed initial employees into Firebase if absent
        firebaseDb.ref('employees/1001').once('value').then(snap => {
          if (!snap.exists()) {
            firebaseDb.ref('employees/1001').set({
              code: "1001",
              isRegistered: true,
              name: "د. أحمد خليل",
              area: "فرع المهندسين",
              phone: "01012345678",
              createdAt: Date.now() - 86400000
            });
          }
        }).catch(() => {});

        firebaseDb.ref('employees/1002').once('value').then(snap => {
          if (!snap.exists()) {
            firebaseDb.ref('employees/1002').set({
              code: "1002",
              isRegistered: true,
              name: "د. سارة محمود",
              area: "فرع مدينة نصر",
              phone: "01123456789",
              createdAt: Date.now() - 72000000
            });
          }
        }).catch(() => {});

        syncFromFirebase();
      }
    } catch (e) {
      console.warn('Firebase init warning:', e);
    }
  }

  function syncFromFirebase() {
    if (!firebaseDb) return;
    try {
      firebaseDb.ref('employees').on('value', snap => {
        const d = snap.val();
        if (d) {
          const list = Object.keys(d).map(k => ({ ...d[k], code: k }));
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setLocal(STORAGE.EMPLOYEES, list);
          state.employees = list;
          renderAdminViews();
        }
      });
      firebaseDb.ref('attendance').on('value', snap => {
        const d = snap.val();
        if (d) {
          const list = Object.keys(d).map(k => ({ ...d[k], id: k }));
          list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          setLocal(STORAGE.ATTENDANCE, list);
          state.attendance = list;
          renderEmployeeAttendance();
          renderAdminViews();
        }
      });
      firebaseDb.ref('rewards').on('value', snap => {
        const d = snap.val();
        if (d) {
          const list = Object.keys(d).map(k => ({ ...d[k], id: k }));
          list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          setLocal(STORAGE.REWARDS, list);
          state.rewards = list;
          renderEmployeeRewards();
          renderAdminViews();
        }
      });
      firebaseDb.ref('supplies').on('value', snap => {
        const d = snap.val();
        if (d) {
          const list = Object.keys(d).map(k => ({ ...d[k], id: k }));
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setLocal(STORAGE.SUPPLIES, list);
          state.supplies = list;
          renderEmployeeSupplies();
          renderAdminViews();
        }
      });
      firebaseDb.ref('supply_requests').on('value', snap => {
        const d = snap.val();
        if (d) {
          const list = Object.keys(d).map(k => ({ ...d[k], id: k }));
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setLocal(STORAGE.SUPPLY_ORDERS, list);
          state.supplyOrders = list;
          renderEmployeeSupplies();
          renderAdminViews();
        }
      });
      firebaseDb.ref('leave_requests').on('value', snap => {
        const d = snap.val();
        if (d) {
          const list = Object.keys(d).map(k => ({ ...d[k], id: k }));
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setLocal(STORAGE.LEAVES, list);
          state.leaves = list;
          renderEmployeeLeaves();
          renderAdminViews();
        }
      });

      // 7. Live Sync for Registration Requests
      firebaseDb.ref('registration_requests').on('value', snap => {
        const d = snap.val();
        if (d) {
          const list = Object.keys(d).map(k => ({ ...d[k], code: k }));
          list.sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));
          setLocal(STORAGE.REGISTRATION_REQUESTS, list);
          state.registrationRequests = list;
        } else {
          setLocal(STORAGE.REGISTRATION_REQUESTS, []);
          state.registrationRequests = [];
        }
        renderAdminViews();
      });

      // 8. Live Sync for Daily Uploads (Supply & Daily Journal Photos)
      firebaseDb.ref('daily_uploads').on('value', snap => {
        const d = snap.val();
        if (d) {
          const list = Object.keys(d).map(k => ({ ...d[k], id: k }));
          list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          setLocal(STORAGE.DAILY_UPLOADS, list);
          state.dailyUploads = list;
        } else {
          setLocal(STORAGE.DAILY_UPLOADS, []);
          state.dailyUploads = [];
        }
        renderEmployeeDailyUploads();
        renderAdminDailyUploads();
      });
    } catch (_) {}
  }

  /* =========================================================
     APP STATE
     ========================================================= */
  const state = {
    user: getLocal(STORAGE.USER, null),
    theme: localStorage.getItem(STORAGE.THEME) || 'light',
    activePage: 'attendance',
    pendingRegistrationCode: null,
    employees: getLocal(STORAGE.EMPLOYEES, []),
    attendance: getLocal(STORAGE.ATTENDANCE, []),
    rewards: getLocal(STORAGE.REWARDS, []),
    supplies: getLocal(STORAGE.SUPPLIES, []),
    supplyOrders: getLocal(STORAGE.SUPPLY_ORDERS, []),
    leaves: getLocal(STORAGE.LEAVES, []),
    registrationRequests: getLocal(STORAGE.REGISTRATION_REQUESTS, []),
    dailyUploads: getLocal(STORAGE.DAILY_UPLOADS, []),
    uploadedLeaveFile: null,
    uploadedSupplyFile: null,
    selectedReportFiles: {
      supply_receipt: null,
      daily_journal: null
    }
  };
  window.state = state;

  /* =========================================================
     AUDIO FEEDBACK (Web Audio API)
     ========================================================= */
  let audioCtx = null;
  function playSound(type) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!audioCtx) audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const now = audioCtx.currentTime;
      if (type === 'bubble') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(850, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'checkin' || type === 'success') {
        [523.25, 659.25, 783.99].forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          gain.gain.setValueAtTime(0.15, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.22);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.22);
        });
      }
    } catch (_) {}
  }

  /* =========================================================
     TOAST NOTIFICATION
     ========================================================= */
  function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = type === 'success' ? '✅ ' : type === 'error' ? '❌ ' : 'ℹ️ ';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /* =========================================================
     THEME CONTROLLER
     ========================================================= */
  function applyTheme(theme) {
    state.theme = theme;
    localStorage.setItem(STORAGE.THEME, theme);
    document.documentElement.setAttribute('data-theme', theme);
    const sun = document.getElementById('themeIconSun');
    const moon = document.getElementById('themeIconMoon');
    if (sun) sun.style.display = theme === 'dark' ? 'block' : 'none';
    if (moon) moon.style.display = theme === 'dark' ? 'none' : 'block';
  }

  let isTogglingTheme = false;
  window.toggleTheme = function () {
    if (isTogglingTheme) return;
    isTogglingTheme = true;
    setTimeout(() => { isTogglingTheme = false; }, 300);
    const next = state.theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
    playSound('bubble');
    showToast(next === 'dark' ? 'تم تفعيل الوضع الداكن 🌙' : 'تم تفعيل الوضع النهاري ☀️', 'info', 1500);
  };

  /* =========================================================
     VIEW SWITCHER (Login View vs Main App View)
     ========================================================= */
  function updateViewVisibility() {
    const viewLogin = document.getElementById('viewLogin');
    const viewMainApp = document.getElementById('viewMainApp');
    const mobileNav = document.getElementById('mobileNav');
    const userBadge = document.getElementById('userHeaderBadge');
    const logoutBtn = document.getElementById('logoutBtn');
    const nameEl = document.getElementById('userHeaderName');
    const areaEl = document.getElementById('userHeaderArea');
    const avatarEl = document.getElementById('userHeaderAvatar');

    if (!state.user) {
      // Show Login, hide Main App
      if (viewLogin) viewLogin.style.display = 'block';
      if (viewMainApp) viewMainApp.style.display = 'none';
      if (mobileNav) mobileNav.style.display = 'none';
      if (userBadge) userBadge.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'none';
    } else {
      // Show Main App, hide Login
      if (viewLogin) viewLogin.style.display = 'none';
      if (viewMainApp) viewMainApp.style.display = 'block';
      if (mobileNav) mobileNav.style.display = 'flex';
      if (userBadge) userBadge.style.display = 'flex';
      if (logoutBtn) logoutBtn.style.display = 'flex';

      if (nameEl) nameEl.textContent = state.user.name || `كود: ${state.user.code}`;
      if (areaEl) areaEl.textContent = state.user.area || 'معمل أكيوريت';
      if (avatarEl) avatarEl.textContent = (state.user.name || 'م').charAt(0);

      renderAllEmployeeViews();
    }
  }
  window.updateViewVisibility = updateViewVisibility;

  /* =========================================================
     0.5s SKY-BLUE & WHITE BUBBLES TRANSITION
     ========================================================= */
  window.navigateToPage = function (targetPageId) {
    if (state.activePage === targetPageId) return;

    playSound('bubble');
    const overlay = document.getElementById('pageTransitionOverlay');
    if (overlay) overlay.classList.add('animating');

    setTimeout(() => {
      ['attendance', 'rewards', 'supplies', 'leave'].forEach(p => {
        const pageEl = document.getElementById('page' + p.charAt(0).toUpperCase() + p.slice(1));
        if (pageEl) pageEl.classList.toggle('active', p === targetPageId);
      });

      document.querySelectorAll('.desktop-nav-item, .nav-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === targetPageId);
      });

      state.activePage = targetPageId;
      window.scrollTo({ top: 0, behavior: 'instant' });
    }, 250);

    setTimeout(() => {
      if (overlay) overlay.classList.remove('animating');
    }, 500);
  };

  /* =========================================================
     EMPLOYEE AUTHENTICATION & REGISTRATION WORKFLOW
     ========================================================= */
  let isLoggingIn = false;
  window.handleLoginSubmit = async function (e) {
    if (e) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }
    if (isLoggingIn) return;
    isLoggingIn = true;
    setTimeout(() => { isLoggingIn = false; }, 600);

    const input = document.getElementById('mainEmployeeCodeInput');
    if (!input) return;

    const rawCode = input.value;
    const cleanCode = normalizeDigits(rawCode);

    if (!cleanCode || cleanCode.length !== 4) {
      showToast('يرجى إدخال الكود الرباعي المكون من 4 أرقام', 'error');
      input.focus();
      return;
    }

    // Lookup in state and Firebase
    let emp = state.employees.find(e => e.code === cleanCode);
    if (!emp && firebaseDb) {
      try {
        const snap = await firebaseDb.ref('employees/' + cleanCode).once('value');
        if (snap.exists()) emp = { ...snap.val(), code: cleanCode };
      } catch (_) {}
    }

    // Check if pending registration
    let pendingReq = state.registrationRequests.find(r => r.code === cleanCode);
    if (!pendingReq && firebaseDb) {
      try {
        const snapReq = await firebaseDb.ref('registration_requests/' + cleanCode).once('value');
        if (snapReq.exists()) pendingReq = { ...snapReq.val(), code: cleanCode };
      } catch (_) {}
    }

    // CASE 1: Code is Approved in System -> Direct Login!
    if (emp && (emp.status === 'approved' || emp.isApproved === true)) {
      state.user = emp;
      setLocal(STORAGE.USER, emp);
      playSound('success');

      // Hide any pending notice
      const noticeBox = document.getElementById('loginPendingNoticeBox');
      if (noticeBox) noticeBox.style.display = 'none';

      // 0.5s transition
      const overlay = document.getElementById('pageTransitionOverlay');
      if (overlay) {
        overlay.classList.add('animating');
        setTimeout(() => {
          updateViewVisibility();
          overlay.classList.remove('animating');
        }, 500);
      } else {
        updateViewVisibility();
      }
      showToast(`أهلاً بك مجدداً د. ${emp.name} في Accurate Lab`, 'success');
      return;
    }

    // CASE 2: Code is Pending Admin Approval -> Show waiting message!
    if (pendingReq || (emp && (emp.status === 'pending' || (emp.isRegistered && !emp.isApproved)))) {
      const empName = (pendingReq && pendingReq.name) || (emp && emp.name) || '';
      showPendingApprovalNotice(cleanCode, empName);
      playSound('bubble');
      showToast('تم اعتماد الكود وفي انتظار الموافقة عليه من إدارة المعمل ⏳', 'warning', 4500);
      return;
    }

    // CASE 3: New Code -> Open Registration Modal to enter details!
    state.pendingRegistrationCode = cleanCode;
    const regModal = document.getElementById('registerModal');
    const regCodeDisplay = document.getElementById('regCodeDisplay');
    if (regCodeDisplay) regCodeDisplay.textContent = cleanCode;
    if (regModal) regModal.classList.add('active');
    playSound('bubble');
    showToast(`كود جديد [ ${cleanCode} ]! أدخل بياناتك لإرسالها للإدارة للاعتماد`, 'info', 4000);
  };

  function showPendingApprovalNotice(code, name) {
    const box = document.getElementById('loginPendingNoticeBox');
    const textEl = document.getElementById('pendingNoticeText');
    if (box) {
      box.style.display = 'flex';
      if (textEl) {
        if (name) {
          textEl.innerHTML = `مرحباً <strong>د. ${name}</strong>، تم اعتماد كودك [ <strong style="color: var(--primary);">${code}</strong> ] وبياناتك بنجاح! طلبك قيد المراجعة حالياً من إدارة المعمل. سيتم تفعيل دخولك المباشر فور موافقة الإدارة.`;
        } else {
          textEl.innerHTML = `كود الموظف [ <strong style="color: var(--primary);">${code}</strong> ] مسجل بنجاح وهو في انتظار موافقة الإدارة. سيتم تفعيل دخولك فور الاعتماد.`;
        }
      }
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  window.handleRegistrationSubmit = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const nameInput = document.getElementById('regName');
    const areaInput = document.getElementById('regArea');
    const phoneInput = document.getElementById('regPhone');

    const name = nameInput ? nameInput.value.trim() : '';
    const area = areaInput ? areaInput.value.trim() : '';
    const phone = phoneInput ? normalizeDigits(phoneInput.value.trim()) : '';
    const code = state.pendingRegistrationCode;

    if (!name || !area || !phone || !code) {
      showToast('يرجى ملء جميع البيانات لإتمام التسجيل', 'error');
      return;
    }

    const regData = {
      code: code,
      name: name,
      area: area,
      phone: phone,
      isRegistered: true,
      isApproved: false,
      status: 'pending',
      requestedAt: Date.now()
    };

    // Save to Firebase (both in employees and registration_requests)
    if (firebaseDb) {
      try {
        await firebaseDb.ref('employees/' + code).set(regData);
        await firebaseDb.ref('registration_requests/' + code).set(regData);
      } catch (_) {}
    }

    // Update local list
    const idx = state.employees.findIndex(e => e.code === code);
    if (idx !== -1) {
      state.employees[idx] = { ...state.employees[idx], ...regData };
    } else {
      state.employees.unshift(regData);
    }
    setLocal(STORAGE.EMPLOYEES, state.employees);

    state.registrationRequests = state.registrationRequests.filter(r => r.code !== code);
    state.registrationRequests.unshift(regData);
    setLocal(STORAGE.REGISTRATION_REQUESTS, state.registrationRequests);

    // Close registration modal
    const regModal = document.getElementById('registerModal');
    if (regModal) regModal.classList.remove('active');

    // Reset input fields
    if (nameInput) nameInput.value = '';
    if (areaInput) areaInput.value = '';
    if (phoneInput) phoneInput.value = '';
    const loginInput = document.getElementById('mainEmployeeCodeInput');
    if (loginInput) loginInput.value = '';

    playSound('success');
    showPendingApprovalNotice(code, name);
    showToast('تم اعتماد الكود وفي انتظار الموافقة عليه ⏳', 'success', 5000);
    renderAdminViews();
  };

  // Admin approves employee registration
  window.approveEmployeeRegistration = async function (code) {
    const emp = state.employees.find(e => e.code === code) || state.registrationRequests.find(r => r.code === code);
    const name = emp ? emp.name : code;

    const updates = {
      isApproved: true,
      status: 'approved',
      approvedAt: Date.now()
    };

    if (firebaseDb) {
      try {
        await firebaseDb.ref('employees/' + code).update(updates);
        await firebaseDb.ref('registration_requests/' + code).remove();
      } catch (_) {}
    }

    const idx = state.employees.findIndex(e => e.code === code);
    if (idx !== -1) {
      Object.assign(state.employees[idx], updates);
    }
    state.registrationRequests = state.registrationRequests.filter(r => r.code !== code);
    setLocal(STORAGE.EMPLOYEES, state.employees);
    setLocal(STORAGE.REGISTRATION_REQUESTS, state.registrationRequests);

    playSound('success');
    showToast(`تمت الموافقة على الموظف (${name}) وتفعيل الكود (${code}) بنجاح! سيتمكن الآن من تسجيل الدخول مباشرة ✅`, 'success', 4500);
    renderAdminViews();
  };

  // Admin rejects registration request
  window.rejectEmployeeRegistration = async function (code) {
    if (!confirm(`هل ترغب بالتأكيد في رفض طلب الكود (${code})؟`)) return;

    if (firebaseDb) {
      try {
        await firebaseDb.ref('employees/' + code).remove();
        await firebaseDb.ref('registration_requests/' + code).remove();
      } catch (_) {}
    }

    state.employees = state.employees.filter(e => e.code !== code);
    state.registrationRequests = state.registrationRequests.filter(r => r.code !== code);
    setLocal(STORAGE.EMPLOYEES, state.employees);
    setLocal(STORAGE.REGISTRATION_REQUESTS, state.registrationRequests);

    playSound('bubble');
    showToast(`تم رفض طلب الكود (${code}) وحذفه من السيرفر`, 'info');
    renderAdminViews();
  };

  // Admin deletes member completely (حذف عضو)
  window.deleteEmployeeMember = async function (code) {
    const emp = state.employees.find(e => e.code === code);
    const name = emp ? emp.name : code;

    if (!confirm(`هل أنت متأكد من حذف العضو (${name} - كود: ${code}) ومسح الكود الخاص به من السيستم نهائياً؟ لن يتمكن من تسجيل الدخول بعد الآن.`)) {
      return;
    }

    if (firebaseDb) {
      try {
        await firebaseDb.ref('employees/' + code).remove();
        await firebaseDb.ref('registration_requests/' + code).remove();
      } catch (_) {}
    }

    state.employees = state.employees.filter(e => e.code !== code);
    state.registrationRequests = state.registrationRequests.filter(r => r.code !== code);
    setLocal(STORAGE.EMPLOYEES, state.employees);
    setLocal(STORAGE.REGISTRATION_REQUESTS, state.registrationRequests);

    playSound('bubble');
    showToast(`تم حذف العضو (${name}) ومسح الكود الخاص به من السيستم بالكامل 🗑️`, 'success', 3500);
    renderAdminViews();
  };

  window.handleLogout = function () {
    localStorage.removeItem(STORAGE.USER);
    state.user = null;
    const input = document.getElementById('mainEmployeeCodeInput');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 200);
    }
    playSound('bubble');
    updateViewVisibility();
    showToast('تم تسجيل الخروج بنجاح 👋', 'info');
  };

  /* =========================================================
     PAGE 1: ATTENDANCE (تسجيل الحضور والانصراف)
     ========================================================= */
  let isSubmittingAttendance = false;
  window.handleAttendance = async function (type) {
    if (isSubmittingAttendance) return;
    isSubmittingAttendance = true;
    setTimeout(() => { isSubmittingAttendance = false; }, 600);
    if (!state.user) {
      showToast('يرجى تسجيل الدخول أولاً', 'error');
      updateViewVisibility();
      return;
    }

    const label = ATTENDANCE_LABELS[type] || type;
    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const isoDate = now.toISOString().split('T')[0];
    const id = 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    const record = {
      id: id,
      employeeCode: state.user.code,
      employeeName: state.user.name || 'غير معروف',
      employeePhone: state.user.phone || '',
      employeeArea: state.user.area || 'غير محدد',
      actionType: type,
      actionLabel: label,
      date: isoDate,
      dateDisplay: dateStr,
      time: timeStr,
      timestamp: Date.now()
    };

    if (firebaseDb) {
      try {
        await firebaseDb.ref('attendance/' + id).set(record);
      } catch (_) {}
    }

    state.attendance.unshift(record);
    setLocal(STORAGE.ATTENDANCE, state.attendance);

    playSound('checkin');
    showToast(`تم ${label} بنجاح وإرسال التقرير للإدارة فوراً ⚡`, 'success', 4000);
    renderEmployeeAttendance();
    renderAdminViews();
  };

  function renderEmployeeAttendance() {
    if (!state.user) return;
    const todayIso = new Date().toISOString().split('T')[0];
    const myToday = state.attendance.filter(r => r.employeeCode === state.user.code && r.date === todayIso);

    const doneTypes = {};
    myToday.forEach(r => { doneTypes[r.actionType] = r.time; });

    const cards = [
      { id: 'cardMorningIn', st: 'statusMorningIn', btn: 'btnMorningIn', key: 'morning_in' },
      { id: 'cardMorningOut', st: 'statusMorningOut', btn: 'btnMorningOut', key: 'morning_out' },
      { id: 'cardEveningIn', st: 'statusEveningIn', btn: 'btnEveningIn', key: 'evening_in' },
      { id: 'cardEveningOut', st: 'statusEveningOut', btn: 'btnEveningOut', key: 'evening_out' }
    ];

    cards.forEach(c => {
      const cardEl = document.getElementById(c.id);
      const stEl = document.getElementById(c.st);
      const btnEl = document.getElementById(c.btn);
      if (doneTypes[c.key]) {
        if (cardEl) cardEl.classList.add('done');
        if (stEl) {
          stEl.className = 'badge badge-success';
          stEl.textContent = `تم: ${doneTypes[c.key]}`;
        }
        if (btnEl) btnEl.textContent = 'تسجيل مجدداً';
      } else {
        if (cardEl) cardEl.classList.remove('done');
        if (stEl) {
          stEl.className = 'badge';
          stEl.textContent = 'لم يسجل بعد';
        }
        if (btnEl) btnEl.textContent = 'تسجيل الآن';
      }
    });

    const sumBadge = document.getElementById('todaySummaryBadge');
    if (sumBadge) sumBadge.textContent = `${Object.keys(doneTypes).length} من 4 مسجلة اليوم`;

    // History list
    const myHistory = state.attendance.filter(r => r.employeeCode === state.user.code);
    const countEl = document.getElementById('attendanceHistoryCount');
    if (countEl) countEl.textContent = `${myHistory.length} حركة`;

    const histList = document.getElementById('attendanceHistoryList');
    if (histList) {
      if (myHistory.length === 0) {
        histList.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">لم تسجل أي حركات حضور حتى الآن</div>`;
      } else {
        histList.innerHTML = myHistory.slice(0, 15).map(item => `
          <div class="transaction-item">
            <div class="transaction-info">
              <div class="transaction-icon ${item.actionType.includes('in') ? 'reward' : 'deduction'}">
                ${item.actionType.includes('in') ? '☀️' : '🌙'}
              </div>
              <div class="transaction-details">
                <h4>${item.actionLabel}</h4>
                <div class="transaction-meta">${item.dateDisplay || item.date} - ${item.time}</div>
              </div>
            </div>
            <span class="badge ${item.actionType.includes('in') ? 'badge-success' : 'badge-info'}">
              تم الإرسال فوراً للإدارة
            </span>
          </div>
        `).join('');
      }
    }
  }

  /* =========================================================
     PAGE 2: REWARDS & DEDUCTIONS (المكافآت والخصومات)
     ========================================================= */
  function renderEmployeeRewards() {
    if (!state.user) return;
    const myRewards = state.rewards.filter(r => r.employeeCode === state.user.code);

    let totalR = 0, totalD = 0;
    myRewards.forEach(r => {
      const val = parseFloat(r.amount) || 0;
      if (r.type === 'reward') totalR += val;
      else totalD += val;
    });
    const net = totalR - totalD;

    const rEl = document.getElementById('totalRewardsSum');
    const dEl = document.getElementById('totalDeductionsSum');
    const nEl = document.getElementById('netRewardsSum');

    if (rEl) rEl.textContent = `${totalR.toLocaleString('ar-EG')} ج.م`;
    if (dEl) dEl.textContent = `${totalD.toLocaleString('ar-EG')} ج.م`;
    if (nEl) {
      nEl.textContent = `${net.toLocaleString('ar-EG')} ج.م`;
      nEl.className = `summary-amount ${net >= 0 ? 'green' : 'red'}`;
    }

    const listEl = document.getElementById('rewardsListContainer');
    if (listEl) {
      if (myRewards.length === 0) {
        listEl.innerHTML = `<div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">لا توجد مكافآت أو خصومات مسجلة لك حتى الآن</div>`;
      } else {
        listEl.innerHTML = myRewards.map(item => `
          <div class="transaction-item">
            <div class="transaction-info">
              <div class="transaction-icon ${item.type === 'reward' ? 'reward' : 'deduction'}">
                ${item.type === 'reward' ? '🎁' : '🔻'}
              </div>
              <div class="transaction-details">
                <h4 style="color: ${item.type === 'reward' ? 'var(--accent-green-dark)' : 'var(--accent-red-dark)'}">
                  ${item.type === 'reward' ? 'مكافأة تشجيعية' : 'خصم إداري'}
                </h4>
                <div style="font-weight: 600; font-size: 0.88rem; margin: 0.15rem 0;">${item.reason}</div>
                <div class="transaction-meta">${item.dateDisplay || item.date} - ${item.time}</div>
              </div>
            </div>
            <div class="transaction-price" style="color: ${item.type === 'reward' ? 'var(--accent-green)' : 'var(--accent-red)'}">
              ${item.type === 'reward' ? '+' : '-'}${item.amount} ج.م
            </div>
          </div>
        `).join('');
      }
    }
  }

  /* =========================================================
     PAGE 3: SUPPLIES (طلب مستلزمات)
     ========================================================= */
  function renderEmployeeSupplies() {
    // 1. Catalog
    const grid = document.getElementById('suppliesCatalogGrid');
    if (grid) {
      if (state.supplies.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">لا توجد مستلزمات بالكتالوج حالياً</div>`;
      } else {
        grid.innerHTML = state.supplies.map(item => `
          <div class="supply-card">
            <div class="supply-img-wrapper">
              ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}" class="supply-img">` : `
                <svg class="supply-placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                </svg>
              `}
            </div>
            <div class="supply-content">
              <div>
                <div class="supply-title">${item.name}</div>
                <div class="supply-unit-badge">${item.unit || item.category || 'مستلزم معمل'}</div>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.quickOrderSupply('${item.name.replace(/'/g, "\\'")}')">
                + طلب هذا المستلزم
              </button>
            </div>
          </div>
        `).join('');
      }
    }

    // 2. My past orders
    if (!state.user) return;
    const myOrders = state.supplyOrders.filter(r => r.employeeCode === state.user.code);
    const myOrdersList = document.getElementById('mySupplyOrdersList');
    if (myOrdersList) {
      if (myOrders.length === 0) {
        myOrdersList.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">لم تقم بإرسال أي طلبات مستلزمات حتى الآن</div>`;
      } else {
        myOrdersList.innerHTML = myOrders.map(order => `
          <div class="transaction-item">
            <div class="transaction-info">
              <div class="transaction-icon reward">📦</div>
              <div class="transaction-details">
                <h4>${order.supplyName}</h4>
                <div style="font-size: 0.85rem; font-weight: 600;">الكمية: ${order.quantity}</div>
                ${order.notes ? `<div style="font-size: 0.78rem; color: var(--text-secondary);">${order.notes}</div>` : ''}
                <div class="transaction-meta">${order.dateDisplay || order.date} - ${order.time}</div>
              </div>
            </div>
            <div>
              <span class="badge ${order.status === 'completed' ? 'badge-success' : 'badge-amber'}">
                ${order.status === 'completed' ? 'تم الصرف ✅' : 'قيد التجهيز'}
              </span>
            </div>
          </div>
        `).join('');
      }
    }
  }

  window.quickOrderSupply = function (name) {
    const input = document.getElementById('supplySelect');
    const qty = document.getElementById('supplyQuantity');
    if (input) input.value = name;
    if (qty) qty.focus();
    playSound('bubble');
    showToast(`تم اختيار [ ${name} ]. حدد الكمية واضغط إرسال`, 'info', 2500);
  };

  window.handleSupplyOrderSubmit = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!state.user) {
      showToast('يرجى تسجيل الدخول أولاً', 'error');
      return;
    }

    const nameInput = document.getElementById('supplySelect');
    const qtyInput = document.getElementById('supplyQuantity');
    const notesInput = document.getElementById('supplyNotes');

    const supplyName = nameInput ? nameInput.value.trim() : '';
    const quantity = qtyInput ? qtyInput.value.trim() : '';
    const notes = notesInput ? notesInput.value.trim() : '';

    if (!supplyName || !quantity) {
      showToast('يرجى تحديد المستلزم والكمية المطلوبة', 'error');
      return;
    }

    const now = new Date();
    const id = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const order = {
      id: id,
      employeeCode: state.user.code,
      employeeName: state.user.name,
      employeePhone: state.user.phone,
      employeeArea: state.user.area,
      supplyName: supplyName,
      quantity: quantity,
      notes: notes,
      status: 'pending',
      date: now.toISOString().split('T')[0],
      dateDisplay: now.toLocaleDateString('ar-EG'),
      time: now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      createdAt: Date.now()
    };

    if (firebaseDb) {
      try {
        await firebaseDb.ref('supply_requests/' + id).set(order);
      } catch (_) {}
    }

    state.supplyOrders.unshift(order);
    setLocal(STORAGE.SUPPLY_ORDERS, state.supplyOrders);

    if (nameInput) nameInput.value = '';
    if (qtyInput) qtyInput.value = '';
    if (notesInput) notesInput.value = '';

    playSound('success');
    showToast('تم إرسال طلب المستلزمات للإدارة بنجاح مع كافة بياناتك 📦', 'success');
    renderEmployeeSupplies();
    renderAdminViews();
  };

  /* =========================================================
     PAGE 4: LEAVE REQUEST (طلب إجازة)
     ========================================================= */
  function renderEmployeeLeaves() {
    if (!state.user) return;
    const myLeaves = state.leaves.filter(r => r.employeeCode === state.user.code);
    const listEl = document.getElementById('myLeaveRequestsList');
    if (listEl) {
      if (myLeaves.length === 0) {
        listEl.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">لا توجد طلبات إجازة مسجلة لك حتى الآن</div>`;
      } else {
        listEl.innerHTML = myLeaves.map(leave => {
          let statusBadge = '<span class="badge badge-amber">⏳ قيد المراجعة</span>';
          if (leave.status === 'approved') statusBadge = '<span class="badge badge-success">✅ تمت الموافقة</span>';
          if (leave.status === 'rejected') statusBadge = '<span class="badge badge-danger">❌ تم الرفض</span>';

          return `
            <div class="transaction-item" style="flex-direction: column; align-items: stretch; gap: 0.5rem;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="font-weight: 700; font-size: 1rem;">إجازة ${leave.leaveType || 'اعتيادية'} (${leave.daysCount} أيام)</div>
                ${statusBadge}
              </div>
              <div style="font-size: 0.85rem; color: var(--text-secondary);">
                <strong>تاريخ البدء:</strong> ${leave.startDate} | <strong>السبب:</strong> ${leave.reason}
              </div>
              ${leave.attachmentUrl ? `
                <div>
                  <a href="${leave.attachmentUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 0.78rem; font-weight: 700; color: var(--primary);">
                    📎 عرض المرفق الطبي المرفوع على Cloudinary
                  </a>
                </div>
              ` : ''}
              ${leave.adminNotes ? `
                <div style="background: var(--bg-surface); padding: 0.4rem 0.6rem; border-radius: var(--radius-sm); font-size: 0.78rem; border-right: 3px solid var(--primary);">
                  <strong>رد الإدارة:</strong> ${leave.adminNotes}
                </div>
              ` : ''}
              <div class="transaction-meta" style="align-self: flex-end;">${leave.dateDisplay || leave.date} - ${leave.time}</div>
            </div>
          `;
        }).join('');
      }
    }
  }

  window.handleLeaveSubmit = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!state.user) {
      showToast('يرجى تسجيل الدخول أولاً', 'error');
      return;
    }

    const daysInput = document.getElementById('leaveDaysCount');
    const startInput = document.getElementById('leaveStartDate');
    const typeInput = document.getElementById('leaveType');
    const reasonInput = document.getElementById('leaveReason');

    const days = daysInput ? daysInput.value : '1';
    const startDate = startInput ? startInput.value : '';
    const leaveType = typeInput ? typeInput.value : 'اعتيادية';
    const reason = reasonInput ? reasonInput.value.trim() : '';

    if (!days || !startDate || !reason) {
      showToast('يرجى تعبئة كافة الحقول المطلوبة', 'error');
      return;
    }

    const now = new Date();
    const id = 'leave_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const leave = {
      id: id,
      employeeCode: state.user.code,
      employeeName: state.user.name,
      employeePhone: state.user.phone,
      employeeArea: state.user.area,
      daysCount: parseInt(days, 10),
      startDate: startDate,
      leaveType: leaveType,
      reason: reason,
      attachmentUrl: state.uploadedLeaveFile ? state.uploadedLeaveFile.secure_url : '',
      status: 'pending',
      adminNotes: '',
      date: now.toISOString().split('T')[0],
      dateDisplay: now.toLocaleDateString('ar-EG'),
      time: now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      createdAt: Date.now()
    };

    if (firebaseDb) {
      try {
        await firebaseDb.ref('leave_requests/' + id).set(leave);
      } catch (_) {}
    }

    state.leaves.unshift(leave);
    setLocal(STORAGE.LEAVES, state.leaves);

    if (reasonInput) reasonInput.value = '';
    state.uploadedLeaveFile = null;
    const preview = document.getElementById('leaveUploadPreview');
    if (preview) preview.style.display = 'none';

    playSound('success');
    showToast('تم إرسال طلب الإجازة للإدارة بنجاح! سيتم إعلامك بالرد فوراً 🏖️', 'success');
    renderEmployeeLeaves();
    renderAdminViews();
  };

  /* =========================================================
     ADMIN CONTROL CENTER (PIN: 4k4k)
     ========================================================= */
  window.openAdminPinModal = function (e) {
    if (e && e.stopPropagation) e.stopPropagation();
    playSound('bubble');
    const isAuth = sessionStorage.getItem(STORAGE.ADMIN) === 'true';
    if (isAuth) {
      const dash = document.getElementById('adminDashboardModal');
      if (dash) dash.classList.add('active');
      renderAdminViews();
    } else {
      const pinModal = document.getElementById('adminPinModal');
      const pinInput = document.getElementById('adminPinInput');
      if (pinModal) pinModal.classList.add('active');
      if (pinInput) {
        pinInput.value = '';
        setTimeout(() => pinInput.focus(), 150);
      }
    }
  }

  window.closeAdminPinModal = function () {
    const pinModal = document.getElementById('adminPinModal');
    if (pinModal) pinModal.classList.remove('active');
  };

  window.handleAdminPinSubmit = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const pinInput = document.getElementById('adminPinInput');
    const rawPin = pinInput ? pinInput.value.trim() : '';
    const cleanPin = normalizeDigits(rawPin).toLowerCase();

    if (cleanPin === CONFIG.ADMIN_PIN.toLowerCase()) {
      sessionStorage.setItem(STORAGE.ADMIN, 'true');
      window.closeAdminPinModal();
      const dash = document.getElementById('adminDashboardModal');
      if (dash) dash.classList.add('active');
      playSound('success');
      showToast('تم تسجيل الدخول كمسؤول لنظام Accurate Lab 🔐', 'success');
      renderAdminViews();
    } else {
      showToast('الرقم السري غير صحيح!', 'error');
    }
  };

  window.closeAdminDashboard = function () {
    const dash = document.getElementById('adminDashboardModal');
    if (dash) dash.classList.remove('active');
  };

  // Switch Admin Tabs
  
  // Smooth scroll to Daily Photo Reports (صورة التوريد وصورة اليوميات)
  window.scrollToDailyReports = function () {
    playSound('bubble');
    const doScroll = () => {
      const el = document.getElementById('dailyReportsCard') || document.querySelector('.daily-reports-card');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
        el.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.4)';
        setTimeout(() => { el.style.boxShadow = ''; }, 1200);
      }
    };

    if (state.activePage !== 'attendance') {
      window.navigateToPage('attendance');
      setTimeout(doScroll, 250);
    } else {
      doScroll();
    }

    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === 'reports');
    });
  };

  // Upgraded Switch Admin Tabs (Never traps user, always scrolls to top of pane)
  window.switchAdminTab = function (paneKey) {
    playSound('bubble');
    
    // 1. Activate tab buttons and keep active tab visible in tab strip
    document.querySelectorAll('.admin-tab-btn').forEach(b => {
      const isActive = (b.dataset.pane === paneKey);
      b.classList.toggle('active', isActive);
      if (isActive) {
        try {
          b.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } catch (e) {}
      }
    });

    // 2. Activate pane
    const allPanes = ['adminCodes', 'adminRewards', 'adminAttendance', 'adminLeaves', 'adminSupplies', 'adminDailyUploads'];
    allPanes.forEach(k => {
      const pane = document.getElementById('pane' + k.charAt(0).toUpperCase() + k.slice(1));
      if (pane) {
        pane.classList.toggle('active', k === paneKey);
      }
    });

    // 3. Scroll modal-body to top so tab bar and headers are never pushed away
    const modalBody = document.querySelector('#adminDashboardModal .modal-body');
    if (modalBody) {
      modalBody.scrollTop = 0;
    }
  };

  // 1. Generate 4-digit code
  window.handleGenerateCode = async function () {
    const btn = document.getElementById('btnGenerateCode');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'جاري التوليد...';
    }

    let code = '';
    let attempts = 0;
    do {
      code = Math.floor(1000 + Math.random() * 9000).toString();
      attempts++;
    } while (state.employees.some(e => e.code === code) && attempts < 100);

    const newEmp = {
      code: code,
      isRegistered: false,
      name: '',
      phone: '',
      area: '',
      createdAt: Date.now()
    };

    // Immediate UI feedback
    const displayBox = document.getElementById('generatedCodeDisplay');
    const valEl = document.getElementById('generatedCodeValue');
    if (displayBox) {
      displayBox.style.display = 'block';
      displayBox.dataset.code = code;
    }
    if (valEl) valEl.textContent = `الكود الجديد: ${code}`;

    state.employees.unshift(newEmp);
    setLocal(STORAGE.EMPLOYEES, state.employees);

    playSound('success');
    showToast(`تم توليد الكود الرباعي [ ${code} ] وإضافته للسيرفر فوراً ⚡`, 'success', 4000);
    renderAdminViews();

    if (firebaseDb) {
      try {
        await firebaseDb.ref('employees/' + code).set(newEmp);
      } catch (_) {}
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = '⚡ توليد كود موظف جديد';
    }
  };

  window.copyGeneratedCode = function () {
    const box = document.getElementById('generatedCodeDisplay');
    const code = box ? box.dataset.code : '';
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        playSound('bubble');
        showToast(`تم نسخ الكود الرباعي [ ${code} ] بنجاح 📋`, 'success');
      }).catch(() => {
        showToast(`كود الموظف: ${code}`, 'info');
      });
    }
  };

  window.shareGeneratedCodeWhatsApp = function () {
    const box = document.getElementById('generatedCodeDisplay');
    const code = box ? box.dataset.code : '';
    if (code) {
      const msg = encodeURIComponent(`مرحباً بك في معمل أكيوريت للتحاليل الطبية (Accurate Lab).\nكود الدخول الخاص بك للبوابة الإلكترونية هو: ${code}\nيرجى استخدامه لتسجيل الحضور وطلب المستلزمات والإجازات.`);
      window.open(`https://wa.me/?text=${msg}`, '_blank');
    }
  };

  window.deleteEmployeeCode = async function (code) {
    if (confirm(`هل أنت متأكد من حذف كود الموظف [ ${code} ]؟`)) {
      if (firebaseDb) {
        try {
          await firebaseDb.ref('employees/' + code).remove();
        } catch (_) {}
      }
      state.employees = state.employees.filter(e => e.code !== code);
      setLocal(STORAGE.EMPLOYEES, state.employees);
      showToast(`تم حذف كود الموظف [ ${code} ]`, 'info');
      renderAdminViews();
    }
  };

  // 2. Admin Send Reward or Deduction
  window.handleAdminRewardSubmit = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const empSelect = document.getElementById('rewardEmployeeSelect');
    const typeSelect = document.getElementById('rewardType');
    const amountInput = document.getElementById('rewardAmount');
    const reasonInput = document.getElementById('rewardReason');

    const code = empSelect ? empSelect.value : '';
    const type = typeSelect ? typeSelect.value : 'reward';
    const amount = amountInput ? parseFloat(amountInput.value) : 0;
    const reason = reasonInput ? reasonInput.value.trim() : '';

    if (!code || !amount || !reason) {
      showToast('يرجى تحديد الموظف والمبلغ والسبب', 'error');
      return;
    }

    const emp = state.employees.find(e => e.code === code);
    const now = new Date();
    const id = 'rew_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    const record = {
      id: id,
      employeeCode: code,
      employeeName: emp ? emp.name : '',
      employeeArea: emp ? emp.area : '',
      type: type,
      amount: amount,
      reason: reason,
      date: now.toISOString().split('T')[0],
      dateDisplay: now.toLocaleDateString('ar-EG'),
      time: now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    };

    if (firebaseDb) {
      try {
        await firebaseDb.ref('rewards/' + id).set(record);
      } catch (_) {}
    }

    state.rewards.unshift(record);
    setLocal(STORAGE.REWARDS, state.rewards);

    if (amountInput) amountInput.value = '';
    if (reasonInput) reasonInput.value = '';

    playSound('success');
    showToast('تم إرسال المكافأة/الخصم للموظف بنجاح 💰', 'success');
    renderEmployeeRewards();
    renderAdminViews();
  };

  window.deleteRewardRecord = async function (id) {
    if (confirm('هل أنت متأكد من حذف هذا السجل؟')) {
      if (firebaseDb) {
        try {
          await firebaseDb.ref('rewards/' + id).remove();
        } catch (_) {}
      }
      state.rewards = state.rewards.filter(r => r.id !== id);
      setLocal(STORAGE.REWARDS, state.rewards);
      showToast('تم حذف السجل بنجاح', 'info');
      renderEmployeeRewards();
      renderAdminViews();
    }
  };

  // 3. Admin Live Attendance Delete
  window.deleteAttendanceRecord = async function (id) {
    if (confirm('هل أنت متأكد من حذف حركة الحضور هذه؟')) {
      if (firebaseDb) {
        try {
          await firebaseDb.ref('attendance/' + id).remove();
        } catch (_) {}
      }
      state.attendance = state.attendance.filter(r => r.id !== id);
      setLocal(STORAGE.ATTENDANCE, state.attendance);
      showToast('تم حذف سجل الحركة', 'info');
      renderEmployeeAttendance();
      renderAdminViews();
    }
  };

  // 4. Admin Leaves Actions
  window.approveLeaveRequest = async function (id) {
    const updates = { status: 'approved', adminNotes: 'تمت الموافقة من إدارة المعمل', reviewedAt: Date.now() };
    if (firebaseDb) {
      try {
        await firebaseDb.ref('leave_requests/' + id).update(updates);
      } catch (_) {}
    }
    const item = state.leaves.find(r => r.id === id);
    if (item) Object.assign(item, updates);
    setLocal(STORAGE.LEAVES, state.leaves);
    playSound('success');
    showToast('تمت الموافقة على طلب الإجازة وإعلام الموظف ✅', 'success');
    renderEmployeeLeaves();
    renderAdminViews();
  };

  window.rejectLeaveRequest = async function (id) {
    const note = prompt('أدخل سبب الرفض إن وجد:') || 'تم الرفض لظروف العمل بالمعمل';
    const updates = { status: 'rejected', adminNotes: note, reviewedAt: Date.now() };
    if (firebaseDb) {
      try {
        await firebaseDb.ref('leave_requests/' + id).update(updates);
      } catch (_) {}
    }
    const item = state.leaves.find(r => r.id === id);
    if (item) Object.assign(item, updates);
    setLocal(STORAGE.LEAVES, state.leaves);
    showToast('تم تسجيل رفض طلب الإجازة وإعلام الموظف ❌', 'info');
    renderEmployeeLeaves();
    renderAdminViews();
  };

  window.deleteLeaveRequest = async function (id) {
    if (confirm('هل أنت متأكد من حذف هذا الطلب؟')) {
      if (firebaseDb) {
        try {
          await firebaseDb.ref('leave_requests/' + id).remove();
        } catch (_) {}
      }
      state.leaves = state.leaves.filter(r => r.id !== id);
      setLocal(STORAGE.LEAVES, state.leaves);
      showToast('تم حذف طلب الإجازة بنجاح', 'info');
      renderEmployeeLeaves();
      renderAdminViews();
    }
  };

  // 5. Admin Add Supply with Cloudinary
  window.handleAdminAddSupplySubmit = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const nameInput = document.getElementById('newSupplyName');
    const catInput = document.getElementById('newSupplyCategory');
    const notesInput = document.getElementById('newSupplyNotes');

    const name = nameInput ? nameInput.value.trim() : '';
    const category = catInput ? catInput.value.trim() : 'عام';
    const notes = notesInput ? notesInput.value.trim() : '';

    if (!name) {
      showToast('اسم المستلزم مطلوب', 'error');
      return;
    }

    const id = 'sup_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const item = {
      id: id,
      name: name,
      category: category,
      unit: category,
      imageUrl: state.uploadedSupplyFile ? state.uploadedSupplyFile.secure_url : '',
      notes: notes,
      createdAt: Date.now()
    };

    if (firebaseDb) {
      try {
        await firebaseDb.ref('supplies/' + id).set(item);
      } catch (_) {}
    }

    state.supplies.unshift(item);
    setLocal(STORAGE.SUPPLIES, state.supplies);

    if (nameInput) nameInput.value = '';
    if (catInput) catInput.value = '';
    if (notesInput) notesInput.value = '';
    state.uploadedSupplyFile = null;
    const preview = document.getElementById('supplyUploadPreview');
    if (preview) preview.style.display = 'none';

    playSound('success');
    showToast(`تمت إضافة [ ${name} ] لكتالوج المعمل لجميع الموظفين بنجاح 📦`, 'success');
    renderEmployeeSupplies();
    renderAdminViews();
  };

  window.deleteSupplyCatalogItem = async function (id) {
    if (confirm('هل تريد حذف هذا المستلزم من الكتالوج العام؟')) {
      if (firebaseDb) {
        try {
          await firebaseDb.ref('supplies/' + id).remove();
        } catch (_) {}
      }
      state.supplies = state.supplies.filter(r => r.id !== id);
      setLocal(STORAGE.SUPPLIES, state.supplies);
      showToast('تم حذف المستلزم من الكتالوج', 'info');
      renderEmployeeSupplies();
      renderAdminViews();
    }
  };

  window.completeSupplyOrder = async function (id) {
    if (firebaseDb) {
      try {
        await firebaseDb.ref('supply_requests/' + id).update({ status: 'completed' });
      } catch (_) {}
    }
    const item = state.supplyOrders.find(r => r.id === id);
    if (item) item.status = 'completed';
    setLocal(STORAGE.SUPPLY_ORDERS, state.supplyOrders);
    playSound('success');
    showToast('تم تأكيد صرف المستلزم للموظف بنجاح ✅', 'success');
    renderEmployeeSupplies();
    renderAdminViews();
  };

  window.deleteSupplyOrder = async function (id) {
    if (confirm('هل أنت متأكد من حذف هذا الطلب؟')) {
      if (firebaseDb) {
        try {
          await firebaseDb.ref('supply_requests/' + id).remove();
        } catch (_) {}
      }
      state.supplyOrders = state.supplyOrders.filter(r => r.id !== id);
      setLocal(STORAGE.SUPPLY_ORDERS, state.supplyOrders);
      showToast('تم حذف طلب المستلزم بنجاح', 'info');
      renderEmployeeSupplies();
      renderAdminViews();
    }
  };

  /* =========================================================
     EXCEL EXPORT (CSV with UTF-8 BOM)
     ========================================================= */
  function downloadCSV(csvContent, filename) {
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  window.exportAttendanceCSV = function () {
    if (!state.attendance.length) {
      showToast('لا توجد سجلات حضور للتصدير', 'error');
      return;
    }
    const headers = ['اسم الموظف', 'الكود الرباعي', 'المنطقة / الفرع', 'الهاتف', 'نوع الحركة', 'التاريخ', 'الساعة'];
    const rows = state.attendance.map(r => [
      `"${r.employeeName || ''}"`,
      `"${r.employeeCode || ''}"`,
      `"${r.employeeArea || ''}"`,
      `"${r.employeePhone || ''}"`,
      `"${r.actionLabel || ''}"`,
      `"${r.date || ''}"`,
      `"${r.time || ''}"`
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const today = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `سجل_حضور_وانصراف_أكيوريت_${today}.csv`);
    playSound('success');
    showToast('تم تصدير سجل الحضور والانصراف إلى ملف Excel بنجاح 📊', 'success');
  };

  window.exportRewardsCSV = function () {
    if (!state.rewards.length) {
      showToast('لا توجد سجلات مكافآت للتصدير', 'error');
      return;
    }
    const headers = ['اسم الموظف', 'الكود', 'النوع', 'المبلغ (ج.م)', 'السبب', 'التاريخ', 'الساعة'];
    const rows = state.rewards.map(r => [
      `"${r.employeeName || ''}"`,
      `"${r.employeeCode || ''}"`,
      `"${r.type === 'reward' ? 'مكافأة' : 'خصم'}"`,
      r.amount || 0,
      `"${r.reason || ''}"`,
      `"${r.date || ''}"`,
      `"${r.time || ''}"`
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const today = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `سجل_المكافآت_والخصومات_أكيوريت_${today}.csv`);
    playSound('success');
    showToast('تم تصدير سجل المكافآت والخصومات إلى Excel بنجاح 📊', 'success');
  };

  window.exportLeavesCSV = function () {
    if (!state.leaves.length) {
      showToast('لا توجد طلبات إجازة للتصدير', 'error');
      return;
    }
    const headers = ['اسم الموظف', 'الكود', 'المنطقة', 'الهاتف', 'نوع الإجازة', 'عدد الأيام', 'تاريخ البدء', 'الحالة', 'السبب', 'التاريخ'];
    const rows = state.leaves.map(r => {
      let st = r.status === 'approved' ? 'مقبولة' : r.status === 'rejected' ? 'مرفوضة' : 'قيد المراجعة';
      return [
        `"${r.employeeName || ''}"`,
        `"${r.employeeCode || ''}"`,
        `"${r.employeeArea || ''}"`,
        `"${r.employeePhone || ''}"`,
        `"${r.leaveType || ''}"`,
        r.daysCount || 0,
        `"${r.startDate || ''}"`,
        `"${st}"`,
        `"${r.reason || ''}"`,
        `"${r.date || ''}"`
      ];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const today = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `سجل_طلبات_الإجازات_أكيوريت_${today}.csv`);
    playSound('success');
    showToast('تم تصدير سجل الإجازات إلى Excel بنجاح 📊', 'success');
  };

  window.printAttendance = function () {
    window.print();
  };

  
  /* =========================================================
     DAILY PHOTO REPORTS (صورة التوريد وصورة اليوميات)
     ========================================================= */
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('فشل قراءة الملف'));
      reader.readAsDataURL(file);
    });
  }

  // Handle local file selection from device (Camera or Gallery)
  window.handleReportFileSelect = function (e, type) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!state.selectedReportFiles) state.selectedReportFiles = {};
    state.selectedReportFiles[type] = file;

    const isSupply = type === 'supply_receipt';
    const placeholder = document.getElementById(isSupply ? 'supplyReceiptPlaceholder' : 'dailyJournalPlaceholder');
    const previewWrap = document.getElementById(isSupply ? 'supplyReceiptPreviewWrap' : 'dailyJournalPreviewWrap');
    const previewImg = document.getElementById(isSupply ? 'supplyReceiptPreviewImg' : 'dailyJournalPreviewImg');
    const submitBtn = document.getElementById(isSupply ? 'btnUploadSupplyReceipt' : 'btnUploadDailyJournal');

    if (previewImg) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        previewImg.src = ev.target.result;
        if (placeholder) placeholder.style.display = 'none';
        if (previewWrap) previewWrap.style.display = 'block';
        if (submitBtn) submitBtn.disabled = false;
      };
      reader.readAsDataURL(file);
    }
  };

  // Cancel selected report preview
  window.cancelReportSelection = function (e, type) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!state.selectedReportFiles) state.selectedReportFiles = {};
    state.selectedReportFiles[type] = null;

    const isSupply = type === 'supply_receipt';
    const input = document.getElementById(isSupply ? 'supplyReceiptInput' : 'dailyJournalInput');
    const placeholder = document.getElementById(isSupply ? 'supplyReceiptPlaceholder' : 'dailyJournalPlaceholder');
    const previewWrap = document.getElementById(isSupply ? 'supplyReceiptPreviewWrap' : 'dailyJournalPreviewWrap');
    const submitBtn = document.getElementById(isSupply ? 'btnUploadSupplyReceipt' : 'btnUploadDailyJournal');

    if (input) input.value = '';
    if (placeholder) placeholder.style.display = 'flex';
    if (previewWrap) previewWrap.style.display = 'none';
    if (submitBtn) submitBtn.disabled = true;
  };

  // Submit report to Cloudinary + Firebase
  window.submitDailyReport = async function (type) {
    if (!state.user) {
      showToast('يرجى تسجيل الدخول أولاً', 'error');
      return;
    }

    const file = state.selectedReportFiles && state.selectedReportFiles[type];
    if (!file) {
      showToast('يرجى اختيار أو التقاط الصورة أولاً من جهازك', 'error');
      return;
    }

    const isSupply = type === 'supply_receipt';
    const progressBox = document.getElementById(isSupply ? 'supplyReceiptProgress' : 'dailyJournalProgress');
    const progressBar = document.getElementById(isSupply ? 'supplyReceiptProgressBar' : 'dailyJournalProgressBar');
    const progressText = document.getElementById(isSupply ? 'supplyReceiptProgressText' : 'dailyJournalProgressText');
    const submitBtn = document.getElementById(isSupply ? 'btnUploadSupplyReceipt' : 'btnUploadDailyJournal');

    if (progressBox) progressBox.style.display = 'block';
    if (progressBar) progressBar.style.width = '15%';
    if (progressText) progressText.textContent = 'جاري المعالجة والرفع... (15%)';
    if (submitBtn) submitBtn.disabled = true;

    try {
      let imageUrl = '';
      try {
        const cldRes = await uploadToCloudinary(file, (pct) => {
          if (progressBar) progressBar.style.width = pct + '%';
          if (progressText) progressText.textContent = `جاري الرفع... (${pct}%)`;
        });
        imageUrl = cldRes.secure_url;
      } catch (cldErr) {
        // Fallback: Use DataURL so local testing or offline never fails!
        imageUrl = await fileToDataUrl(file);
      }

      const now = new Date();
      const reportId = 'rep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const record = {
        id: reportId,
        type: type,
        typeLabel: isSupply ? 'صورة توريد' : 'صورة يوميات',
        employeeCode: state.user.code,
        employeeName: state.user.name || ('كود ' + state.user.code),
        employeeArea: state.user.area || 'معمل أكيوريت',
        employeePhone: state.user.phone || '',
        imageUrl: imageUrl,
        date: now.toISOString().split('T')[0],
        dateDisplay: now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        time: now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true }),
        timestamp: Date.now()
      };

      // Save to Firebase
      if (firebaseDb) {
        try {
          await firebaseDb.ref('daily_uploads/' + reportId).set(record);
        } catch (_) {}
      }

      // Add to local state
      state.dailyUploads.unshift(record);
      setLocal(STORAGE.DAILY_UPLOADS, state.dailyUploads);

      // Clean up UI
      if (progressBox) progressBox.style.display = 'none';
      window.cancelReportSelection(null, type);

      playSound('success');
      showToast('تم الرفع بنجاح ✅', 'success', 3500);

      renderEmployeeDailyUploads();
      renderAdminDailyUploads();
    } catch (err) {
      if (progressBox) progressBox.style.display = 'none';
      if (submitBtn) submitBtn.disabled = false;
      showToast('حدث خطأ أثناء رفع الصورة: ' + (err.message || 'يرجى المحاولة مجدداً'), 'error');
    }
  };

  // Download report photo directly to device hard drive or phone storage
  window.downloadReportImage = async function (url, filename) {
    try {
      showToast('جاري بدء تحميل الصورة على جهازك... 📥', 'info', 2000);

      if (url.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'accurate_lab_photo.jpg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        playSound('success');
        showToast('تم حفظ الصورة على جهازك بنجاح ✅', 'success', 2500);
        return;
      }

      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename || 'accurate_lab_photo.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      playSound('success');
      showToast('تم حفظ الصورة على جهازك بنجاح ✅', 'success', 2500);
    } catch (err) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'accurate_lab_photo.jpg';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Delete uploaded report from admin
  window.deleteDailyUpload = async function (id) {
    if (!confirm('هل ترغب بالتأكيد في حذف هذا التقرير المصور من السيرفر؟')) return;

    if (firebaseDb) {
      try {
        await firebaseDb.ref('daily_uploads/' + id).remove();
      } catch (_) {}
    }

    state.dailyUploads = state.dailyUploads.filter(r => r.id !== id);
    setLocal(STORAGE.DAILY_UPLOADS, state.dailyUploads);

    playSound('bubble');
    showToast('تم حذف التقرير المصور من السيرفر 🗑️', 'info');
    renderEmployeeDailyUploads();
    renderAdminDailyUploads();
  };

  // Lightbox Modal for Full Screen Image Viewing
  window.openImageLightbox = function (url, title) {
    let box = document.getElementById('imageLightboxModal');
    if (!box) {
      box = document.createElement('div');
      box.id = 'imageLightboxModal';
      box.className = 'modal-overlay';
      box.style.zIndex = '200000';
      box.innerHTML = `
        <div class="modal-dialog" style="max-width: 90vw; max-height: 90vh; background: transparent; border: none; box-shadow: none;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 1rem; background: rgba(15, 23, 42, 0.85); border-radius: 14px 14px 0 0; color: #fff; backdrop-filter: blur(8px);">
            <span id="lightboxTitle" style="font-weight: 700; font-size: 0.95rem;">معاينة الصورة</span>
            <button type="button" class="btn-icon" style="color: #fff; width: 32px; height: 32px; font-size: 1.25rem;" onclick="document.getElementById('imageLightboxModal').classList.remove('active')">&times;</button>
          </div>
          <div style="background: #000; text-align: center; max-height: 75vh; overflow: auto; border-radius: 0 0 14px 14px; padding: 0.5rem;">
            <img id="lightboxImg" src="" style="max-width: 100%; max-height: 72vh; object-fit: contain; border-radius: 8px;">
          </div>
        </div>
      `;
      document.body.appendChild(box);
      box.addEventListener('click', (e) => {
        if (e.target === box) box.classList.remove('active');
      });
    }
    const titleEl = document.getElementById('lightboxTitle');
    const imgEl = document.getElementById('lightboxImg');
    if (titleEl) titleEl.textContent = title || 'معاينة الصورة';
    if (imgEl) imgEl.src = url;
    box.classList.add('active');
  };

  function renderEmployeeDailyUploads() {
    if (!state.user) return;
    const todayIso = new Date().toISOString().split('T')[0];
    const myToday = state.dailyUploads.filter(r => r.employeeCode === state.user.code && r.date === todayIso);

    const countBadge = document.getElementById('todayUploadsCountBadge');
    if (countBadge) countBadge.textContent = `${myToday.length} تقارير اليوم`;

    const listContainer = document.getElementById('employeeTodayUploadsList');
    if (!listContainer) return;

    if (myToday.length === 0) {
      listContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 0.5rem 0;">لم تقم برفع أي تقارير مصورة اليوم بعد</div>`;
      return;
    }

    listContainer.innerHTML = myToday.map(r => `
      <div class="today-upload-pill">
        <img src="${r.imageUrl}" alt="${r.typeLabel}" class="today-upload-thumb" onclick="window.openImageLightbox('${r.imageUrl}', '${r.typeLabel}')">
        <div class="today-upload-info">
          <strong>${r.typeLabel}</strong>
          <span class="upload-time">${r.time}</span>
        </div>
        <span class="badge badge-success" style="font-size: 0.72rem;">تم الإرسال للإدارة ✅</span>
      </div>
    `).join('');
  }

  function renderAdminDailyUploads() {
    const listContainer = document.getElementById('adminDailyUploadsList');
    const badgeEl = document.getElementById('adminDailyUploadsBadge');
    const countEl = document.getElementById('adminDailyUploadsCount');

    if (badgeEl) {
      badgeEl.textContent = state.dailyUploads.length;
      badgeEl.style.display = state.dailyUploads.length ? 'inline-block' : 'none';
    }
    if (countEl) countEl.textContent = `${state.dailyUploads.length} صورة مرفوعة`;

    if (!listContainer) return;

    const typeFilter = document.getElementById('adminFilterUploadType') ? document.getElementById('adminFilterUploadType').value : 'all';
    const dateFilter = document.getElementById('adminFilterUploadDate') ? document.getElementById('adminFilterUploadDate').value : '';
    const searchFilter = document.getElementById('adminFilterUploadSearch') ? document.getElementById('adminFilterUploadSearch').value.trim().toLowerCase() : '';

    let list = state.dailyUploads;
    if (typeFilter && typeFilter !== 'all') {
      list = list.filter(r => r.type === typeFilter);
    }
    if (dateFilter) {
      list = list.filter(r => r.date === dateFilter);
    }
    if (searchFilter) {
      list = list.filter(r =>
        (r.employeeName && r.employeeName.toLowerCase().includes(searchFilter)) ||
        (r.employeeCode && r.employeeCode.includes(searchFilter)) ||
        (r.employeeArea && r.employeeArea.toLowerCase().includes(searchFilter))
      );
    }

    if (list.length === 0) {
      listContainer.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">لا توجد صور توريد أو يوميات مطابقة للبحث حالياً</div>`;
      return;
    }

    listContainer.innerHTML = list.map(item => `
      <div class="admin-photo-card">
        <div class="photo-card-img-wrap" onclick="window.openImageLightbox('${item.imageUrl}', '${item.typeLabel} - د. ${item.employeeName}')">
          <img src="${item.imageUrl}" alt="${item.typeLabel}" loading="lazy">
          <span class="photo-type-badge ${item.type === 'supply_receipt' ? 'badge-blue' : 'badge-purple'}">
            ${item.type === 'supply_receipt' ? '📦 صورة توريد' : '📑 صورة يوميات'}
          </span>
        </div>
        <div class="photo-card-body">
          <div class="photo-card-user">
            <div class="user-avatar-sm">${(item.employeeName || 'م').charAt(0)}</div>
            <div>
              <div class="user-name-title">د. ${item.employeeName || 'غير معروف'}</div>
              <div class="user-meta-sub">كود: <strong>${item.employeeCode}</strong> | ${item.employeeArea || 'معمل أكيوريت'}</div>
            </div>
          </div>
          <div class="photo-card-date">
            <span>📅 ${item.dateDisplay || item.date}</span>
            <span>⏱️ ${item.time}</span>
          </div>
          <div class="photo-card-actions">
            <button type="button" class="btn btn-success btn-sm btn-block" onclick="window.downloadReportImage('${item.imageUrl}', '${item.typeLabel}_${item.employeeName}_${item.date}.jpg')">
              📥 تحميل على الجهاز
            </button>
            <button type="button" class="btn btn-secondary btn-sm" style="color: var(--accent-red);" onclick="window.deleteDailyUpload('${item.id}')" title="حذف من السيرفر">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

/* =========================================================
     ADMIN VIEWS RENDERER
     ========================================================= */
  function renderAdminViews() {
    // 1. PENDING REGISTRATION REQUESTS TABLE
    const pendingList = state.employees.filter(e => e.status === 'pending' || (e.isRegistered && !e.isApproved))
      .concat(state.registrationRequests.filter(r => !state.employees.some(e => e.code === r.code)));
    
    // Unique by code
    const uniquePending = [];
    const seenCodes = new Set();
    for (const p of pendingList) {
      if (!seenCodes.has(p.code)) {
        seenCodes.add(p.code);
        uniquePending.push(p);
      }
    }

    const pendingBadge = document.getElementById('adminPendingRequestsBadge');
    if (pendingBadge) {
      pendingBadge.textContent = `${uniquePending.length} طلب جديد`;
      pendingBadge.style.display = uniquePending.length ? 'inline-block' : 'none';
    }

    const pendingTable = document.getElementById('adminPendingRequestsTableBody');
    if (pendingTable) {
      if (uniquePending.length === 0) {
        pendingTable.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.25rem;">لا توجد طلبات تسجيل جديدة في انتظار الموافقة حالياً ✨</td></tr>`;
      } else {
        pendingTable.innerHTML = uniquePending.map(req => `
          <tr style="background: rgba(245, 158, 11, 0.05);">
            <td><strong style="color: var(--primary); font-size: 1.1rem; letter-spacing: 0.15em;">${req.code}</strong></td>
            <td><strong style="color: var(--text-primary);">${req.name || 'بدون اسم'}</strong></td>
            <td>${req.area || '-'}</td>
            <td><a href="tel:${req.phone}" style="color: var(--primary); font-weight: 600;">${req.phone || '-'}</a></td>
            <td><span class="badge badge-amber">⏳ قيد الانتظار</span></td>
            <td>
              <div style="display: flex; gap: 0.35rem; align-items: center;">
                <button type="button" class="btn btn-success btn-sm" onclick="window.approveEmployeeRegistration('${req.code}')" title="موافقة واعتماد">
                  ✅ موافقة
                </button>
                <button type="button" class="btn btn-secondary btn-sm" style="color: var(--accent-red);" onclick="window.rejectEmployeeRegistration('${req.code}')" title="رفض الطلب">
                  ❌ رفض
                </button>
              </div>
            </td>
          </tr>
        `).join('');
      }
    }

    // 2. APPROVED MEMBERS TABLE (الأعضاء المعتمدون وحذف عضو)
    const approvedMembers = state.employees.filter(e => e.isApproved === true || e.status === 'approved');
    const countEl = document.getElementById('adminCodesCount');
    if (countEl) countEl.textContent = `${approvedMembers.length} عضو معتمد`;

    const empTable = document.getElementById('adminEmployeesTableBody');
    if (empTable) {
      if (approvedMembers.length === 0) {
        empTable.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.25rem;">لا يوجد أعضاء معتمدون بالسيستم حالياً</td></tr>`;
      } else {
        empTable.innerHTML = approvedMembers.map(emp => `
          <tr>
            <td><strong style="color: var(--primary); letter-spacing: 0.1em; font-size: 1.05rem;">${emp.code}</strong></td>
            <td>
              <span class="badge badge-success">
                معتمد بالسيستم ✅
              </span>
            </td>
            <td><strong>د. ${emp.name || '-'}</strong></td>
            <td>${emp.area || '-'}</td>
            <td>${emp.phone || '-'}</td>
            <td>
              <button type="button" class="btn btn-danger btn-sm" onclick="window.deleteEmployeeMember('${emp.code}')" title="حذف العضو نهائياً من السيستم">
                🗑️ حذف عضو
              </button>
            </td>
          </tr>
        `).join('');
      }
    }

    // Populate employee select in rewards tab
    const empSelect = document.getElementById('rewardEmployeeSelect');
    if (empSelect) {
      const prev = empSelect.value;
      empSelect.innerHTML = `<option value="">اختر موظفاً...</option>` + state.employees.map(emp => `
        <option value="${emp.code}">${emp.name ? `د. ${emp.name} (كود: ${emp.code} - ${emp.area})` : `كود: ${emp.code} (غير مسجل)`}</option>
      `).join('');
      if (prev) empSelect.value = prev;
    }

    // 2. Rewards Table
    const rewTable = document.getElementById('adminRewardsTableBody');
    if (rewTable) {
      if (state.rewards.length === 0) {
        rewTable.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">لا توجد مكافآت أو خصومات مسجلة</td></tr>`;
      } else {
        rewTable.innerHTML = state.rewards.map(item => `
          <tr>
            <td>${item.employeeName || item.employeeCode}</td>
            <td>
              <span class="badge ${item.type === 'reward' ? 'badge-success' : 'badge-danger'}">
                ${item.type === 'reward' ? 'مكافأة 🎁' : 'خصم 🔻'}
              </span>
            </td>
            <td><strong>${item.amount} ج.م</strong></td>
            <td>${item.reason}</td>
            <td>${item.dateDisplay || item.date} ${item.time}</td>
            <td>
              <button type="button" class="btn btn-danger btn-sm" onclick="window.deleteRewardRecord('${item.id}')">
                حذف
              </button>
            </td>
          </tr>
        `).join('');
      }
    }

    // 3. Attendance Feed (with live search and date filter)
    const searchInput = document.getElementById('adminAttendanceSearchInput');
    const dateInput = document.getElementById('adminAttendanceDateFilter');
    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const dateVal = dateInput ? dateInput.value : '';

    let filteredAtt = state.attendance;
    if (searchVal) {
      filteredAtt = filteredAtt.filter(r =>
        (r.employeeName || '').toLowerCase().includes(searchVal) ||
        (r.employeeCode || '').includes(searchVal) ||
        (r.employeeArea || '').toLowerCase().includes(searchVal)
      );
    }
    if (dateVal) {
      filteredAtt = filteredAtt.filter(r => r.date === dateVal);
    }

    const attCount = document.getElementById('adminAttendanceCount');
    if (attCount) attCount.textContent = `${filteredAtt.length} حركة`;
    const attTable = document.getElementById('adminAttendanceTableBody');
    if (attTable) {
      if (filteredAtt.length === 0) {
        attTable.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">لا توجد حركات مطابقة للبحث أو التاريخ</td></tr>`;
      } else {
        attTable.innerHTML = filteredAtt.map(item => `
          <tr>
            <td><strong>${item.employeeName}</strong></td>
            <td><code>${item.employeeCode}</code></td>
            <td>${item.employeeArea}</td>
            <td>
              <span class="badge ${item.actionType.includes('in') ? 'badge-success' : 'badge-info'}">
                ${item.actionLabel}
              </span>
            </td>
            <td>${item.dateDisplay || item.date} - ${item.time}</td>
            <td>
              <button type="button" class="btn btn-danger btn-sm" onclick="window.deleteAttendanceRecord('${item.id}')">
                حذف
              </button>
            </td>
          </tr>
        `).join('');
      }
    }

    // 4. Leaves List
    const leaveCount = document.getElementById('adminLeavesCount');
    if (leaveCount) leaveCount.textContent = `${state.leaves.length} طلب`;
    const leaveContainer = document.getElementById('adminLeavesListContainer');
    if (leaveContainer) {
      if (state.leaves.length === 0) {
        leaveContainer.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">لا توجد طلبات إجازة واردة</div>`;
      } else {
        leaveContainer.innerHTML = state.leaves.map(leave => {
          let statusBadge = '<span class="badge badge-amber">⏳ قيد المراجعة</span>';
          if (leave.status === 'approved') statusBadge = '<span class="badge badge-success">✅ مقبولة</span>';
          if (leave.status === 'rejected') statusBadge = '<span class="badge badge-danger">❌ مرفوضة</span>';

          return `
            <div class="card" style="margin-bottom: 0.75rem;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                <div>
                  <strong style="font-size: 1rem;">${leave.employeeName}</strong>
                  <span style="font-size: 0.8rem; color: var(--text-muted); margin-right: 0.5rem;">(كود: ${leave.employeeCode} - فرع: ${leave.employeeArea} - هاتف: ${leave.employeePhone})</span>
                </div>
                ${statusBadge}
              </div>
              <div style="font-size: 0.85rem; margin-bottom: 0.5rem;">
                <strong>النوع:</strong> ${leave.leaveType} | <strong>المدة:</strong> ${leave.daysCount} أيام | <strong>البداية:</strong> ${leave.startDate}
              </div>
              <div style="font-size: 0.85rem; background: var(--bg-surface-elevated); padding: 0.5rem; border-radius: var(--radius-sm); margin-bottom: 0.5rem;">
                <strong>السبب:</strong> ${leave.reason}
              </div>
              ${leave.attachmentUrl ? `
                <div style="margin-bottom: 0.5rem;">
                  <a href="${leave.attachmentUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 0.82rem; font-weight: 700; color: var(--primary);">
                    📎 عرض المرفق الطبي المرفوع على Cloudinary
                  </a>
                </div>
              ` : ''}
              <div style="display: flex; gap: 0.5rem; align-items: center; justify-content: flex-end; flex-wrap: wrap;">
                <button type="button" class="btn btn-success btn-sm" onclick="window.approveLeaveRequest('${leave.id}')">
                  ✅ موافقة
                </button>
                <button type="button" class="btn btn-danger btn-sm" onclick="window.rejectLeaveRequest('${leave.id}')">
                  ❌ رفض
                </button>
                <button type="button" class="btn btn-secondary btn-sm" style="color: var(--accent-red);" onclick="window.deleteLeaveRequest('${leave.id}')">
                  🗑️ حذف
                </button>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 5. Supplies Catalog & Orders
    const supTable = document.getElementById('adminSuppliesCatalogTableBody');
    if (supTable) {
      if (state.supplies.length === 0) {
        supTable.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">لا توجد مستلزمات مضافة بالكتالوج</td></tr>`;
      } else {
        supTable.innerHTML = state.supplies.map(item => `
          <tr>
            <td>
              ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}" style="width: 36px; height: 36px; border-radius: 6px; object-fit: cover;">` : '-'}
            </td>
            <td><strong>${item.name}</strong></td>
            <td>${item.unit || item.category || '-'}</td>
            <td>
              <button type="button" class="btn btn-danger btn-sm" onclick="window.deleteSupplyCatalogItem('${item.id}')">
                حذف
              </button>
            </td>
          </tr>
        `).join('');
      }
    }

    const orderCount = document.getElementById('adminSupplyOrdersCount');
    if (orderCount) orderCount.textContent = `${state.supplyOrders.length} طلب`;
    const orderList = document.getElementById('adminSupplyOrdersList');
    if (orderList) {
      if (state.supplyOrders.length === 0) {
        orderList.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">لا توجد طلبات مستلزمات واردة</div>`;
      } else {
        orderList.innerHTML = state.supplyOrders.map(order => `
          <div class="card" style="margin-bottom: 0.75rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
              <div>
                <strong>د. ${order.employeeName}</strong>
                <span style="font-size: 0.8rem; color: var(--text-muted); margin-right: 0.5rem;">(كود: ${order.employeeCode} - فرع: ${order.employeeArea} - هاتف: ${order.employeePhone})</span>
              </div>
              <span class="badge ${order.status === 'completed' ? 'badge-success' : 'badge-amber'}">
                ${order.status === 'completed' ? 'تم الصرف والتسليم' : 'قيد التجهيز'}
              </span>
            </div>
            <div style="font-size: 0.95rem; font-weight: 700; color: var(--primary);">
              📦 ${order.supplyName} — الكمية: ${order.quantity}
            </div>
            ${order.notes ? `<div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.25rem;">ملاحظات: ${order.notes}</div>` : ''}
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end; align-items: center; margin-top: 0.5rem;">
              ${order.status !== 'completed' ? `
                <button type="button" class="btn btn-success btn-sm" onclick="window.completeSupplyOrder('${order.id}')">
                  ✅ تأكيد الصرف
                </button>
              ` : ''}
              <button type="button" class="btn btn-danger btn-sm" onclick="window.deleteSupplyOrder('${order.id}')">
                🗑️ حذف الطلب
              </button>
            </div>
          </div>
        `).join('');
      }
    }
  }
  window.renderAdminViews = renderAdminViews;

  function renderAllEmployeeViews() {
    renderEmployeeAttendance();
    renderEmployeeDailyUploads();
    renderEmployeeRewards();
    renderEmployeeSupplies();
    renderEmployeeLeaves();
  }

  /* =========================================================
     LIVE CLOCK
     ========================================================= */
  function startClock() {
    function tick() {
      const now = new Date();
      const timeEl = document.getElementById('digitalClockTime');
      const dateEl = document.getElementById('digitalClockDate');
      if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      }
      if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      }
    }
    tick();
    setInterval(tick, 1000);
  }

  /* =========================================================
     CLOUDINARY UPLOAD HELPER
     ========================================================= */
  function uploadToCloudinary(file, onProgress) {
    if (!file) return Promise.reject(new Error('يرجى تحديد ملف للرفع'));

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CONFIG.CLOUDINARY.uploadPreset);
    formData.append('folder', 'accurate_lab');

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', CONFIG.CLOUDINARY.uploadUrl, true);
      xhr.timeout = 6000;
      xhr.ontimeout = () => reject(new Error('انتهت مهلة الاتصال بـ Cloudinary'));

      if (xhr.upload && typeof onProgress === 'function') {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch (_) {
            reject(new Error('فشل معالجة استجابة الرفع'));
          }
        } else {
          reject(new Error('حدث خطأ أثناء الرفع إلى Cloudinary'));
        }
      };

      xhr.onerror = () => reject(new Error('تعذر الاتصال بـ Cloudinary'));
      xhr.send(formData);
    });
  }

  function setupCloudinaryUploads() {
    // Leave document upload
    const leaveDrop = document.getElementById('leaveUploadDropzone');
    const leaveInput = document.getElementById('leaveFileInput');
    const leaveProg = document.getElementById('leaveUploadProgress');
    const leaveBar = document.getElementById('leaveProgressBarInner');
    const leaveTxt = document.getElementById('leaveUploadProgressText');
    const leavePrev = document.getElementById('leaveUploadPreview');
    const leaveImg = document.getElementById('leavePreviewImg');

    if (leaveDrop && leaveInput) {
      leaveDrop.addEventListener('click', (e) => {
        if (e.target.closest('#btnRemoveLeaveAttachment')) return;
        leaveInput.click();
      });

      leaveInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (leaveProg) leaveProg.style.display = 'block';
        if (leaveBar) leaveBar.style.width = '0%';
        if (leaveTxt) leaveTxt.textContent = 'جاري الرفع إلى Cloudinary... (0%)';

        try {
          const res = await uploadToCloudinary(file, (p) => {
            if (leaveBar) leaveBar.style.width = p + '%';
            if (leaveTxt) leaveTxt.textContent = `جاري الرفع... (${p}%)`;
          });

          state.uploadedLeaveFile = res;
          if (leaveProg) leaveProg.style.display = 'none';
          if (leavePrev) leavePrev.style.display = 'inline-block';
          if (leaveImg) leaveImg.src = res.secure_url;
          playSound('success');
          showToast('تم رفع المرفق الطبي بنجاح إلى Cloudinary ✅', 'success');
        } catch (err) {
          if (leaveProg) leaveProg.style.display = 'none';
          showToast(err.message || 'فشل رفع الملف', 'error');
        }
      });
    }

    // Supply image upload in admin
    const supDrop = document.getElementById('supplyUploadDropzone');
    const supInput = document.getElementById('supplyFileInput');
    const supProg = document.getElementById('supplyUploadProgress');
    const supBar = document.getElementById('supplyProgressBarInner');
    const supTxt = document.getElementById('supplyUploadProgressText');
    const supPrev = document.getElementById('supplyUploadPreview');
    const supImg = document.getElementById('supplyPreviewImg');

    if (supDrop && supInput) {
      supDrop.addEventListener('click', (e) => {
        if (e.target.closest('#btnRemoveSupplyImg')) return;
        supInput.click();
      });

      supInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (supProg) supProg.style.display = 'block';
        if (supBar) supBar.style.width = '0%';
        if (supTxt) supTxt.textContent = 'جاري الرفع إلى Cloudinary... (0%)';

        try {
          const res = await uploadToCloudinary(file, (p) => {
            if (supBar) supBar.style.width = p + '%';
            if (supTxt) supTxt.textContent = `جاري الرفع... (${p}%)`;
          });

          state.uploadedSupplyFile = res;
          if (supProg) supProg.style.display = 'none';
          if (supPrev) supPrev.style.display = 'inline-block';
          if (supImg) supImg.src = res.secure_url;
          playSound('success');
          showToast('تم رفع صورة المستلزم بنجاح إلى Cloudinary ✅', 'success');
        } catch (err) {
          if (supProg) supProg.style.display = 'none';
          showToast(err.message || 'فشل رفع صورة المستلزم', 'error');
        }
      });
    }
  }

  /* =========================================================
     INIT ALL ATTACHMENTS & EVENT LISTENERS
     ========================================================= */
  function setupAllEventListeners() {
    // Attendance Filters
    const searchInput = document.getElementById('adminAttendanceSearchInput');
    const dateInput = document.getElementById('adminAttendanceDateFilter');
    const resetFilterBtn = document.getElementById('btnResetAttendanceFilter');
    if (searchInput) {
      searchInput.addEventListener('input', () => renderAdminViews());
    }
    if (dateInput) {
      dateInput.addEventListener('change', () => renderAdminViews());
    }
    if (resetFilterBtn) {
      resetFilterBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (dateInput) dateInput.value = '';
        renderAdminViews();
      });
    }
  }

  function initApp() {
    applyTheme(state.theme);
    startClock();
    setupCloudinaryUploads();
    initFirebase();
    updateViewVisibility();
    setupAllEventListeners();

    console.log('🚀 Accurate Lab Engine is 100% Ready');
    window.appReady = true;
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})(window, document);
