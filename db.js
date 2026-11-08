import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  push,
  onValue,
  remove,
  update,
  child,
  query,
  orderByChild
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";
import { firebaseConfig } from './config.js';

// Initialize Firebase App & Realtime Database
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Action labels in Arabic
export const ATTENDANCE_LABELS = {
  morning_in: 'تسجيل دخول صباحي',
  morning_out: 'تسجيل خروج صباحي',
  evening_in: 'تسجيل دخول مسائي',
  evening_out: 'تسجيل خروج مسائي'
};

// Formats timestamp to Arabic readable date & time
export function formatArabicDateTime(timestamp = Date.now()) {
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

/* ========================================================
   EMPLOYEE OPERATIONS
   ======================================================== */

/**
 * Generate a random 4-digit code and save to Firebase server
 */
export async function generateEmployeeCode() {
  const employeesRef = ref(db, 'employees');
  const snapshot = await get(employeesRef);
  const existing = snapshot.val() || {};

  // Try generating a unique 4-digit code
  let code = '';
  let attempts = 0;
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
    attempts++;
  } while (existing[code] && attempts < 100);

  const employeeData = {
    code,
    isRegistered: false,
    name: '',
    phone: '',
    area: '',
    createdAt: Date.now()
  };

  await set(ref(db, `employees/${code}`), employeeData);
  return employeeData;
}

/**
 * Fetch employee data by 4-digit code
 */
export async function getEmployeeByCode(code) {
  if (!code) return null;
  const snapshot = await get(ref(db, `employees/${code}`));
  return snapshot.exists() ? snapshot.val() : null;
}

/**
 * Register employee details on first login
 */
export async function registerEmployee(code, { name, phone, area }) {
  if (!code || !name || !phone || !area) {
    throw new Error('جميع البيانات مطلوبة لإتمام التسجيل');
  }
  const employeeRef = ref(db, `employees/${code}`);
  const snapshot = await get(employeeRef);
  if (!snapshot.exists()) {
    throw new Error('كود الموظف غير موجود بالنظام');
  }

  const updates = {
    isRegistered: true,
    name: name.trim(),
    phone: phone.trim(),
    area: area.trim(),
    registeredAt: Date.now()
  };

  await update(employeeRef, updates);
  return { ...snapshot.val(), ...updates };
}

/**
 * Subscribe to all employees (for Admin)
 */
export function subscribeEmployees(callback) {
  return onValue(ref(db, 'employees'), (snapshot) => {
    const data = snapshot.val() || {};
    const list = Object.keys(data).map(key => ({ ...data[key], code: key }));
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(list);
  });
}

/**
 * Delete employee code (Admin)
 */
export async function deleteEmployee(code) {
  return remove(ref(db, `employees/${code}`));
}

/* ========================================================
   ATTENDANCE OPERATIONS
   ======================================================== */

/**
 * Record attendance (Morning / Evening - In / Out)
 */
export async function recordAttendance({ employeeCode, employeeName, employeePhone, employeeArea, actionType }) {
  if (!employeeCode || !actionType) {
    throw new Error('بيانات الحضور غير مكتملة');
  }

  const { dateStr, timeStr, isoDate } = formatArabicDateTime();
  const attendanceRef = ref(db, 'attendance');
  const newRef = push(attendanceRef);

  const record = {
    id: newRef.key,
    employeeCode,
    employeeName: employeeName || 'غير معروف',
    employeePhone: employeePhone || '',
    employeeArea: employeeArea || 'غير محدد',
    actionType,
    actionLabel: ATTENDANCE_LABELS[actionType] || actionType,
    date: isoDate,
    dateDisplay: dateStr,
    time: timeStr,
    timestamp: Date.now()
  };

  await set(newRef, record);
  return record;
}

/**
 * Subscribe to all attendance records (for Admin live feed)
 */
export function subscribeAttendance(callback) {
  return onValue(ref(db, 'attendance'), (snapshot) => {
    const data = snapshot.val() || {};
    const list = Object.keys(data).map(key => ({ ...data[key], id: key }));
    list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    callback(list);
  });
}

/**
 * Delete attendance record (Admin)
 */
export async function deleteAttendance(id) {
  return remove(ref(db, `attendance/${id}`));
}

/* ========================================================
   REWARDS & DEDUCTIONS OPERATIONS
   ======================================================== */

/**
 * Send reward or deduction to employee (Admin)
 */
export async function addRewardDeduction({ employeeCode, employeeName, employeeArea, type, amount, reason }) {
  if (!employeeCode || !type || !amount || !reason) {
    throw new Error('يرجى ملء جميع حقول المكافأة أو الخصم');
  }

  const { dateStr, timeStr, isoDate } = formatArabicDateTime();
  const rewardsRef = ref(db, 'rewards');
  const newRef = push(rewardsRef);

  const record = {
    id: newRef.key,
    employeeCode: employeeCode.toString().trim(),
    employeeName: employeeName || '',
    employeeArea: employeeArea || '',
    type, // 'reward' | 'deduction'
    amount: parseFloat(amount),
    reason: reason.trim(),
    date: isoDate,
    dateDisplay: dateStr,
    time: timeStr,
    timestamp: Date.now()
  };

  await set(newRef, record);
  return record;
}

/**
 * Subscribe to all rewards and deductions (Admin and Employee filtering)
 */
export function subscribeRewards(callback) {
  return onValue(ref(db, 'rewards'), (snapshot) => {
    const data = snapshot.val() || {};
    const list = Object.keys(data).map(key => ({ ...data[key], id: key }));
    list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    callback(list);
  });
}

