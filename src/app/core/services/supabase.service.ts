import { Injectable, computed, signal } from '@angular/core';
import {
  AuthChangeEvent,
  AuthSession,
  createClient,
  RealtimeChannel,
  SupabaseClient,
  User,
} from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );

  private readonly sessionSignal = signal<AuthSession | null>(null);
  private readonly readySignal = signal(false);

  readonly session = this.sessionSignal.asReadonly();
  readonly user = computed<User | null>(() => this.sessionSignal()?.user ?? null);
  readonly isAuthenticated = computed(() => !!this.sessionSignal()?.user);
  readonly authReady = this.readySignal.asReadonly();

  constructor() {
    void this.bootstrapAuth();
  }

  private async bootstrapAuth(): Promise<void> {
    const { data } = await this.client.auth.getSession();
    this.sessionSignal.set(data.session);

    this.client.auth.onAuthStateChange((_event: AuthChangeEvent, session) => {
      this.sessionSignal.set(session);
    });

    this.readySignal.set(true);
  }

  async signInWithPassword(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async signUp(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signUp({ email, password });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }

  channel(name: string): RealtimeChannel {
    return this.client.channel(name);
  }

  removeChannel(channel: RealtimeChannel): Promise<string> {
    return this.client.removeChannel(channel);
  }
}
