/**
 * Shared error types used across the application.
 * Must NOT be in a "use server" file — Next.js Turbopack forbids class exports
 * from server action modules.
 */

export class DuplicateWineError extends Error {
  constructor(
    public existingWineId: string,
    public existingWineName: string
  ) {
    super(`Duplicate wine: "${existingWineName}" already exists`);
    this.name = "DuplicateWineError";
  }
}