/**
 * Delete reward/deduction record (Admin)
 */
export async function deleteReward(id) {
  return remove(ref(db, `rewards/${id}`));
}

/* ========================================================
   SUPPLIES CATALOG OPERATIONS
   ======================================================== */

/**
 * Add a new supply to catalog (Admin)
 */
export async function addSupplyItem({ name, category, unit, imageUrl, imagePublicId, notes }) {
  if (!name) {
    throw new Error('اسم المستلزم مطلوب');
  }

  const suppliesRef = ref(db, 'supplies');
  const newRef = push(suppliesRef);

  const item = {
    id: newRef.key,
    name: name.trim(),
    category: (category || 'عام').trim(),
    unit: (unit || 'قطعة').trim(),
    imageUrl: imageUrl || '',
    imagePublicId: imagePublicId || '',
    notes: (notes || '').trim(),
    createdAt: Date.now()
  };

  await set(newRef, item);
  return item;
}

/**
 * Subscribe to supplies catalog (for all employees & admin)
 */
export function subscribeSupplies(callback) {
  return onValue(ref(db, 'supplies'), (snapshot) => {
    const data = snapshot.val() || {};
    const list = Object.keys(data).map(key => ({ ...data[key], id: key }));
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(list);
  });
}

/**
 * Delete supply item (Admin)
 */
export async function deleteSupplyItem(id) {
  return remove(ref(db, `supplies/${id}`));
}

/* ========================================================
   SUPPLY REQUESTS OPERATIONS (Employee orders supply)
   ======================================================== */

/**
 * Employee submits supply request
 */
export async function submitSupplyRequest({
  employeeCode,
  employeeName,
  employeePhone,
  employeeArea,
  supplyId,
  supplyName,
  quantity,
  notes
}) {
  if (!employeeCode || !supplyName || !quantity) {
    throw new Error('يرجى تحديد المستلزم والكمية المطلوبة');
  }

  const { dateStr, timeStr, isoDate } = formatArabicDateTime();
  const reqRef = ref(db, 'supply_requests');
  const newRef = push(reqRef);

  const record = {
    id: newRef.key,
    employeeCode,
    employeeName,
    employeePhone,
    employeeArea,
    supplyId: supplyId || '',
    supplyName: supplyName.trim(),
    quantity: quantity.toString().trim(),
    notes: (notes || '').trim(),
    status: 'pending', // 'pending' | 'completed' | 'cancelled'
    date: isoDate,
    dateDisplay: dateStr,
    time: timeStr,
    createdAt: Date.now()
  };

  await set(newRef, record);
  return record;
}

/**
 * Subscribe to supply requests (Admin & filtered for Employee)
 */
export function subscribeSupplyRequests(callback) {
  return onValue(ref(db, 'supply_requests'), (snapshot) => {
    const data = snapshot.val() || {};
    const list = Object.keys(data).map(key => ({ ...data[key], id: key }));
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(list);
  });
}

/**
 * Update supply request status (Admin)
 */
export async function updateSupplyRequestStatus(id, status) {
  return update(ref(db, `supply_requests/${id}`), {
    status,
    updatedAt: Date.now()
  });
}

/**
 * Delete supply request (Admin)
 */
export async function deleteSupplyRequest(id) {
  return remove(ref(db, `supply_requests/${id}`));
}

/* ========================================================
   LEAVE REQUESTS OPERATIONS
   ======================================================== */

/**
 * Employee submits a leave request
 */
export async function submitLeaveRequest({
  employeeCode,
  employeeName,
  employeePhone,
  employeeArea,
  daysCount,
  startDate,
  leaveType,
  reason,
  attachmentUrl,
  attachmentPublicId
}) {
  if (!employeeCode || !daysCount || !startDate) {
    throw new Error('يرجى تحديد عدد الأيام وتاريخ بداية الإجازة');
  }

  const { dateStr, timeStr, isoDate } = formatArabicDateTime();
  const leaveRef = ref(db, 'leave_requests');
  const newRef = push(leaveRef);

  const record = {
    id: newRef.key,
    employeeCode,
    employeeName,
    employeePhone,
    employeeArea,
    daysCount: parseInt(daysCount, 10),
    startDate,
    leaveType: leaveType || 'اعتيادية',
    reason: (reason || '').trim(),
    attachmentUrl: attachmentUrl || '',
    attachmentPublicId: attachmentPublicId || '',
    status: 'pending', // 'pending' | 'approved' | 'rejected'
    adminNotes: '',
    date: isoDate,
    dateDisplay: dateStr,
    time: timeStr,
    createdAt: Date.now()
  };

  await set(newRef, record);
  return record;
}

/**
 * Subscribe to leave requests
 */
export function subscribeLeaveRequests(callback) {
  return onValue(ref(db, 'leave_requests'), (snapshot) => {
    const data = snapshot.val() || {};
    const list = Object.keys(data).map(key => ({ ...data[key], id: key }));
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(list);
  });
}

/**
 * Update leave request status (Admin approves / rejects)
 */
export async function updateLeaveRequestStatus(id, status, adminNotes = '') {
  return update(ref(db, `leave_requests/${id}`), {
    status, // 'approved' or 'rejected'
    adminNotes: (adminNotes || '').trim(),
    reviewedAt: Date.now()
  });
}

/**
 * Delete leave request (Admin)
 */
export async function deleteLeaveRequest(id) {
  return remove(ref(db, `leave_requests/${id}`));
}

