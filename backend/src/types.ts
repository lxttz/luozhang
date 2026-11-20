export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

export type Role = 'boss' | 'finance';

export interface JwtPayload {
  sub: number;
  username: string;
  role: Role;
  name?: string;
  iat: number;
  exp: number;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    user: JwtPayload;
  };
};
