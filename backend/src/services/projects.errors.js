// Shared by the projects core service and its trash/sharing satellites.
// Thrown to signal a business/validation failure the controller maps to an HTTP status + message.
class ProjectServiceError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'ProjectServiceError';
    this.code = code;
  }
}

module.exports = { ProjectServiceError };
