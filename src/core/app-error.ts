export class AppError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AppError';
    }
    public status = 200;
}

export class NotFound extends AppError {
    constructor(message) {
        super(message || 'Not Found');
        this.name = 'NotFoundError';
    }
    public status = 404;
}

export class Unauthorized extends AppError {
    constructor(message) {
        super(message || 'Unauthorized');
        this.name = 'UnauthorizedError';
    }
    public status = 401;
}
