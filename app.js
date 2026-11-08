/**
 * Accurate Lab - Medical Laboratory Web Portal
 * Unified Application Engine (Compatible with file:// and http/https protocols)
 */

(function () {
  'use strict';

  /* =========================================================
     CONFIGURATION
     ========================================================= */
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBF4UsJhaL0a754H3rqgz7O-i1U_tOAvQQ",
    authDomain: "accurate-19f22.firebaseapp.com",
    projectId: "accurate-19f22",
    storageBucket: "accurate-19f22.firebasestorage.app",
    messagingSenderId: "876808771046",
    appId: "1:876808771046:web:a225ca3d084c11f4b6b227",
    databaseURL: "https://accurate-19f22-default-rtdb.firebaseio.com"
  };

  const CLOUDINARY_CONFIG = {
    cloudName: "dt1nytaju",
    uploadPreset: "accurate",
    uploadUrl: "https://api.cloudinary.com/v1_1/dt1nytaju/upload"
  };

  const ADMIN_PIN = "4k4k";

  const STORAGE_KEYS = {
    USER: 'accurate_lab_user',
    THEME: 'accurate_theme',
    ADMIN_AUTH: 'accurate_admin_auth',
    EMPLOYEES: 'accurate_local_employees',
    ATTENDANCE: 'accurate_local_attendance',
    REWARDS: 'accurate_local_rewards',
    SUPPLIES: 'accurate_local_supplies',
    SUPPLY_REQUESTS: 'accurate_local_supply_requests',
    LEAVE_REQUESTS: 'accurate_local_leave_requests'
  };

  const ATTENDANCE_LABELS = {
    morning_in: 'تسجيل دخول صباحي',
    morning_out: 'تسجيل خروج صباحي',
    evening_in: 'تسجيل دخول مسائي',
    evening_out: 'تسجيل خروج مسائي'
  };

  /* =========================================================
     INITIALIZE FIREBASE (WITH LOCAL FALLBACK)
     ========================================================= */
  let firebaseDb = null;
  let isFirebaseAvailable = false;

  try {
    if (typeof firebase !== 'undefined' && firebase.initializeApp) {
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      firebaseDb = firebase.database();
      isFirebaseAvailable = true;
      console.log('✅ Firebase Database connected successfully');
    }
  } catch (err) {
    console.warn('⚠️ Firebase init warning, running with local sync fallback:', err);
  }

  /* =========================================================
     AUDIO SYNTHESIS (Web Audio API - No External Files)
     ========================================================= */
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      if (type === 'bubble') {
        // Soft bubble popping sound
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.12);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'beep' || type === 'checkin') {
        // Crisp medical scanner check-in double chime
        [0, 0.1].forEach((delay, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(idx === 0 ? 880 : 1320, now + delay);
          gain.gain.setValueAtTime(0.2, now + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.08);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + delay);
          osc.stop(now + delay + 0.08);
        });
      } else if (type === 'success') {
        // Harmonic major chord chime
        [523.25, 659.25, 783.99].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          gain.gain.setValueAtTime(0.18, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.25);
        });
      }
    } catch (_) {}
  }

  /* =========================================================
     DATE & TIME UTILITIES
     ========================================================= */
  function getArabicDateTime(timestamp = Date.now()) {
    const d = new Date(timestamp);
    const dateStr = d.toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeStr = d.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    const isoDate = d.toISOString().split('T')[0];
    return { dateStr, timeStr, isoDate };
  }

  /* =========================================================
     CLOUDINARY DIRECT UNSIGNED UPLOAD
     ========================================================= */
  function uploadToCloudinary(file, onProgress) {
    if (!file) {
      return Promise.reject(new Error('يرجى تحديد ملف للرفع'));
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return Promise.reject(new Error('نوع الملف غير مدعوم. يرجى اختيار صورة JPG أو PNG أو ملف PDF'));
    }

    if (file.size > 10 * 1024 * 1024) {
      return Promise.reject(new Error('الحد الأقصى لحجم الملف هو 10 ميجابايت'));
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    formData.append('folder', 'accurate_lab');

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', CLOUDINARY_CONFIG.uploadUrl, true);

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
            resolve({
              url: data.secure_url || data.url,
              secure_url: data.secure_url,
              public_id: data.public_id,
              format: data.format,
              bytes: data.bytes
            });
          } catch (e) {
            reject(new Error('فشل معالجة استجابة Cloudinary'));
          }
        } else {
          let errorMsg = 'فشل الرفع إلى Cloudinary';
          try {
            const err = JSON.parse(xhr.responseText);
            if (err.error && err.error.message) errorMsg = err.error.message;
          } catch (_) {}
          reject(new Error(errorMsg));
        }
      };

      xhr.onerror = () => {
        reject(new Error('تعذر الاتصال بخادم Cloudinary. يرجى التحقق من اتصال الإنترنت'));
      };

      xhr.send(formData);
    });
  }

  function getOptimizedImageUrl(url, width) {
    if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) {
      return url || '';
    }
    const uploadIndex = url.indexOf('/upload/');
    if (uploadIndex === -1) return url;
    let transformations = 'f_auto,q_auto';
    if (width) transformations += ',w_' + width + ',c_limit';
    return url.replace('/upload/', '/upload/' + transformations + '/');
  }

  /* =========================================================
     DATABASE ADAPTER (Firebase Realtime DB + LocalStorage Sync)
     ========================================================= */
  function loadLocal(key, defaultVal) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultVal;
    } catch (_) {
      return defaultVal;
    }
  }

  function saveLocal(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {}
  }

  const db = {
    // Generate Random 4-Digit Code
    async generateEmployeeCode() {
      const existing = await this.getEmployees();
      let code = '';
      let attempts = 0;
      do {
        code = Math.floor(1000 + Math.random() * 9000).toString();
        attempts++;
      } while (existing.some(e => e.code === code) && attempts < 100);

      const newEmp = {
        code: code,
        isRegistered: false,
        name: '',
        phone: '',
        area: '',
        createdAt: Date.now()
      };

      if (isFirebaseAvailable) {
        try {
          await firebaseDb.ref('employees/' + code).set(newEmp);
        } catch (e) {
          console.warn('Firebase write failed, saving locally:', e);
        }
      }

      // Sync local
      const list = loadLocal(STORAGE_KEYS.EMPLOYEES, []);
      list.unshift(newEmp);
      saveLocal(STORAGE_KEYS.EMPLOYEES, list);
      return newEmp;
    },

    async getEmployees() {
      if (isFirebaseAvailable) {
        try {
          const snap = await firebaseDb.ref('employees').once('value');
          const data = snap.val() || {};
          const list = Object.keys(data).map(k => ({ ...data[k], code: k }));
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          saveLocal(STORAGE_KEYS.EMPLOYEES, list);
          return list;
        } catch (_) {}
      }
      return loadLocal(STORAGE_KEYS.EMPLOYEES, []);
    },

    async registerEmployee(code, { name, phone, area }) {
      const updates = {
        code: code,
        isRegistered: true,
        name: name.trim(),
        phone: phone.trim(),
        area: area.trim(),
        registeredAt: Date.now()
      };

      if (isFirebaseAvailable) {
        try {
          await firebaseDb.ref('employees/' + code).update(updates);
        } catch (e) {
          console.warn('Firebase update failed, updating locally:', e);
        }
      }

      const list = loadLocal(STORAGE_KEYS.EMPLOYEES, []);
      const idx = list.findIndex(e => e.code === code);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates };
      } else {
        list.unshift(updates);
      }
      saveLocal(STORAGE_KEYS.EMPLOYEES, list);
      return updates;
    },

    async deleteEmployee(code) {
      if (isFirebaseAvailable) {
        try {
          await firebaseDb.ref('employees/' + code).remove();
        } catch (_) {}
      }
      const list = loadLocal(STORAGE_KEYS.EMPLOYEES, []).filter(e => e.code !== code);
      saveLocal(STORAGE_KEYS.EMPLOYEES, list);
    },

    // Attendance
    async recordAttendance({ employeeCode, employeeName, employeePhone, employeeArea, actionType }) {
      const { dateStr, timeStr, isoDate } = getArabicDateTime();
      const id = 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

      const record = {
        id: id,
        employeeCode: employeeCode,
        employeeName: employeeName || 'غير معروف',
        employeePhone: employeePhone || '',
        employeeArea: employeeArea || 'غير محدد',
        actionType: actionType,
        actionLabel: ATTENDANCE_LABELS[actionType] || actionType,
        date: isoDate,
        dateDisplay: dateStr,
        time: timeStr,
        timestamp: Date.now()
      };

      if (isFirebaseAvailable) {
        try {
          await firebaseDb.ref('attendance/' + id).set(record);
        } catch (e) {
          console.warn('Firebase attendance write error:', e);
        }
      }

      const list = loadLocal(STORAGE_KEYS.ATTENDANCE, []);
      list.unshift(record);
      saveLocal(STORAGE_KEYS.ATTENDANCE, list);
      return record;
    },

    async deleteAttendance(id) {
      if (isFirebaseAvailable) {
        try {
          await firebaseDb.ref('attendance/' + id).remove();
        } catch (_) {}
      }
      const list = loadLocal(STORAGE_KEYS.ATTENDANCE, []).filter(item => item.id !== id);
      saveLocal(STORAGE_KEYS.ATTENDANCE, list);
    },

    // Rewards & Deductions
    async addRewardDeduction({ employeeCode, employeeName, employeeArea, type, amount, reason }) {
      const { dateStr, timeStr, isoDate } = getArabicDateTime();
      const id = 'rew_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

      const record = {
        id: id,
        employeeCode: employeeCode,
        employeeName: employeeName || '',
        employeeArea: employeeArea || '',
        type: type,
        amount: parseFloat(amount),
        reason: reason.trim(),
        date: isoDate,
        dateDisplay: dateStr,
        time: timeStr,
        timestamp: Date.now()
      };

      if (isFirebaseAvailable) {
        try {
          await firebaseDb.ref('rewards/' + id).set(record);
        } catch (_) {}
      }

      const list = loadLocal(STORAGE_KEYS.REWARDS, []);
      list.unshift(record);
      saveLocal(STORAGE_KEYS.REWARDS, list);
      return record;
    },

    async deleteReward(id) {
      if (isFirebaseAvailable) {
        try {
          await firebaseDb.ref('rewards/' + id).remove();
        } catch (_) {}
      }
      const list = loadLocal(STORAGE_KEYS.REWARDS, []).filter(item => item.id !== id);
      saveLocal(STORAGE_KEYS.REWARDS, list);
    },

    // Supplies Catalog
    async addSupplyItem({ name, category, unit, imageUrl, imagePublicId, notes }) {
      const id = 'sup_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const item = {
        id: id,
        name: name.trim(),
        category: (category || 'عام').trim(),
        unit: (unit || 'قطعة').trim(),
        imageUrl: imageUrl || '',
        imagePublicId: imagePublicId || '',
        notes: (notes || '').trim(),
        createdAt: Date.now()
      };

      if (isFirebaseAvailable) {
        try {
          await firebaseDb.ref('supplies/' + id).set(item);
        } catch (_) {}
      }

      const list = loadLocal(STORAGE_KEYS.SUPPLIES, []);
      list.unshift(item);
      saveLocal(STORAGE_KEYS.SUPPLIES, list);
      return item;
    },

    async deleteSupplyItem(id) {
      if (isFirebaseAvailable) {
        try {
          await firebaseDb.ref('supplies/' + id).remove();
        } catch (_) {}
      }
      const list = loadLocal(STORAGE_KEYS.SUPPLIES, []).filter(item => item.id !== id);
      saveLocal(STORAGE_KEYS.SUPPLIES, list);
    },

    // Supply Requests from Employees
    async submitSupplyRequest({ employeeCode, employeeName, employeePhone, employeeArea, supplyName, quantity, notes }) {
      const { dateStr, timeStr, isoDate } = getArabicDateTime();
      const id = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

      const record = {
        id: id,
        employeeCode: employeeCode,
        employeeName: employeeName,
        employeePhone: employeePhone,
        employeeArea: employeeArea,
        supplyName: supplyName.trim(),
        quantity: quantity.trim(),
        notes: (notes || '').trim(),
        status: 'pending',
        date: isoDate,
        dateDisplay: dateStr,
        time: timeStr,
        createdAt: Date.now()
      };

      if (isFirebaseAvailable) {
        try {
          await firebaseDb.ref('supply_requests/' + id).set(record);
        } catch (_) {}
      }

      const list = loadLocal(STORAGE_KEYS.SUPPLY_REQUESTS, []);
      list.unshift(record);
      saveLocal(STORAGE_KEYS.SUPPLY_REQUESTS, list);
      return record;
    },

    async updateSupplyRequestStatus(id, status) {
      if (isFirebaseAvailable) {
        try {
          await firebaseDb.ref('supply_requests/' + id).update({ status: status });
        } catch (_) {}
      }
      const list = loadLocal(STORAGE_KEYS.SUPPLY_REQUESTS, []);
      const item = list.find(r => r.id === id);
      if (item) item.status = status;
      saveLocal(STORAGE_KEYS.SUPPLY_REQUESTS, list);
    },

    async deleteSupplyRequest(id) {
      if (isFirebaseAvailable) {
        try {
          await firebaseDb.ref('supply_requests/' + id).remove();
        } catch (_) {}
      }
      const list = loadLocal(STORAGE_KEYS.SUPPLY_REQUESTS, []).filter(r => r.id !== id);
      saveLocal(STORAGE_KEYS.SUPPLY_REQUESTS, list);
    },

    // Leave Requests
    async submitLeaveRequest({ employeeCode, employeeName, employeePhone, employeeArea, daysCount, startDate, leaveType, reason, attachmentUrl, attachmentPublicId }) {
      const { dateStr, timeStr, isoDate } = getArabicDateTime();
      const id = 'leave_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

      const record = {
        id: id,
        employeeCode: employeeCode,
        employeeName: employeeName,
        employeePhone: employeePhone,
        employeeArea: employeeArea,
        daysCount: parseInt(daysCount, 10),
        startDate: startDate,
        leaveType: leaveType || 'اعتيادية',
        reason: (reason || '').trim(),
        attachmentUrl: attachmentUrl || '',
        attachmentPublicId: attachmentPublicId || '',
        status: 'pending',
        adminNotes: '',
        date: isoDate,
        dateDisplay: dateStr,
        time: timeStr,
        createdAt: Date.now()
      };

      if (isFirebaseAvailable) {
        try {
          await firebaseDb.ref('leave_requests/' + id).set(record);
        } catch (_) {}
      }

      const list = loadLocal(STORAGE_KEYS.LEAVE_REQUESTS, []);
      list.unshift(record);
      saveLocal(STORAGE_KEYS.LEAVE_REQUESTS, list);
      return record;
    },

    async updateLeaveRequestStatus(id, status, adminNotes) {
      const updates = {
        status: status,
        adminNotes: (adminNotes || '').trim(),
        reviewedAt: Date.now()
      };
      if (isFirebaseAvailable) {
        try {
          await firebaseDb.ref('leave_requests/' + id).update(updates);
        } catch (_) {}
      }
      const list = loadLocal(STORAGE_KEYS.LEAVE_REQUESTS, []);
      const item = list.find(r => r.id === id);
      if (item) Object.assign(item, updates);
      saveLocal(STORAGE_KEYS.LEAVE_REQUESTS, list);
    },

    async deleteLeaveRequest(id) {
      if (isFirebaseAvailable) {
        try {
          await firebaseDb.ref('leave_requests/' + id).remove();
        } catch (_) {}
      }
      const list = loadLocal(STORAGE_KEYS.LEAVE_REQUESTS, []).filter(r => r.id !== id);
      saveLocal(STORAGE_KEYS.LEAVE_REQUESTS, list);
    },

    // Real-time synchronization listeners
    listenAll(callbacks) {
      if (isFirebaseAvailable) {
        firebaseDb.ref('employees').on('value', snap => {
          const d = snap.val() || {};
          const list = Object.keys(d).map(k => ({ ...d[k], code: k }));
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          saveLocal(STORAGE_KEYS.EMPLOYEES, list);
          callbacks.onEmployees(list);
        });

        firebaseDb.ref('attendance').on('value', snap => {
          const d = snap.val() || {};
          const list = Object.keys(d).map(k => ({ ...d[k], id: k }));
          list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          saveLocal(STORAGE_KEYS.ATTENDANCE, list);
          callbacks.onAttendance(list);
        });

        firebaseDb.ref('rewards').on('value', snap => {
          const d = snap.val() || {};
          const list = Object.keys(d).map(k => ({ ...d[k], id: k }));
          list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          saveLocal(STORAGE_KEYS.REWARDS, list);
          callbacks.onRewards(list);
        });

        firebaseDb.ref('supplies').on('value', snap => {
          const d = snap.val() || {};
          const list = Object.keys(d).map(k => ({ ...d[k], id: k }));
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          saveLocal(STORAGE_KEYS.SUPPLIES, list);
          callbacks.onSupplies(list);
        });

        firebaseDb.ref('supply_requests').on('value', snap => {
          const d = snap.val() || {};
          const list = Object.keys(d).map(k => ({ ...d[k], id: k }));
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          saveLocal(STORAGE_KEYS.SUPPLY_REQUESTS, list);
          callbacks.onSupplyRequests(list);
        });

        firebaseDb.ref('leave_requests').on('value', snap => {
          const d = snap.val() || {};
          const list = Object.keys(d).map(k => ({ ...d[k], id: k }));
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          saveLocal(STORAGE_KEYS.LEAVE_REQUESTS, list);
          callbacks.onLeaveRequests(list);
        });
      } else {
        // Fallback local triggers
        callbacks.onEmployees(loadLocal(STORAGE_KEYS.EMPLOYEES, []));
        callbacks.onAttendance(loadLocal(STORAGE_KEYS.ATTENDANCE, []));
        callbacks.onRewards(loadLocal(STORAGE_KEYS.REWARDS, []));
        callbacks.onSupplies(loadLocal(STORAGE_KEYS.SUPPLIES, []));
        callbacks.onSupplyRequests(loadLocal(STORAGE_KEYS.SUPPLY_REQUESTS, []));
        callbacks.onLeaveRequests(loadLocal(STORAGE_KEYS.LEAVE_REQUESTS, []));
      }
    }
  };

  /* =========================================================
     APPLICATION STATE
     ========================================================= */
  const state = {
    currentEmployee: null,
    activePage: 'attendance',
    theme: localStorage.getItem(STORAGE_KEYS.THEME) || 'light',
    pendingRegistrationCode: null,
    allEmployees: loadLocal(STORAGE_KEYS.EMPLOYEES, []),
    allAttendance: loadLocal(STORAGE_KEYS.ATTENDANCE, []),
    allRewards: loadLocal(STORAGE_KEYS.REWARDS, []),
    allSupplies: loadLocal(STORAGE_KEYS.SUPPLIES, []),
    allSupplyRequests: loadLocal(STORAGE_KEYS.SUPPLY_REQUESTS, []),
    allLeaveRequests: loadLocal(STORAGE_KEYS.LEAVE_REQUESTS, []),
    uploadedLeaveFile: null,
    uploadedSupplyFile: null
  };

  /* =========================================================
     DOM ELEMENTS LOOKUP
     ========================================================= */
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    html: document.documentElement,
    themeToggleBtn: $('themeToggleBtn'),
    themeIconSun: $('themeIconSun'),
    themeIconMoon: $('themeIconMoon'),

    // Views
    viewLogin: $('viewLogin'),
    viewMainApp: $('viewMainApp'),
    mobileNav: $('mobileNav'),
    desktopNav: $('desktopNav'),

    // Header User Badge
    userHeaderBadge: $('userHeaderBadge'),
    userHeaderAvatar: $('userHeaderAvatar'),
    userHeaderName: $('userHeaderName'),
    userHeaderArea: $('userHeaderArea'),
    logoutBtn: $('logoutBtn'),

    // Transition Overlay (0.5s bubbles)
    pageTransitionOverlay: $('pageTransitionOverlay'),

    // Navigation
    desktopNavItems: $$('.desktop-nav-item'),
    mobileNavTabs: $$('.nav-tab-btn'),
    pages: {
      attendance: $('pageAttendance'),
      rewards: $('pageRewards'),
      supplies: $('pageSupplies'),
      leave: $('pageLeave')
    },

    // Clock
    digitalClockTime: $('digitalClockTime'),
    digitalClockDate: $('digitalClockDate'),

    // Attendance
    btnMorningIn: $('btnMorningIn'),
    statusMorningIn: $('statusMorningIn'),
    cardMorningIn: $('cardMorningIn'),
    btnMorningOut: $('btnMorningOut'),
    statusMorningOut: $('statusMorningOut'),
    cardMorningOut: $('cardMorningOut'),
    btnEveningIn: $('btnEveningIn'),
    statusEveningIn: $('statusEveningIn'),
    cardEveningIn: $('cardEveningIn'),
    btnEveningOut: $('btnEveningOut'),
    statusEveningOut: $('statusEveningOut'),
    cardEveningOut: $('cardEveningOut'),
    todaySummaryBadge: $('todaySummaryBadge'),
    attendanceHistoryList: $('attendanceHistoryList'),
    attendanceHistoryCount: $('attendanceHistoryCount'),

    // Rewards
    totalRewardsSum: $('totalRewardsSum'),
    totalDeductionsSum: $('totalDeductionsSum'),
    netRewardsSum: $('netRewardsSum'),
    rewardsListContainer: $('rewardsListContainer'),

    // Supplies
    suppliesCatalogGrid: $('suppliesCatalogGrid'),
    orderSupplyForm: $('orderSupplyForm'),
    supplySelect: $('supplySelect'),
    supplyQuantity: $('supplyQuantity'),
    supplyNotes: $('supplyNotes'),
    mySupplyOrdersList: $('mySupplyOrdersList'),

    // Leave
    leaveRequestForm: $('leaveRequestForm'),
    leaveDaysCount: $('leaveDaysCount'),
    leaveStartDate: $('leaveStartDate'),
    leaveType: $('leaveType'),
    leaveReason: $('leaveReason'),
    leaveFileInput: $('leaveFileInput'),
    leaveUploadDropzone: $('leaveUploadDropzone'),
    leaveUploadProgress: $('leaveUploadProgress'),
    leaveProgressBarInner: $('leaveProgressBarInner'),
    leaveUploadProgressText: $('leaveUploadProgressText'),
    leaveUploadPreview: $('leaveUploadPreview'),
    leavePreviewImg: $('leavePreviewImg'),
    btnRemoveLeaveAttachment: $('btnRemoveLeaveAttachment'),
    myLeaveRequestsList: $('myLeaveRequestsList'),

    // Admin FAB & PIN Modal
    fabAdminBtn: $('fabAdminBtn'),
    adminPinModal: $('adminPinModal'),
    adminPinForm: $('adminPinForm'),
    adminPinInput: $('adminPinInput'),
    closeAdminPinBtns: $$('.close-admin-pin'),

    // Admin Dashboard Modal
    adminDashboardModal: $('adminDashboardModal'),
    closeAdminDashboardBtn: $('closeAdminDashboardBtn'),
    adminTabBtns: $$('.admin-tab-btn'),
    adminPanes: {
      adminCodes: $('paneAdminCodes'),
      adminRewards: $('paneAdminRewards'),
      adminAttendance: $('paneAdminAttendance'),
      adminLeaves: $('paneAdminLeaves'),
      adminSupplies: $('paneAdminSupplies')
    },
    btnGenerateCode: $('btnGenerateCode'),
    generatedCodeDisplay: $('generatedCodeDisplay'),
    adminCodesCount: $('adminCodesCount'),
    adminEmployeesTableBody: $('adminEmployeesTableBody'),
    rewardEmployeeSelect: $('rewardEmployeeSelect'),
    adminRewardForm: $('adminRewardForm'),
    adminRewardsTableBody: $('adminRewardsTableBody'),
    adminAttendanceTableBody: $('adminAttendanceTableBody'),
    adminAttendanceCount: $('adminAttendanceCount'),
    adminLeavesListContainer: $('adminLeavesListContainer'),
    adminLeavesCount: $('adminLeavesCount'),
    adminAddSupplyForm: $('adminAddSupplyForm'),
    supplyFileInput: $('supplyFileInput'),
    supplyUploadDropzone: $('supplyUploadDropzone'),
    supplyUploadProgress: $('supplyUploadProgress'),
    supplyProgressBarInner: $('supplyProgressBarInner'),
    supplyUploadProgressText: $('supplyUploadProgressText'),
    supplyUploadPreview: $('supplyUploadPreview'),
    supplyPreviewImg: $('supplyPreviewImg'),
    btnRemoveSupplyImg: $('btnRemoveSupplyImg'),
    adminSuppliesCatalogTableBody: $('adminSuppliesCatalogTableBody'),
    adminSupplyOrdersList: $('adminSupplyOrdersList'),
    adminSupplyOrdersCount: $('adminSupplyOrdersCount'),

    // Login & Registration
    mainLoginForm: $('mainLoginForm'),
    mainEmployeeCodeInput: $('mainEmployeeCodeInput'),
    registerModal: $('registerModal'),
    registerForm: $('registerForm'),
    regName: $('regName'),
    regArea: $('regArea'),
    regPhone: $('regPhone'),

    // Toast Container
    toastContainer: $('toastContainer')
  };

  /* =========================================================
     TOAST NOTIFICATIONS
     ========================================================= */
  function showToast(message, type = 'info', duration = 3500) {
    if (!dom.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    } else {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    toast.innerHTML = iconSvg + '<span>' + message + '</span>';
    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /* =========================================================
     THEME SWITCHER
     ========================================================= */
  function applyTheme(theme) {
    dom.html.setAttribute('data-theme', theme);
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (theme === 'dark') {
      if (dom.themeIconSun) dom.themeIconSun.style.display = 'block';
      if (dom.themeIconMoon) dom.themeIconMoon.style.display = 'none';
      if (themeColorMeta) themeColorMeta.setAttribute('content', '#0b1120');
    } else {
      if (dom.themeIconSun) dom.themeIconSun.style.display = 'none';
      if (dom.themeIconMoon) dom.themeIconMoon.style.display = 'block';
      if (themeColorMeta) themeColorMeta.setAttribute('content', '#0284c7');
    }
  }

  function initTheme() {
    applyTheme(state.theme);
    if (dom.themeToggleBtn) {
      dom.themeToggleBtn.addEventListener('click', () => {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem(STORAGE_KEYS.THEME, state.theme);
        applyTheme(state.theme);
        playSound('bubble');
        showToast(state.theme === 'dark' ? 'تم تفعيل الوضع الداكن 🌙' : 'تم تفعيل الوضع النهاري ☀️', 'info', 2000);
      });
    }
  }

  /* =========================================================
     0.5s SKY-BLUE & WHITE BUBBLES PAGE TRANSITION
     ========================================================= */
  function navigateToPage(targetPageId) {
    if (state.activePage === targetPageId) return;

    playSound('bubble');

    // Trigger bubbles animation overlay
    if (dom.pageTransitionOverlay) {
      dom.pageTransitionOverlay.classList.add('animating');
    }

    // Midpoint: switch active page in DOM
    setTimeout(() => {
      Object.keys(dom.pages).forEach(key => {
        if (dom.pages[key]) {
          dom.pages[key].classList.toggle('active', key === targetPageId);
        }
      });

      dom.desktopNavItems.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === targetPageId);
      });
      dom.mobileNavTabs.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === targetPageId);
      });

      state.activePage = targetPageId;
      window.scrollTo({ top: 0, behavior: 'instant' });
    }, 250);

    // End of 0.5s (500ms): hide transition overlay
    setTimeout(() => {
      if (dom.pageTransitionOverlay) {
        dom.pageTransitionOverlay.classList.remove('animating');
      }
    }, 500);
  }

  function setupNavigation() {
    dom.desktopNavItems.forEach(btn => {
      btn.addEventListener('click', () => navigateToPage(btn.dataset.page));
    });

    dom.mobileNavTabs.forEach(btn => {
      btn.addEventListener('click', () => navigateToPage(btn.dataset.page));
    });
  }

  /* =========================================================
     LIVE CLOCK & DATE
     ========================================================= */
  function initLiveClock() {
    function tick() {
      const { dateStr, timeStr } = getArabicDateTime();
      if (dom.digitalClockTime) dom.digitalClockTime.textContent = timeStr;
      if (dom.digitalClockDate) dom.digitalClockDate.textContent = dateStr;
    }
    tick();
    setInterval(tick, 1000);
  }

  /* =========================================================
     AUTHENTICATION & LOGIN VIEW
     ========================================================= */
  function updateAuthViews() {
    const savedUser = loadLocal(STORAGE_KEYS.USER, null);
    state.currentEmployee = savedUser;

    if (!savedUser) {
      // Show Login View, hide Main App View
      if (dom.viewLogin) dom.viewLogin.style.display = 'block';
      if (dom.viewMainApp) dom.viewMainApp.style.display = 'none';
      if (dom.mobileNav) dom.mobileNav.style.display = 'none';
      if (dom.desktopNav) dom.desktopNav.style.display = 'none';
      if (dom.userHeaderBadge) dom.userHeaderBadge.style.display = 'none';
      if (dom.logoutBtn) dom.logoutBtn.style.display = 'none';
      if (dom.mainEmployeeCodeInput) dom.mainEmployeeCodeInput.focus();
    } else {
      // Hide Login View, show Main App View
      if (dom.viewLogin) dom.viewLogin.style.display = 'none';
      if (dom.viewMainApp) dom.viewMainApp.style.display = 'block';
      if (dom.mobileNav) dom.mobileNav.style.display = 'flex';
      if (dom.desktopNav) dom.desktopNav.style.display = 'block';
      if (dom.userHeaderBadge) dom.userHeaderBadge.style.display = 'flex';
      if (dom.logoutBtn) dom.logoutBtn.style.display = 'flex';

      if (dom.userHeaderName) dom.userHeaderName.textContent = savedUser.name || `كود: ${savedUser.code}`;
      if (dom.userHeaderArea) dom.userHeaderArea.textContent = savedUser.area || 'معمل أكيوريت';
      if (dom.userHeaderAvatar) dom.userHeaderAvatar.textContent = (savedUser.name || 'م').charAt(0);

      renderEmployeeViews();
    }
  }

  function setupAuthForms() {
    // 1. Main Login Form with 4-Digit Code
    if (dom.mainLoginForm) {
      dom.mainLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = dom.mainEmployeeCodeInput.value.trim();
        if (!code || code.length !== 4) {
          showToast('يرجى إدخال الكود الرباعي المكون من 4 أرقام', 'error');
          return;
        }

        const employees = await db.getEmployees();
        let employee = employees.find(emp => emp.code === code);

        if (!employee) {
          showToast('هذا الكود غير مسجل بالنظام! يرجى التواصل مع إدارة المعمل', 'error');
          return;
        }

        // If new code needing registration
        if (!employee.isRegistered || !employee.name) {
          state.pendingRegistrationCode = code;
          if (dom.registerModal) dom.registerModal.classList.add('active');
          showToast('كود جديد! يرجى استكمال بياناتك الشخصية للربط', 'info');
        } else {
          // Logged in directly
          saveLocal(STORAGE_KEYS.USER, employee);
          playSound('success');
          // Play bubble transition
          if (dom.pageTransitionOverlay) {
            dom.pageTransitionOverlay.classList.add('animating');
            setTimeout(() => {
              updateAuthViews();
              dom.pageTransitionOverlay.classList.remove('animating');
            }, 500);
          } else {
            updateAuthViews();
          }
          showToast(`أهلاً بك مجدداً د. ${employee.name} في Accurate Lab`, 'success');
        }
      });
    }

    // 2. New Employee Registration Form
    if (dom.registerForm) {
      dom.registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = dom.regName.value.trim();
        const area = dom.regArea.value.trim();
        const phone = dom.regPhone.value.trim();

        if (!name || !area || !phone) {
          showToast('يرجى ملء جميع البيانات لإتمام التسجيل', 'error');
          return;
        }

        try {
          const registered = await db.registerEmployee(state.pendingRegistrationCode, { name, area, phone });
          saveLocal(STORAGE_KEYS.USER, registered);
          dom.registerModal.classList.remove('active');
          playSound('success');

          if (dom.pageTransitionOverlay) {
            dom.pageTransitionOverlay.classList.add('animating');
            setTimeout(() => {
              updateAuthViews();
              dom.pageTransitionOverlay.classList.remove('animating');
            }, 500);
          } else {
            updateAuthViews();
          }

          showToast(`تم تسجيل بياناتك بنجاح! مرحباً بك د. ${name}`, 'success');
        } catch (err) {
          showToast(err.message || 'فشل حفظ بيانات التسجيل', 'error');
        }
      });
    }

    // 3. Logout Button
    if (dom.logoutBtn) {
      dom.logoutBtn.addEventListener('click', () => {
        if (confirm('هل ترغب في تسجيل الخروج من حسابك؟')) {
          localStorage.removeItem(STORAGE_KEYS.USER);
          state.currentEmployee = null;
          if (dom.mainEmployeeCodeInput) dom.mainEmployeeCodeInput.value = '';
          updateAuthViews();
          showToast('تم تسجيل الخروج بنجاح', 'info');
        }
      });
    }
  }

  /* =========================================================
     PAGE 1: ATTENDANCE CONTROLLER
     ========================================================= */
  function setupAttendanceActions() {
    const actions = [
      { btn: dom.btnMorningIn, type: 'morning_in', label: 'تسجيل دخول صباحي' },
      { btn: dom.btnMorningOut, type: 'morning_out', label: 'تسجيل خروج صباحي' },
      { btn: dom.btnEveningIn, type: 'evening_in', label: 'تسجيل دخول مسائي' },
      { btn: dom.btnEveningOut, type: 'evening_out', label: 'تسجيل خروج مسائي' }
    ];

    actions.forEach(({ btn, type, label }) => {
      if (!btn) return;
      btn.addEventListener('click', async () => {
        if (!state.currentEmployee) {
          showToast('يرجى تسجيل الدخول أولاً', 'error');
          updateAuthViews();
          return;
        }

        btn.disabled = true;
        btn.textContent = 'جاري التسجيل...';

        try {
          await db.recordAttendance({
            employeeCode: state.currentEmployee.code,
            employeeName: state.currentEmployee.name,
            employeePhone: state.currentEmployee.phone,
            employeeArea: state.currentEmployee.area,
            actionType: type
          });

          playSound('checkin');
          showToast(`تم ${label} بنجاح وإرسال التقرير للإدارة فوراً ⚡`, 'success', 4000);
        } catch (err) {
          showToast(err.message || 'فشل تسجيل الحركة', 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = 'تسجيل الآن';
        }
      });
    });
  }

  function updateAttendanceCardsView() {
    if (!state.currentEmployee) return;

    const todayIso = new Date().toISOString().split('T')[0];
    const myRecordsToday = state.allAttendance.filter(
      r => r.employeeCode === state.currentEmployee.code && r.date === todayIso
    );

    const doneTypes = {};
    myRecordsToday.forEach(r => {
      doneTypes[r.actionType] = r.time;
    });

    // Morning In
    if (dom.cardMorningIn && dom.statusMorningIn && dom.btnMorningIn) {
      if (doneTypes.morning_in) {
        dom.cardMorningIn.classList.add('done');
        dom.statusMorningIn.className = 'badge badge-success';
        dom.statusMorningIn.textContent = `تم: ${doneTypes.morning_in}`;
        dom.btnMorningIn.textContent = 'تسجيل مجدداً';
      } else {
        dom.cardMorningIn.classList.remove('done');
        dom.statusMorningIn.className = 'badge';
        dom.statusMorningIn.textContent = 'لم يسجل بعد';
        dom.btnMorningIn.textContent = 'تسجيل الآن';
      }
    }

    // Morning Out
    if (dom.cardMorningOut && dom.statusMorningOut && dom.btnMorningOut) {
      if (doneTypes.morning_out) {
        dom.cardMorningOut.classList.add('done');
        dom.statusMorningOut.className = 'badge badge-success';
        dom.statusMorningOut.textContent = `تم: ${doneTypes.morning_out}`;
        dom.btnMorningOut.textContent = 'تسجيل مجدداً';
      } else {
        dom.cardMorningOut.classList.remove('done');
        dom.statusMorningOut.className = 'badge';
        dom.statusMorningOut.textContent = 'لم يسجل بعد';
        dom.btnMorningOut.textContent = 'تسجيل الآن';
      }
    }

    // Evening In
    if (dom.cardEveningIn && dom.statusEveningIn && dom.btnEveningIn) {
      if (doneTypes.evening_in) {
        dom.cardEveningIn.classList.add('done');
        dom.statusEveningIn.className = 'badge badge-success';
        dom.statusEveningIn.textContent = `تم: ${doneTypes.evening_in}`;
        dom.btnEveningIn.textContent = 'تسجيل مجدداً';
      } else {
        dom.cardEveningIn.classList.remove('done');
        dom.statusEveningIn.className = 'badge';
        dom.statusEveningIn.textContent = 'لم يسجل بعد';
        dom.btnEveningIn.textContent = 'تسجيل الآن';
      }
    }

    // Evening Out
    if (dom.cardEveningOut && dom.statusEveningOut && dom.btnEveningOut) {
      if (doneTypes.evening_out) {
        dom.cardEveningOut.classList.add('done');
        dom.statusEveningOut.className = 'badge badge-success';
        dom.statusEveningOut.textContent = `تم: ${doneTypes.evening_out}`;
        dom.btnEveningOut.textContent = 'تسجيل مجدداً';
      } else {
        dom.cardEveningOut.classList.remove('done');
        dom.statusEveningOut.className = 'badge';
        dom.statusEveningOut.textContent = 'لم يسجل بعد';
        dom.btnEveningOut.textContent = 'تسجيل الآن';
      }
    }

    const recordedCount = Object.keys(doneTypes).length;
    if (dom.todaySummaryBadge) {
      dom.todaySummaryBadge.textContent = `${recordedCount} من 4 مسجلة اليوم`;
    }

    // History List
    const myAllRecords = state.allAttendance.filter(
      r => r.employeeCode === state.currentEmployee.code
    );

    if (dom.attendanceHistoryCount) {
      dom.attendanceHistoryCount.textContent = `${myAllRecords.length} حركة`;
    }

    if (dom.attendanceHistoryList) {
      if (myAllRecords.length === 0) {
        dom.attendanceHistoryList.innerHTML = `
          <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted);">
            لم تسجل أي حركات حضور أو انصراف حتى الآن.
          </div>
        `;
      } else {
        dom.attendanceHistoryList.innerHTML = myAllRecords.slice(0, 15).map(item => `
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
     PAGE 2: REWARDS & DEDUCTIONS CONTROLLER
     ========================================================= */
  function updateRewardsView() {
    if (!state.currentEmployee) return;

    const myRewards = state.allRewards.filter(
      r => r.employeeCode === state.currentEmployee.code
    );

    let totalRewards = 0;
    let totalDeductions = 0;

    myRewards.forEach(item => {
      const val = parseFloat(item.amount) || 0;
      if (item.type === 'reward') {
        totalRewards += val;
      } else {
        totalDeductions += val;
      }
    });

    const netBalance = totalRewards - totalDeductions;

    if (dom.totalRewardsSum) dom.totalRewardsSum.textContent = `${totalRewards.toLocaleString('ar-EG')} ج.م`;
    if (dom.totalDeductionsSum) dom.totalDeductionsSum.textContent = `${totalDeductions.toLocaleString('ar-EG')} ج.م`;
    if (dom.netRewardsSum) {
      dom.netRewardsSum.textContent = `${netBalance.toLocaleString('ar-EG')} ج.م`;
      dom.netRewardsSum.className = `summary-amount ${netBalance >= 0 ? 'green' : 'red'}`;
    }

    if (dom.rewardsListContainer) {
      if (myRewards.length === 0) {
        dom.rewardsListContainer.innerHTML = `
          <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
            لا توجد مكافآت أو خصومات مسجلة لك حتى الآن.
          </div>
        `;
      } else {
        dom.rewardsListContainer.innerHTML = myRewards.map(item => `
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
     PAGE 3: SUPPLIES CONTROLLER
     ========================================================= */
  function updateSuppliesView() {
    if (dom.suppliesCatalogGrid) {
      if (state.allSupplies.length === 0) {
        dom.suppliesCatalogGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">
            لا توجد مستلزمات مضافة بالكتالوج حالياً. يمكنك كتابة اسم المستلزم المطلوب بالأسفل.
          </div>
        `;
      } else {
        dom.suppliesCatalogGrid.innerHTML = state.allSupplies.map(item => `
          <div class="supply-card" data-supply-name="${item.name}">
            <div class="supply-img-wrapper">
              ${item.imageUrl ? `
                <img src="${getOptimizedImageUrl(item.imageUrl, 250)}" alt="${item.name}" class="supply-img" loading="lazy">
              ` : `
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
              <button type="button" class="btn btn-secondary btn-sm btn-quick-order" data-name="${item.name}">
                + طلب هذا المستلزم
              </button>
            </div>
          </div>
        `).join('');

        // Attach quick order buttons
        document.querySelectorAll('.btn-quick-order').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const name = btn.dataset.name;
            if (dom.supplySelect) dom.supplySelect.value = name;
            if (dom.supplyQuantity) dom.supplyQuantity.focus();
            playSound('bubble');
            showToast(`تم اختيار [ ${name} ]. حدد الكمية واضغط إرسال`, 'info', 2500);
          });
        });
      }
    }

    // My supply orders
    if (!state.currentEmployee) return;

    const myOrders = state.allSupplyRequests.filter(
      r => r.employeeCode === state.currentEmployee.code
    );

    if (dom.mySupplyOrdersList) {
      if (myOrders.length === 0) {
        dom.mySupplyOrdersList.innerHTML = `
          <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
            لم تقم بإرسال أي طلبات مستلزمات حتى الآن.
          </div>
        `;
      } else {
        dom.mySupplyOrdersList.innerHTML = myOrders.map(order => {
          let statusBadge = '<span class="badge badge-amber">قيد المراجعة</span>';
          if (order.status === 'completed' || order.status === 'approved') {
            statusBadge = '<span class="badge badge-success">تم الصرف والتجهيز ✅</span>';
          } else if (order.status === 'cancelled') {
            statusBadge = '<span class="badge badge-danger">تم الإلغاء ❌</span>';
          }

          return `
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
              <div>${statusBadge}</div>
            </div>
          `;
        }).join('');
      }
    }
  }

  function setupSupplyOrderForm() {
    if (dom.orderSupplyForm) {
      dom.orderSupplyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.currentEmployee) {
          showToast('يرجى تسجيل الدخول أولاً', 'error');
          return;
        }

        const supplyName = dom.supplySelect.value.trim();
        const quantity = dom.supplyQuantity.value.trim();
        const notes = dom.supplyNotes.value.trim();

        if (!supplyName || !quantity) {
          showToast('يرجى تحديد المستلزم والكمية المطلوبة', 'error');
          return;
        }

        try {
          await db.submitSupplyRequest({
            employeeCode: state.currentEmployee.code,
            employeeName: state.currentEmployee.name,
            employeePhone: state.currentEmployee.phone,
            employeeArea: state.currentEmployee.area,
            supplyName,
            quantity,
            notes
          });

          dom.orderSupplyForm.reset();
          playSound('success');
          showToast('تم إرسال طلب المستلزمات للإدارة بنجاح مع كافة بياناتك 📦', 'success');
        } catch (err) {
          showToast(err.message || 'فشل إرسال الطلب', 'error');
        }
      });
    }
  }

  /* =========================================================
     PAGE 4: LEAVE REQUEST CONTROLLER
     ========================================================= */
  function setupLeaveController() {
    const today = new Date().toISOString().split('T')[0];
    if (dom.leaveStartDate) {
      dom.leaveStartDate.min = today;
      dom.leaveStartDate.value = today;
    }

    // Cloudinary upload
    if (dom.leaveUploadDropzone && dom.leaveFileInput) {
      dom.leaveUploadDropzone.addEventListener('click', (e) => {
        if (e.target.closest('#btnRemoveLeaveAttachment')) return;
        dom.leaveFileInput.click();
      });

      dom.leaveFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        dom.leaveUploadProgress.style.display = 'block';
        dom.leaveProgressBarInner.style.width = '0%';
        dom.leaveUploadProgressText.textContent = 'جاري الرفع إلى Cloudinary... (0%)';

        try {
          const res = await uploadToCloudinary(file, (percent) => {
            dom.leaveProgressBarInner.style.width = percent + '%';
            dom.leaveUploadProgressText.textContent = 'جاري الرفع... (' + percent + '%)';
          });

          state.uploadedLeaveFile = res;
          dom.leaveUploadProgress.style.display = 'none';
          dom.leaveUploadPreview.style.display = 'inline-block';
          dom.leavePreviewImg.src = getOptimizedImageUrl(res.secure_url, 150);
          playSound('success');
          showToast('تم رفع المرفق إلى Cloudinary بنجاح ✅', 'success');
        } catch (err) {
          dom.leaveUploadProgress.style.display = 'none';
          showToast(err.message || 'فشل رفع الملف', 'error');
        }
      });
    }

    if (dom.btnRemoveLeaveAttachment) {
      dom.btnRemoveLeaveAttachment.addEventListener('click', (e) => {
        e.stopPropagation();
        state.uploadedLeaveFile = null;
        dom.leaveUploadPreview.style.display = 'none';
        dom.leavePreviewImg.src = '';
        dom.leaveFileInput.value = '';
      });
    }

    if (dom.leaveRequestForm) {
      dom.leaveRequestForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.currentEmployee) {
          showToast('يرجى تسجيل الدخول أولاً', 'error');
          return;
        }

        const daysCount = dom.leaveDaysCount.value;
        const startDate = dom.leaveStartDate.value;
        const leaveType = dom.leaveType.value;
        const reason = dom.leaveReason.value.trim();

        if (!daysCount || !startDate || !reason) {
          showToast('يرجى تعبئة كافة الحقول المطلوبة', 'error');
          return;
        }

        try {
          await db.submitLeaveRequest({
            employeeCode: state.currentEmployee.code,
            employeeName: state.currentEmployee.name,
            employeePhone: state.currentEmployee.phone,
            employeeArea: state.currentEmployee.area,
            daysCount,
            startDate,
            leaveType,
            reason,
            attachmentUrl: state.uploadedLeaveFile ? state.uploadedLeaveFile.secure_url : '',
            attachmentPublicId: state.uploadedLeaveFile ? state.uploadedLeaveFile.public_id : ''
          });

          dom.leaveRequestForm.reset();
          state.uploadedLeaveFile = null;
          if (dom.leaveUploadPreview) dom.leaveUploadPreview.style.display = 'none';
          if (dom.leaveStartDate) dom.leaveStartDate.value = today;
          playSound('success');
          showToast('تم إرسال طلب الإجازة للإدارة بنجاح! سيتم إعلامك بالرد فوراً 🏖️', 'success');
        } catch (err) {
          showToast(err.message || 'فشل إرسال طلب الإجازة', 'error');
        }
      });
    }
  }

  function updateLeaveRequestsView() {
    if (!state.currentEmployee) return;

    const myLeaves = state.allLeaveRequests.filter(
      r => r.employeeCode === state.currentEmployee.code
    );

    if (dom.myLeaveRequestsList) {
      if (myLeaves.length === 0) {
        dom.myLeaveRequestsList.innerHTML = `
          <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
            لا توجد طلبات إجازة مسجلة لك حتى الآن.
          </div>
        `;
      } else {
        dom.myLeaveRequestsList.innerHTML = myLeaves.map(leave => {
          let statusBadge = '<span class="badge badge-amber">⏳ قيد المراجعة</span>';
          if (leave.status === 'approved') {
            statusBadge = '<span class="badge badge-success">✅ تمت الموافقة على الإجازة</span>';
          } else if (leave.status === 'rejected') {
            statusBadge = '<span class="badge badge-danger">❌ تم رفض الإجازة</span>';
          }

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
                  <a href="${leave.attachmentUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 0.78rem; font-weight: 700; color: var(--primary); display: inline-flex; align-items: center; gap: 0.25rem;">
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

  /* =========================================================
     ADMIN DASHBOARD CONTROLLER (PIN: 4k4k)
     ========================================================= */
  function setupAdminDashboard() {
    // 1. Floating Action Button Click
    if (dom.fabAdminBtn) {
      dom.fabAdminBtn.addEventListener('click', () => {
        playSound('bubble');
        const isAuth = sessionStorage.getItem(STORAGE_KEYS.ADMIN_AUTH) === 'true';
        if (isAuth) {
          dom.adminDashboardModal.classList.add('active');
          renderAdminViews();
        } else {
          dom.adminPinModal.classList.add('active');
          dom.adminPinInput.value = '';
          setTimeout(() => dom.adminPinInput.focus(), 150);
        }
      });
    }

    // Close PIN Modal
    dom.closeAdminPinBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.adminPinModal.classList.remove('active');
      });
    });

    // Submit PIN Form (4k4k)
    if (dom.adminPinForm) {
      dom.adminPinForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const pin = dom.adminPinInput.value.trim();
        if (pin.toLowerCase() === ADMIN_PIN.toLowerCase()) {
          sessionStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, 'true');
          dom.adminPinModal.classList.remove('active');
          dom.adminDashboardModal.classList.add('active');
          playSound('success');
          showToast('تم تسجيل الدخول بنجاح إلى لوحة تحكم إدارة Accurate Lab 🔐', 'success');
          renderAdminViews();
        } else {
          showToast('الرقم السري غير صحيح! (الرقم هو 4k4k)', 'error');
        }
      });
    }

    // Close Dashboard Modal
    if (dom.closeAdminDashboardBtn) {
      dom.closeAdminDashboardBtn.addEventListener('click', () => {
        dom.adminDashboardModal.classList.remove('active');
      });
    }

    // Admin Tabs Navigation
    dom.adminTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const paneKey = btn.dataset.pane;
        dom.adminTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        Object.keys(dom.adminPanes).forEach(k => {
          if (dom.adminPanes[k]) {
            dom.adminPanes[k].classList.toggle('active', k === paneKey);
          }
        });
        playSound('bubble');
      });
    });

    // 2. Generate Random 4-digit code on click and add to server
    if (dom.btnGenerateCode) {
      dom.btnGenerateCode.addEventListener('click', async () => {
        dom.btnGenerateCode.disabled = true;
        dom.btnGenerateCode.textContent = 'جاري التوليد...';

        try {
          const emp = await db.generateEmployeeCode();
          dom.generatedCodeDisplay.style.display = 'block';
          dom.generatedCodeDisplay.textContent = `الكود الجديد: ${emp.code}`;
          playSound('success');
          showToast(`تم توليد الكود الرباعي [ ${emp.code} ] وإضافته للسيرفر فوراً ⚡`, 'success', 5000);
          renderAdminViews();
        } catch (err) {
          showToast(err.message || 'فشل توليد الكود', 'error');
        } finally {
          dom.btnGenerateCode.disabled = false;
          dom.btnGenerateCode.textContent = '⚡ توليد كود موظف جديد';
        }
      });
    }

    // 3. Admin Send Reward or Deduction
    if (dom.adminRewardForm) {
      dom.adminRewardForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = dom.rewardEmployeeSelect.value;
        const type = $('rewardType').value;
        const amount = $('rewardAmount').value;
        const reason = $('rewardReason').value;

        if (!code || !amount || !reason) {
          showToast('يرجى تحديد الموظف والمبلغ والسبب', 'error');
          return;
        }

        const employee = state.allEmployees.find(emp => emp.code === code);

        try {
          await db.addRewardDeduction({
            employeeCode: code,
            employeeName: employee ? employee.name : '',
            employeeArea: employee ? employee.area : '',
            type,
            amount,
            reason
          });

          dom.adminRewardForm.reset();
          playSound('success');
          showToast('تم إرسال المكافأة/الخصم للموظف بنجاح 💰', 'success');
          renderAdminViews();
        } catch (err) {
          showToast(err.message || 'فشل إرسال الإجراء', 'error');
        }
      });
    }

    // 4. Admin Add Supply with Cloudinary Upload
    if (dom.supplyUploadDropzone && dom.supplyFileInput) {
      dom.supplyUploadDropzone.addEventListener('click', (e) => {
        if (e.target.closest('#btnRemoveSupplyImg')) return;
        dom.supplyFileInput.click();
      });

      dom.supplyFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        dom.supplyUploadProgress.style.display = 'block';
        dom.supplyProgressBarInner.style.width = '0%';
        dom.supplyUploadProgressText.textContent = 'جاري الرفع إلى Cloudinary... (0%)';

        try {
          const res = await uploadToCloudinary(file, (percent) => {
            dom.supplyProgressBarInner.style.width = percent + '%';
            dom.supplyUploadProgressText.textContent = 'جاري الرفع... (' + percent + '%)';
          });

          state.uploadedSupplyFile = res;
          dom.supplyUploadProgress.style.display = 'none';
          dom.supplyUploadPreview.style.display = 'inline-block';
          dom.supplyPreviewImg.src = getOptimizedImageUrl(res.secure_url, 150);
          playSound('success');
          showToast('تم رفع صورة المستلزم بنجاح إلى Cloudinary ✅', 'success');
        } catch (err) {
          dom.supplyUploadProgress.style.display = 'none';
          showToast(err.message || 'فشل رفع صورة المستلزم', 'error');
        }
      });
    }

    if (dom.btnRemoveSupplyImg) {
      dom.btnRemoveSupplyImg.addEventListener('click', (e) => {
        e.stopPropagation();
        state.uploadedSupplyFile = null;
        dom.supplyUploadPreview.style.display = 'none';
        dom.supplyPreviewImg.src = '';
        dom.supplyFileInput.value = '';
      });
    }

    if (dom.adminAddSupplyForm) {
      dom.adminAddSupplyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = $('newSupplyName').value.trim();
        const category = $('newSupplyCategory').value.trim();
        const notes = $('newSupplyNotes').value.trim();

        if (!name) {
          showToast('اسم المستلزم مطلوب', 'error');
          return;
        }

        try {
          await db.addSupplyItem({
            name,
            category,
            unit: category,
            imageUrl: state.uploadedSupplyFile ? state.uploadedSupplyFile.secure_url : '',
            imagePublicId: state.uploadedSupplyFile ? state.uploadedSupplyFile.public_id : '',
            notes
          });

          dom.adminAddSupplyForm.reset();
          state.uploadedSupplyFile = null;
          dom.supplyUploadPreview.style.display = 'none';
          playSound('success');
          showToast(`تمت إضافة [ ${name} ] لكتالوج المعمل لجميع الموظفين بنجاح 📦`, 'success');
          renderAdminViews();
        } catch (err) {
          showToast(err.message || 'فشل إضافة المستلزم', 'error');
        }
      });
    }
  }

  function renderAdminViews() {
    // 1. Employees Table
    if (dom.adminCodesCount) dom.adminCodesCount.textContent = `${state.allEmployees.length} كود`;
    if (dom.adminEmployeesTableBody) {
      if (state.allEmployees.length === 0) {
        dom.adminEmployeesTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">لا توجد أكواد مولدة بعد</td></tr>`;
      } else {
        dom.adminEmployeesTableBody.innerHTML = state.allEmployees.map(emp => `
          <tr>
            <td><strong style="color: var(--primary); letter-spacing: 0.1em;">${emp.code}</strong></td>
            <td>
              <span class="badge ${emp.isRegistered ? 'badge-success' : 'badge-amber'}">
                ${emp.isRegistered ? 'مسجل ومفعل' : 'غير مسجل بعد'}
              </span>
            </td>
            <td>${emp.name || '-'}</td>
            <td>${emp.area || '-'}</td>
            <td>${emp.phone || '-'}</td>
            <td>
              <button class="btn btn-danger btn-sm btn-delete-emp" data-code="${emp.code}" title="حذف الكود">
                حذف
              </button>
            </td>
          </tr>
        `).join('');

        document.querySelectorAll('.btn-delete-emp').forEach(btn => {
          btn.addEventListener('click', async () => {
            const code = btn.dataset.code;
            if (confirm(`هل أنت متأكد من حذف كود الموظف [ ${code} ]؟`)) {
              await db.deleteEmployee(code);
              showToast(`تم حذف كود الموظف [ ${code} ]`, 'info');
              renderAdminViews();
            }
          });
        });
      }
    }

    // Populate employee select in Rewards tab
    if (dom.rewardEmployeeSelect) {
      const prev = dom.rewardEmployeeSelect.value;
      dom.rewardEmployeeSelect.innerHTML = `<option value="">اختر موظفاً...</option>` + state.allEmployees.map(emp => `
        <option value="${emp.code}">${emp.name ? `د. ${emp.name} (كود: ${emp.code} - ${emp.area})` : `كود: ${emp.code} (غير مسجل)`}</option>
      `).join('');
      if (prev) dom.rewardEmployeeSelect.value = prev;
    }

    // 2. Rewards Table
    if (dom.adminRewardsTableBody) {
      if (state.allRewards.length === 0) {
        dom.adminRewardsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">لا توجد مكافآت أو خصومات مسجلة</td></tr>`;
      } else {
        dom.adminRewardsTableBody.innerHTML = state.allRewards.map(item => `
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
              <button class="btn btn-danger btn-sm btn-delete-reward" data-id="${item.id}">
                حذف
              </button>
            </td>
          </tr>
        `).join('');

        document.querySelectorAll('.btn-delete-reward').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (confirm('هل أنت متأكد من حذف هذا السجل؟')) {
              await db.deleteReward(btn.dataset.id);
              showToast('تم حذف السجل بنجاح', 'info');
              renderAdminViews();
            }
          });
        });
      }
    }

    // 3. Live Attendance Feed
    if (dom.adminAttendanceCount) dom.adminAttendanceCount.textContent = `${state.allAttendance.length} حركة`;
    if (dom.adminAttendanceTableBody) {
      if (state.allAttendance.length === 0) {
        dom.adminAttendanceTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">لا توجد حركات حضور مسجلة بعد</td></tr>`;
      } else {
        dom.adminAttendanceTableBody.innerHTML = state.allAttendance.map(item => `
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
              <button class="btn btn-danger btn-sm btn-delete-attendance" data-id="${item.id}">
                حذف
              </button>
            </td>
          </tr>
        `).join('');

        document.querySelectorAll('.btn-delete-attendance').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (confirm('هل أنت متأكد من حذف حركة الحضور هذه؟')) {
              await db.deleteAttendance(btn.dataset.id);
              showToast('تم حذف سجل الحركة', 'info');
              renderAdminViews();
            }
          });
        });
      }
    }

    // 4. Admin Leaves Management
    if (dom.adminLeavesCount) dom.adminLeavesCount.textContent = `${state.allLeaveRequests.length} طلب`;
    if (dom.adminLeavesListContainer) {
      if (state.allLeaveRequests.length === 0) {
        dom.adminLeavesListContainer.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">لا توجد طلبات إجازة واردة</div>`;
      } else {
        dom.adminLeavesListContainer.innerHTML = state.allLeaveRequests.map(leave => {
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
                <button class="btn btn-success btn-sm btn-approve-leave" data-id="${leave.id}">
                  ✅ موافقة
                </button>
                <button class="btn btn-danger btn-sm btn-reject-leave" data-id="${leave.id}">
                  ❌ رفض
                </button>
                <button class="btn btn-secondary btn-sm btn-delete-leave" data-id="${leave.id}" style="color: var(--accent-red);">
                  🗑️ حذف
                </button>
              </div>
            </div>
          `;
        }).join('');

        document.querySelectorAll('.btn-approve-leave').forEach(btn => {
          btn.addEventListener('click', async () => {
            await db.updateLeaveRequestStatus(btn.dataset.id, 'approved', 'تمت الموافقة من إدارة المعمل');
            playSound('success');
            showToast('تمت الموافقة على طلب الإجازة وإعلام الموظف ✅', 'success');
            renderAdminViews();
          });
        });

        document.querySelectorAll('.btn-reject-leave').forEach(btn => {
          btn.addEventListener('click', async () => {
            const note = prompt('أدخل سبب الرفض إن وجد:') || '';
            await db.updateLeaveRequestStatus(btn.dataset.id, 'rejected', note || 'تم الرفض لظروف العمل بالمعمل');
            showToast('تم تسجيل رفض طلب الإجازة وإعلام الموظف ❌', 'info');
            renderAdminViews();
          });
        });

        document.querySelectorAll('.btn-delete-leave').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (confirm('هل أنت متأكد من حذف هذا الطلب؟')) {
              await db.deleteLeaveRequest(btn.dataset.id);
              showToast('تم حذف طلب الإجازة بنجاح', 'info');
              renderAdminViews();
            }
          });
        });
      }
    }

    // 5. Admin Supplies Catalog & Orders
    if (dom.adminSuppliesCatalogTableBody) {
      if (state.allSupplies.length === 0) {
        dom.adminSuppliesCatalogTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">لا توجد مستلزمات مضافة بالكتالوج</td></tr>`;
      } else {
        dom.adminSuppliesCatalogTableBody.innerHTML = state.allSupplies.map(item => `
          <tr>
            <td>
              ${item.imageUrl ? `
                <img src="${getOptimizedImageUrl(item.imageUrl, 50)}" alt="${item.name}" style="width: 36px; height: 36px; border-radius: 6px; object-fit: cover;">
              ` : '-'}
            </td>
            <td><strong>${item.name}</strong></td>
            <td>${item.unit || item.category || '-'}</td>
            <td>
              <button class="btn btn-danger btn-sm btn-delete-supply-item" data-id="${item.id}">
                حذف
              </button>
            </td>
          </tr>
        `).join('');

        document.querySelectorAll('.btn-delete-supply-item').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (confirm('هل تريد حذف هذا المستلزم من الكتالوج العام؟')) {
              await db.deleteSupplyItem(btn.dataset.id);
              showToast('تم حذف المستلزم من الكتالوج', 'info');
              renderAdminViews();
            }
          });
        });
      }
    }

    // Incoming supply orders
    if (dom.adminSupplyOrdersCount) dom.adminSupplyOrdersCount.textContent = `${state.allSupplyRequests.length} طلب`;
    if (dom.adminSupplyOrdersList) {
      if (state.allSupplyRequests.length === 0) {
        dom.adminSupplyOrdersList.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">لا توجد طلبات مستلزمات واردة</div>`;
      } else {
        dom.adminSupplyOrdersList.innerHTML = state.allSupplyRequests.map(order => `
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
                <button class="btn btn-success btn-sm btn-complete-order" data-id="${order.id}">
                  ✅ تأكيد الصرف
                </button>
              ` : ''}
              <button class="btn btn-danger btn-sm btn-delete-supply-order" data-id="${order.id}">
                🗑️ حذف الطلب
              </button>
            </div>
          </div>
        `).join('');

        document.querySelectorAll('.btn-complete-order').forEach(btn => {
          btn.addEventListener('click', async () => {
            await db.updateSupplyRequestStatus(btn.dataset.id, 'completed');
            playSound('success');
            showToast('تم تأكيد صرف المستلزم للموظف بنجاح ✅', 'success');
            renderAdminViews();
          });
        });

        document.querySelectorAll('.btn-delete-supply-order').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (confirm('هل أنت متأكد من حذف هذا الطلب؟')) {
              await db.deleteSupplyRequest(btn.dataset.id);
              showToast('تم حذف طلب المستلزم بنجاح', 'info');
              renderAdminViews();
            }
          });
        });
      }
    }
  }

  function renderEmployeeViews() {
    updateAttendanceCardsView();
    updateRewardsView();
    updateSuppliesView();
    updateLeaveRequestsView();
  }

  /* =========================================================
     SETUP DATA LISTENERS
     ========================================================= */
  function setupDataListeners() {
    db.listenAll({
      onEmployees(list) {
        state.allEmployees = list;
        if (state.currentEmployee) {
          const self = list.find(e => e.code === state.currentEmployee.code);
          if (self) {
            state.currentEmployee = self;
            saveLocal(STORAGE_KEYS.USER, self);
          }
        }
        renderAdminViews();
      },
      onAttendance(list) {
        state.allAttendance = list;
        updateAttendanceCardsView();
        renderAdminViews();
      },
      onRewards(list) {
        state.allRewards = list;
        updateRewardsView();
        renderAdminViews();
      },
      onSupplies(list) {
        state.allSupplies = list;
        updateSuppliesView();
        renderAdminViews();
      },
      onSupplyRequests(list) {
        state.allSupplyRequests = list;
        updateSuppliesView();
        renderAdminViews();
      },
      onLeaveRequests(list) {
        state.allLeaveRequests = list;
        updateLeaveRequestsView();
        renderAdminViews();
      }
    });
  }

  /* =========================================================
     APP BOOTSTRAP
     ========================================================= */
  function init() {
    initTheme();
    setupNavigation();
    initLiveClock();
    setupAuthForms();
    setupAttendanceActions();
    setupSupplyOrderForm();
    setupLeaveController();
    setupAdminDashboard();
    setupDataListeners();
    updateAuthViews();
    console.log('🚀 Accurate Lab Engine initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
