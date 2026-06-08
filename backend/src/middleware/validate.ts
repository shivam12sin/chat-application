import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

type ValidationLocation = 'body' | 'query' | 'params';

/**
 * Validation middleware factory
 * Creates middleware that validates request data against a Zod schema
 */
export const validate = (
    schema: ZodSchema,
    location: ValidationLocation = 'body'
) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        try {
            const data = req[location];
            const validated = schema.parse(data);

            // Replace with validated and transformed data
            req[location] = validated;

            next();
        } catch (error) {
            // Let the error handler deal with ZodError
            next(error);
        }
    };
};

/**
 * Validate multiple locations at once
 */
export const validateAll = (schemas: {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
}) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        try {
            if (schemas.body) {
                req.body = schemas.body.parse(req.body);
            }
            if (schemas.query) {
                req.query = schemas.query.parse(req.query) as any;
            }
            if (schemas.params) {
                req.params = schemas.params.parse(req.params) as Record<string, string>;
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};
