import dotenv from "dotenv";
dotenv.config();

if (!process.env.MONGO_URI) {
  throw new Error("MONGO_URI is require in environmental variable");
}

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is require in environmental variable");
}

if (!process.env.JWT_EXPIRES_IN) {
  throw new Error("JWT_EXPIRES_IN is require in environmental variable");
}

if (!process.env.IMAGEKIT_PUBLIC_KEY) {
  throw new Error("IMAGEKIT_PUBLIC_KEY is require in environmental variable");
}

if (!process.env.IMAGEKIT_PRIVATE_KEY) {
  throw new Error("IMAGEKIT_PRIVATE_KEY is require in environmental variable");
}

if (!process.env.IMAGEKIT_URL_ENDPOINT) {
  throw new Error("IMAGEKIT_URL_ENDPOINT is require in environmental variable");
}

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is require in environmental variable");
}


export const config = {
  PORT: process.env.PORT,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  IMAGEKIT_PUBLIC_KEY: process.env.IMAGEKIT_PUBLIC_KEY,
  IMAGEKIT_PRIVATE_KEY: process.env.IMAGEKIT_PRIVATE_KEY,
  IMAGEKIT_URL_ENDPOINT: process.env.IMAGEKIT_URL_ENDPOINT,
  REDIS_URL: process.env.REDIS_URL,
};
