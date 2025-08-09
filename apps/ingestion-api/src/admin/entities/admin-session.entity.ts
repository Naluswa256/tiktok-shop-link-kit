export interface AdminSession {
  sessionId: string; // UUID primary key
  adminUsername: string; // Admin username
  issuedAt: string; // ISO date string
  expiresAt: string; // ISO date string
  ip?: string; // Client IP address
  userAgent?: string; // Client user agent
  isRevoked?: boolean; // Whether session is revoked
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

// DynamoDB table structure for AdminSessions
export interface AdminSessionDynamoDBItem {
  PK: string; // SESSION#{sessionId}
  SK: string; // SESSION#{sessionId}
  GSI1PK: string; // ADMIN#{adminUsername}
  GSI1SK: string; // SESSION#{sessionId}
  EntityType: string; // 'ADMIN_SESSION'
  sessionId: string;
  adminUsername: string;
  issuedAt: string;
  expiresAt: string;
  ip?: string;
  userAgent?: string;
  isRevoked?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdminSessionInput {
  sessionId: string;
  adminUsername: string;
  expiresAt: string;
  ip?: string;
  userAgent?: string;
}
