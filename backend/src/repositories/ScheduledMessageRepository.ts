import Database from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export interface ScheduledMessage {
  id: string;
  content: string;
  room_id: number;
  sender_id: number;
  media_url?: string;
  scheduled_at: Date;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  created_at: Date;
}

export class ScheduledMessageRepository {
  /**
   * Initialize table and types if not exists
   */
  static async initTable(): Promise<void> {
    // Create type if not exists
    await Database.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scheduled_message_status') THEN
              CREATE TYPE scheduled_message_status AS ENUM ('pending', 'processing', 'sent', 'failed', 'cancelled');
          END IF;
      END$$;
    `);

    // Create table if not exists
    await Database.query(`
      CREATE TABLE IF NOT EXISTS scheduled_messages (
          id UUID PRIMARY KEY,
          content TEXT,
          room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
          sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          media_url TEXT,
          scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
          status scheduled_message_status NOT NULL DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          failure_reason TEXT
      )
    `);

    // Create index if not exists
    await Database.query(`
      CREATE INDEX IF NOT EXISTS idx_scheduled_messages_polling 
      ON scheduled_messages (status, scheduled_at) 
      WHERE status = 'pending'
    `);
  }

  /**
   * Schedule a new message
   */
  static async scheduleMessage(
    senderId: number,
    roomId: number,
    content: string,
    scheduledAt: Date,
    mediaUrl?: string
  ): Promise<ScheduledMessage> {
    const id = uuidv4();

    const result = await Database.query(
      `INSERT INTO scheduled_messages (id, sender_id, room_id, content, media_url, scheduled_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
      [id, senderId, roomId, content, mediaUrl, scheduledAt]
    );

    return result.rows[0];
  }

  /**
   * Poll for due messages using SKIP LOCKED to ensure concurrency safety
   */
  static async pollDueMessages(limit: number = 50): Promise<ScheduledMessage[]> {
    // This transaction blocks these rows for this worker instance only
    // effectively implementing a job queue in postgres
    const result = await Database.query(
      `UPDATE scheduled_messages
             SET status = 'processing'
             WHERE id IN (
                 SELECT id
                 FROM scheduled_messages
                 WHERE status = 'pending'
                 AND scheduled_at <= NOW()
                 ORDER BY scheduled_at ASC
                 LIMIT $1
                 FOR UPDATE SKIP LOCKED
             )
             RETURNING *`,
      [limit]
    );

    return result.rows;
  }

  /**
   * Mark message as sent (success)
   */
  static async markAsSent(id: string): Promise<void> {
    await Database.query(`UPDATE scheduled_messages SET status = 'sent' WHERE id = $1`, [id]);
  }

  /**
   * Mark message as failed
   */
  static async markAsFailed(id: string, reason: string): Promise<void> {
    await Database.query(
      `UPDATE scheduled_messages SET status = 'failed', failure_reason = $2 WHERE id = $1`,
      [id, reason]
    );
  }

  /**
   * Cancel a scheduled message (only if pending)
   */
  static async cancelMessage(id: string, userId: number): Promise<boolean> {
    const result = await Database.query(
      `UPDATE scheduled_messages 
             SET status = 'cancelled' 
             WHERE id = $1 AND sender_id = $2 AND status = 'pending'`,
      [id, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get pending scheduled messages for a user
   */
  static async getPendingMessages(userId: number): Promise<ScheduledMessage[]> {
    const result = await Database.query(
      `SELECT * FROM scheduled_messages 
             WHERE sender_id = $1 AND status = 'pending' 
             ORDER BY scheduled_at ASC`,
      [userId]
    );
    return result.rows;
  }
}
