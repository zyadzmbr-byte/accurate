import { ADMIN_PIN } from './config.js';
import { getEmployeeByCode, registerEmployee } from './db.js';

const STORAGE_KEY_USER = 'accurate_lab_user';
const STORAGE_KEY_ADMIN = 'accurate_lab_admin_session';

/**
 * Get currently logged-in employee from localStorage
 */
export function getCurrentEmployee() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Save logged-in employee to localStorage
 */
export function setCurrentEmployee(employee) {
  if (employee) {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(employee));
  } else {
    localStorage.removeItem(STORAGE_KEY_USER);
  }
}

/**
 * Authenticate employee with 4-digit code
 * @param {string} code
 * @returns {Promise<{ status: 'success' | 'needs_registration', employee?: Object, code?: string }>}
 */
export async function authenticateEmployee(code) {
  const cleanCode = (code || '').toString().trim();
  if (!cleanCode || cleanCode.length !== 4) {
    throw new Error('يرجى إدخال كود رباعي صحيح (4 أرقام)');
  }

  const employee = await getEmployeeByCode(cleanCode);
  if (!employee) {
    throw new Error('هذا الكود غير موجود بالسيرفر. يرجى التواصل مع إدارة المعمل');
  }

  if (!employee.isRegistered || !employee.name) {
    return {
      status: 'needs_registration',
      code: cleanCode
    };
  }

  setCurrentEmployee(employee);
  return {
    status: 'success',
    employee
  };
}

/**
 * Complete new employee registration
 */
export async function finishEmployeeRegistration(code, { name, phone, area }) {
  const updated = await registerEmployee(code, { name, phone, area });
  setCurrentEmployee(updated);
  return updated;
}

/**
 * Employee Logout
 */
export function logoutEmployee() {
  setCurrentEmployee(null);
}

/**
 * Verify Admin PIN (4k4k)
 */
export function verifyAdminPin(pin) {
  const cleanPin = (pin || '').toString().trim();
  if (cleanPin.toLowerCase() === ADMIN_PIN.toLowerCase()) {
    sessionStorage.setItem(STORAGE_KEY_ADMIN, 'true');
    return true;
  }
  return false;
}

/**
 * Check if admin is currently authenticated in this browser session
 */
export function isAdminLoggedIn() {
  return sessionStorage.getItem(STORAGE_KEY_ADMIN) === 'true';
}

/**
 * Admin Logout
 */
export function logoutAdmin() {
  sessionStorage.removeItem(STORAGE_KEY_ADMIN);
}

