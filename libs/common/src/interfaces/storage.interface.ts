export interface IStorageService {
  uploadFile(key: string, buffer: Buffer, contentType?: string): Promise<string>;
  downloadFile(key: string): Promise<Buffer>;
  deleteFile(key: string): Promise<boolean>;
  getFileUrl(key: string, expiresIn?: number): Promise<string>;
  fileExists(key: string): Promise<boolean>;
}

export interface IStorageConfig {
  bucket: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
}

export interface IDatabaseService {
  create<T>(tableName: string, item: T): Promise<T>;
  findById<T>(tableName: string, id: string): Promise<T | null>;
  findMany<T>(tableName: string, filters?: Record<string, any>, pagination?: IPaginationOptions): Promise<IPaginatedResult<T>>;
  update<T>(tableName: string, id: string, updates: Partial<T>): Promise<T>;
  delete(tableName: string, id: string): Promise<boolean>;
  query<T>(tableName: string, query: IQueryOptions): Promise<T[]>;
}

export interface IPaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface IPaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface IQueryOptions {
  where?: Record<string, any>;
  select?: string[];
  orderBy?: Record<string, 'asc' | 'desc'>;
  limit?: number;
  offset?: number;
}

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  clear(): Promise<boolean>;
  keys(pattern?: string): Promise<string[]>;
}

export interface ICacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  ttl?: number;
}
