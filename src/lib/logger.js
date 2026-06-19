import { supabase } from './supabase';

/**
 * Logs an action to the system_logs table
 * @param {Object} params
 * @param {string} params.action - The action being performed (e.g. "Logged In", "Deleted Product")
 * @param {string} params.details - Detailed context about the action
 * @param {string} params.severity - 'info', 'warning', or 'danger'
 * @param {number|null} params.employeeId - Employee ID if applicable
 * @param {string|null} params.userEmail - User email if applicable (for Admin)
 */
export async function logAction({ action, details, severity = 'info', employeeId = null, userEmail = null }) {
  try {
    // If neither employeeId nor userEmail is provided, try to fetch the current user session
    if (!employeeId && !userEmail) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        userEmail = session.user.email;
      }
    }

    const { error } = await supabase
      .from('system_logs')
      .insert([{
        ACTION: action,
        DETAILS: details,
        SEVERITY: severity,
        EMPLOYEE_ID: employeeId,
        USER_EMAIL: userEmail
      }]);

    if (error) {
      console.error('Failed to write to system_logs:', error);
    }
  } catch (err) {
    console.error('Exception writing to system_logs:', err);
  }
}
