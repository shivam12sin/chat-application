/**
 * Metrics routes - exposes /metrics endpoint for Prometheus scraping
 */

import { Router, Request, Response } from 'express';
import { getMetrics, getContentType } from '../services/MetricsService';

const router = Router();

/**
 * GET /metrics
 * Returns Prometheus-formatted metrics
 */
router.get('/', async (_req: Request, res: Response) => {
    try {
        const metrics = await getMetrics();
        res.set('Content-Type', getContentType());
        res.send(metrics);
    } catch (error) {
        res.status(500).send('Error collecting metrics');
    }
});

export default router;
