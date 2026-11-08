// Accurate Lab - Export to Excel & Print Helpers

/**
 * Downloads a CSV file with UTF-8 BOM for full Arabic character support in Excel
 */
function downloadCSV(csvContent, filename) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export Attendance Records to CSV (Excel)
 */
export function exportAttendanceToCSV(records) {
  if (!records || records.length === 0) {
    throw new Error('لا توجد سجلات حضور لتصديرها');
  }

  const headers = ['اسم الموظف', 'الكود الرباعي', 'المنطقة / الفرع', 'رقم الهاتف', 'نوع الحركة', 'التاريخ', 'الساعة'];
  const rows = records.map(r => [
    `"${r.employeeName || ''}"`,
    `"${r.employeeCode || ''}"`,
    `"${r.employeeArea || ''}"`,
    `"${r.employeePhone || ''}"`,
    `"${r.actionLabel || r.actionType || ''}"`,
    `"${r.date || ''}"`,
    `"${r.time || ''}"`
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const today = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `تقرير_حضور_وانصراف_أكيوريت_${today}.csv`);
}

/**
 * Export Rewards & Deductions to CSV (Excel)
 */
export function exportRewardsToCSV(records) {
  if (!records || records.length === 0) {
    throw new Error('لا توجد سجلات مكافآت أو خصومات لتصديرها');
  }

  const headers = ['اسم الموظف', 'الكود', 'النوع', 'المبلغ (ج.م)', 'السبب', 'التاريخ', 'الساعة'];
  const rows = records.map(r => [
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
}

/**
 * Export Leave Requests to CSV (Excel)
 */
export function exportLeavesToCSV(records) {
  if (!records || records.length === 0) {
    throw new Error('لا توجد طلبات إجازة لتصديرها');
  }

  const headers = ['اسم الموظف', 'الكود', 'المنطقة', 'الهاتف', 'نوع الإجازة', 'عدد الأيام', 'تاريخ البدء', 'حالة الطلب', 'السبب', 'تاريخ التقديم'];
  const rows = records.map(r => {
    let statusLabel = 'قيد المراجعة';
    if (r.status === 'approved') statusLabel = 'مقبولة';
    if (r.status === 'rejected') statusLabel = 'مرفوضة';

    return [
      `"${r.employeeName || ''}"`,
      `"${r.employeeCode || ''}"`,
      `"${r.employeeArea || ''}"`,
      `"${r.employeePhone || ''}"`,
      `"${r.leaveType || ''}"`,
      r.daysCount || 0,
      `"${r.startDate || ''}"`,
      `"${statusLabel}"`,
      `"${r.reason || ''}"`,
      `"${r.date || ''}"`
    ];
  });

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const today = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `سجل_طلبات_الإجازات_أكيوريت_${today}.csv`);
}

