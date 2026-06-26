import { supabase } from './supabase';

export type ActiveStaffPresenceSession = {
  userId: string;
  username: string;
  role: 'admin' | 'normal' | 'doctor' | 'patient';
  location_id: string | null;
  loginTime: number;
  clientSessionId?: string;
};

const isTrackableStaffSession = (session: ActiveStaffPresenceSession | null | undefined): session is ActiveStaffPresenceSession => {
  return Boolean(session?.clientSessionId && session.userId && session.username && session.role !== 'patient');
};

const toRpcPayload = (session: ActiveStaffPresenceSession) => ({
  p_session_id: session.clientSessionId,
  p_user_id: session.userId,
  p_username: session.username,
  p_role: session.role,
  p_location_id: session.location_id || null,
  p_login_at: new Date(session.loginTime).toISOString(),
  p_seen_at: new Date().toISOString(),
  p_cutoff_minutes: 60
});

export const activeStaffPresence = {
  async markActive(session: ActiveStaffPresenceSession): Promise<void> {
    if (!isTrackableStaffSession(session)) return;

    const { error } = await supabase.rpc('update_and_get_staff_presence', toRpcPayload(session));
    if (error) {
      throw new Error(error.message || 'Failed to mark active staff session.');
    }
  },

  async markInactive(session: ActiveStaffPresenceSession | null): Promise<void> {
    if (!isTrackableStaffSession(session)) return;

    const { error } = await supabase.rpc('clear_active_staff_session_presence', {
      p_session_id: session.clientSessionId
    });

    if (error) {
      throw new Error(error.message || 'Failed to clear active staff session.');
    }
  }
};

