export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestException extends HttpError {
  constructor(message = 'Bad request') {
    super(message, 400);
  }
}

export class UnauthorizedException extends HttpError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenException extends HttpError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class NotFoundException extends HttpError {
  constructor(message = 'Not found') {
    super(message, 404);
  }
}

export class ConflictException extends HttpError {
  constructor(message = 'Conflict') {
    super(message, 409);
  }
}

export class ServiceUnavailableException extends HttpError {
  constructor(message = 'Service unavailable') {
    super(message, 503);
  }
}
