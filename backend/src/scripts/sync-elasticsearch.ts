/**
 * Sync existing PostgreSQL messages to Elasticsearch
 * Run this once after setting up ES: npx ts-node src/scripts/sync-elasticsearch.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import Database from '../config/database';
import { getElasticsearchClient, initializeElasticsearchIndex, MESSAGES_INDEX } from '../config/elasticsearch';

const BATCH_SIZE = 100;

async function syncMessagesToElasticsearch() {
    console.log('Starting Elasticsearch sync...');

    try {
        // Initialize index with mappings
        await initializeElasticsearchIndex();

        const es = getElasticsearchClient();

        // Get total count
        const countResult = await Database.query(
            'SELECT COUNT(*) as total FROM messages WHERE deleted_at IS NULL'
        );
        const totalMessages = parseInt(countResult.rows[0].total, 10);
        console.log(`Total messages to sync: ${totalMessages}`);

        let processed = 0;
        let offset = 0;

        while (offset < totalMessages) {
            // Fetch batch of messages with sender info
            const result = await Database.query(
                `SELECT 
                    m.id,
                    m.room_id,
                    m.sender_id,
                    u.username as sender_username,
                    m.content,
                    m.message_type,
                    m.created_at
                 FROM messages m
                 JOIN users u ON m.sender_id = u.id
                 WHERE m.deleted_at IS NULL
                 ORDER BY m.created_at ASC
                 LIMIT $1 OFFSET $2`,
                [BATCH_SIZE, offset]
            );

            if (result.rows.length === 0) break;

            // Bulk index to Elasticsearch
            const operations = result.rows.flatMap((msg: any) => [
                { index: { _index: MESSAGES_INDEX, _id: msg.id } },
                {
                    id: msg.id,
                    room_id: msg.room_id,
                    sender_id: msg.sender_id,
                    sender_username: msg.sender_username,
                    content: msg.content,
                    message_type: msg.message_type,
                    created_at: msg.created_at
                }
            ]);

            await es.bulk({ operations, refresh: false });

            processed += result.rows.length;
            offset += BATCH_SIZE;

            const progress = ((processed / totalMessages) * 100).toFixed(1);
            console.log(`Progress: ${processed}/${totalMessages} (${progress}%)`);
        }

        // Refresh index to make documents searchable
        await es.indices.refresh({ index: MESSAGES_INDEX });

        console.log(`✅ Sync complete! ${processed} messages indexed.`);

    } catch (error) {
        console.error('Sync failed:', error);
        process.exit(1);
    } finally {
        await Database.close();
        process.exit(0);
    }
}

syncMessagesToElasticsearch();
