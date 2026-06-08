import { Client } from '@elastic/elasticsearch';

// Elasticsearch client singleton
let client: Client | null = null;

export const getElasticsearchClient = (): Client => {
    if (!client) {
        const esUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
        client = new Client({
            node: esUrl,
            // Retry on failure
            maxRetries: 3,
            requestTimeout: 30000
        });
    }
    return client;
};

// Messages index configuration
const MESSAGES_INDEX = 'messages';

export const MESSAGES_INDEX_SETTINGS = {
    settings: {
        analysis: {
            analyzer: {
                ngram_analyzer: {
                    type: 'custom',
                    tokenizer: 'ngram_tokenizer',
                    filter: ['lowercase']
                },
                standard_lowercase: {
                    type: 'custom',
                    tokenizer: 'standard',
                    filter: ['lowercase']
                }
            },
            tokenizer: {
                ngram_tokenizer: {
                    type: 'ngram',
                    min_gram: 1,
                    max_gram: 3,
                    token_chars: ['letter', 'digit']
                }
            }
        }
    },
    mappings: {
        properties: {
            id: { type: 'keyword' },
            room_id: { type: 'integer' },
            sender_id: { type: 'integer' },
            sender_username: { type: 'keyword' },
            content: {
                type: 'text',
                analyzer: 'standard_lowercase',
                fields: {
                    ngram: {
                        type: 'text',
                        analyzer: 'ngram_analyzer'
                    }
                }
            },
            message_type: { type: 'keyword' },
            created_at: { type: 'date' }
        }
    }
};

/**
 * Initialize Elasticsearch index with ngram analyzer for substring search
 */
export const initializeElasticsearchIndex = async (): Promise<void> => {
    const es = getElasticsearchClient();

    try {
        const indexExists = await es.indices.exists({ index: MESSAGES_INDEX });

        if (!indexExists) {
            console.log('Creating Elasticsearch messages index...');
            await es.indices.create({
                index: MESSAGES_INDEX,
                ...MESSAGES_INDEX_SETTINGS
            } as any);
            console.log('Elasticsearch messages index created successfully');
        } else {
            console.log('Elasticsearch messages index already exists');
        }
    } catch (error) {
        console.error('Failed to initialize Elasticsearch index:', error);
        // Don't throw - allow app to start without ES
    }
};

/**
 * Index a message to Elasticsearch
 */
export const indexMessage = async (message: {
    id: string;
    room_id: number;
    sender_id: number;
    sender_username: string;
    content: string;
    message_type: string;
    created_at: Date | string;
}): Promise<void> => {
    const es = getElasticsearchClient();

    try {
        await es.index({
            index: MESSAGES_INDEX,
            id: message.id,
            document: {
                id: message.id,
                room_id: message.room_id,
                sender_id: message.sender_id,
                sender_username: message.sender_username,
                content: message.content,
                message_type: message.message_type,
                created_at: message.created_at
            }
        });
    } catch (error) {
        console.error('Failed to index message to Elasticsearch:', error);
        // Don't throw - message is still saved to PostgreSQL
    }
};

/**
 * Search messages in Elasticsearch
 */
export const searchMessages = async (
    query: string,
    options: {
        roomId?: number;
        sender?: string;
        before?: string;
        after?: string;
        limit?: number;
        offset?: number;
    } = {}
): Promise<{ results: any[]; total: number }> => {
    const es = getElasticsearchClient();
    const { roomId, sender, before, after, limit = 50, offset = 0 } = options;

    // Build bool query
    const must: any[] = [];
    const filter: any[] = [];

    // Text search using ngram for substring matching
    if (query.trim()) {
        must.push({
            multi_match: {
                query: query.trim(),
                fields: ['content', 'content.ngram'],
                type: 'best_fields',
                fuzziness: query.length > 3 ? 'AUTO' : 0
            }
        });
    }

    // Room filter
    if (roomId) {
        filter.push({ term: { room_id: roomId } });
    }

    // Sender filter (partial match)
    if (sender) {
        filter.push({
            wildcard: {
                sender_username: `*${sender.toLowerCase()}*`
            }
        });
    }

    // Date range filter
    if (before || after) {
        const range: any = { created_at: {} };
        if (before) range.created_at.lt = before;
        if (after) range.created_at.gte = after;
        filter.push({ range });
    }

    try {
        const response = await es.search({
            index: MESSAGES_INDEX,
            from: offset,
            size: limit,
            query: {
                bool: {
                    must: must.length > 0 ? must : [{ match_all: {} }],
                    filter
                }
            },
            sort: [
                { _score: { order: 'desc' } },
                { created_at: { order: 'desc' } }
            ],
            highlight: {
                fields: {
                    content: {
                        pre_tags: ['<mark>'],
                        post_tags: ['</mark>'],
                        fragment_size: 100,
                        number_of_fragments: 3
                    }
                }
            }
        } as any);

        const hits = response.hits.hits;
        const total = typeof response.hits.total === 'number'
            ? response.hits.total
            : response.hits.total?.value ?? 0;

        return {
            results: hits.map((hit: any) => ({
                id: hit._source.id,
                room_id: hit._source.room_id,
                sender_id: hit._source.sender_id,
                sender_username: hit._source.sender_username,
                content: hit._source.content,
                message_type: hit._source.message_type,
                created_at: hit._source.created_at,
                match_snippet: hit.highlight?.content?.[0] || hit._source.content,
                score: hit._score
            })),
            total
        };
    } catch (error) {
        console.error('Elasticsearch search failed:', error);
        // Return empty results on ES failure - fallback should be handled upstream
        throw error;
    }
};

export { MESSAGES_INDEX };
