export const ERROR_MESSAGES = {
  INTERNAL_SERVER_ERROR: 'An unexpected error occurred.',
  VALIDATION_FAILED: 'Validation failed.',
  UNAUTHORIZED: 'Unauthorized access.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  RESOURCE_NOT_FOUND: 'Resource not found.',

  // Dynamic generic messages
  NOT_FOUND: (resource: string) => `${resource} not found.`,
  ALREADY_EXISTS: (resource: string) => `${resource} already exists.`,
  DELETE_CONFLICT: (resource: string) =>
    `Cannot delete ${resource} because it is referenced by other records.`,
  INVALID_REQUEST: (resource: string) => `Invalid ${resource}.`,
};